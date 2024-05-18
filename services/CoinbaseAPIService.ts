import EventEmitter from "events";
import WebSocket from "ws";
import { DateTime } from "luxon";
import { EVENTS } from "../utils/constants";
import { splitIntoGroups } from "../utils/helpers";
import axios from "axios";
import { sign } from "jsonwebtoken";
import crypto from "crypto";

class CoinbaseAPIService extends EventEmitter {
  private symbols: string[] = [];
  private connections: WebSocket[] = [];
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor() {
    super();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.fetchSymbols();
  }

  private handleMessage = (data: Record<string, any>) => {
    const message = JSON.parse(data as any);

    if (message.type === "error") {
      console.log(message.message + " reason: " + message.reason);
    }

    this.emit(EVENTS.MESSAGE_RECEIVED, message);
  };

  private async fetchSymbols() {
    const jwtToken = await this.getCoinbaseJWTToken();

    try {
      const res = await axios.get(
        "https://api.coinbase.com/api/v3/brokerage/products",
        {
          headers: {
            Authorization: `Bearer ${jwtToken}`,
          },
          params: {
            product_type: "FUTURE",
            contract_expiry_type: "PERPETUAL",
            expiring_contract_status: "STATUS_ALL",
          },
        }
      );

      if (!res?.data?.products) {
        console.log("No products found on Coinbase");
        return [];
      }

      this.symbols = res.data.products.map((item: any) => item.product_id);
      this.emit(EVENTS.SYMBOLS_FETCHED, this.symbols);
    } catch (e) {
      console.log(
        "CoinbaseAPIService: Something went wrong. Couldnt fetch symbols"
      );
    }
  }

  private connectToStream(pairsGroup: string[], index: number) {
    const wsUrl = `wss://ws-md.international.coinbase.com`;
    const wSocket = new WebSocket(wsUrl, {
      perMessageDeflate: true,
      maxPayload: 1024 * 1024 * 2,
    });

    this.connections[index] = wSocket;

    wSocket.on("open", () => {
      this.reconnectAttempts = 0;

      try {
        wSocket.send(
          JSON.stringify({
            type: "subscribe",
            channels: [
              { name: "matches", product_ids: pairsGroup },
              { name: "heartbeat", product_ids: pairsGroup },
            ],
          })
        );
      } catch (error) {
        console.log(error);
      }

      console.log("Coinbase connections: ", this.connections.length);
      console.log(
        `WebSocket connection established on Coinbase for group ${pairsGroup}`
      );
      console.log(
        "---------------------------------------------------------------"
      );
    });

    wSocket.on("message", this.handleMessage);

    wSocket.on("close", (code, reason) => {
      console.log(
        `Coinbase WebSocket connection closed with code: ${code}, reason: ${reason} `
      );

      console.log(
        "---------------------------------------------------------------"
      );

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => {
          const time = DateTime.now().toLocaleString({
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "short",
            hourCycle: "h23",
          });

          console.log(
            `Attempting to reconnect... (${
              this.reconnectAttempts + 1
            }),  Time: ${time}`
          );

          this.reconnectAttempts++;
          this.connectToStream(pairsGroup, index);
        }, 1000 * this.reconnectAttempts);
      }
    });

    wSocket.on("error", (error) => {
      console.log("WebSocket error: " + error.message);
    });
  }

  public async subscribeToStreams(symbols: string[]) {
    if (!symbols.length) return;
    console.log("Closing all existing connections on Coinbase");
    this.closeAllConnections();

    const groupSize = 50;
    const groupsOfPairs = splitIntoGroups(symbols, groupSize);

    groupsOfPairs.forEach((pairsGroup, index) => {
      this.connectToStream(pairsGroup, index);
    });
  }

  public getSymbols() {
    return this.symbols;
  }

  private closeAllConnections() {
    this.connections.forEach((connection) => {
      connection.close();
    });

    this.connections = [];
  }

  private async getCoinbaseJWTToken() {
    const keyName = process.env.COINBASE_API_KEY;
    const keySecret = process.env.COINBASE_PRIVATE_KEY;
    const requestMethod = "GET";
    const url = "api.coinbase.com";
    const requestPath = "/api/v3/brokerage/products";
    const algorithm = "ES256";
    const uri = requestMethod + " " + url + requestPath;

    const token = sign(
      {
        iss: "coinbase-cloud",
        nbf: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 120,
        sub: keyName,
        uri,
      },
      keySecret as any,
      {
        algorithm,
        header: {
          kid: keyName,
          nonce: crypto.randomBytes(16).toString("hex"),
        },
      } as any
    );

    return token;
  }
}

export default CoinbaseAPIService;
