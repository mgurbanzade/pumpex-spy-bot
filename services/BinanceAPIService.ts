import EventEmitter from "events";
import WebSocket from "ws";
import { EVENTS } from "../utils/constants";

class BinanceAPIService extends EventEmitter {
  private symbols: string[] = [];
  private connections: WebSocket[] = [];

  constructor() {
    super();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.fetchSymbols();
  }

  private async fetchSymbols() {
    try {
      const response = await fetch(
        `https://api.binance.com/api/v3/exchangeInfo`
      );
      const data = (await response.json()) as Record<string, any>;

      if (data?.symbols) {
        this.symbols = data.symbols
          .filter((item: Record<string, any>) => item.status === "TRADING")
          .map((item: any) => item.symbol);

        this.emit(EVENTS.SYMBOLS_FETCHED, this.symbols);
      }
    } catch (error) {
      console.error("Something went wrong. Try again later");
      return [];
    }
  }

  public async subscribeToStreams(symbols: string[]) {
    console.log("Closing all existing connections");
    this.closeAllConnections();

    const groupSize = 50;
    const groupsOfPairs = this.splitIntoGroups(symbols, groupSize);
    const handleMessage = (data: Record<string, any>) => {
      const message = JSON.parse(data as any);
      this.emit(EVENTS.MESSAGE_RECEIVED, message);
    };

    groupsOfPairs.forEach((pairsGroup, index) => {
      const streams = pairsGroup.map(
        (pair) => `${pair.toLowerCase()}@aggTrade`
      );
      const params = streams.join("/");
      const wsUrl = `wss://fstream.binance.com/stream?streams=${params}`;
      const wSocket = new WebSocket(wsUrl);
      this.connections.push(wSocket);

      wSocket.on("open", () => {
        console.log(`WebSocket connection established for group ${pairsGroup}`);
      });

      wSocket.on("message", handleMessage);

      wSocket.on("error", (error) => {
        console.log("WebSocket error: " + error.message);
      });
    });
  }

  private splitIntoGroups(arr: string[], groupSize: number) {
    const groups = [];

    for (let i = 0; i < arr.length; i += groupSize) {
      groups.push(arr.slice(i, i + groupSize));
    }

    return groups;
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
