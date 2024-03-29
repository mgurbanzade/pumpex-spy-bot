import EventEmitter from "events";
import WebSocket from "ws";
import { DateTime } from "luxon";
import { EVENTS } from "../utils/constants";
import { splitIntoGroups } from "../utils/helpers";

class BinanceAPIService extends EventEmitter {
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
    this.emit(EVENTS.MESSAGE_RECEIVED, message);
  };

  private async fetchSymbols() {
    try {
      const response = await fetch(
        `https://api.binance.com/api/v3/exchangeInfo`
      );
      const data = (await response.json()) as Record<string, any>;

      if (!data) console.log("no data");

      if (data?.symbols) {
        this.symbols = data.symbols
          .filter((item: Record<string, any>) => item.status === "TRADING")
          .map((item: any) => item.symbol);

        this.emit(EVENTS.SYMBOLS_FETCHED, this.symbols);
      } else {
        console.log("No symbols found on Binance");
      }
    } catch (error) {
      console.error("Something went wrong. Try again later");
      return [];
    }
  }

  private connectToStream(pairsGroup: string[], index: number) {
    const streams = pairsGroup.map((pair) => `${pair.toLowerCase()}@aggTrade`);
    const params = streams.join("/");

    const wsUrl = `wss://fstream.binance.com/stream?streams=${params}`;
    const wSocket = new WebSocket(wsUrl);

    this.connections[index] = wSocket;

    wSocket.on("open", () => {
      this.reconnectAttempts = 0;

      console.log(
        `WebSocket connection established on Binance for group ${pairsGroup}`
      );
      console.log(
        "---------------------------------------------------------------"
      );
    });

    wSocket.on("message", this.handleMessage);

    wSocket.on("error", (error) => {
      console.log("WebSocket error: " + error.message);
    });

    wSocket.on("close", (code, reason) => {
      console.log(
        `Binance webSocket connection closed with code: ${code}, reason: ${reason}`
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
  }

  public async subscribeToStreams(symbols: string[]) {
    console.log("Closing all existing connections on Binance");
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

export default BinanceAPIService;
