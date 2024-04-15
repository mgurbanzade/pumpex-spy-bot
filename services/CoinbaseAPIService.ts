import EventEmitter from "events";
import WebSocket from "ws";
import { DateTime } from "luxon";
import { DISABLED_PAIRS, EVENTS } from "../utils/constants";
import { splitIntoGroups } from "../utils/helpers";

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
    try {
      const response = await fetch(
        `https://api.exchange.coinbase.com/products`
      );
      const data = (await response.json()) as Record<string, any>;
      if (!data) console.log("no data");

      if (data) {
        this.symbols = data
          .filter((item: Record<string, any>) => {
            return (
              item.status === "online" &&
              !DISABLED_PAIRS.includes(item.display_name)
            );
          })
          .map((item: any) => item.display_name);

        this.emit(EVENTS.SYMBOLS_FETCHED, this.symbols);
      } else {
        console.log("No symbols found on Coinbase");
      }
    } catch (error) {
      console.error("Something went wrong. Try again later");
      return [];
    }
  }

  private connectToStream(pairsGroup: string[], index: number) {
    const wsUrl = `wss://ws-feed.pro.coinbase.com`;
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
}

export default CoinbaseAPIService;
