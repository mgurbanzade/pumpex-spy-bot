import EventEmitter from "events";
import WebSocket from "ws";
import { EVENTS } from "../utils/constants";

class BybitAPIService extends EventEmitter {
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
      const response = await fetch(`https://api.bybit.com/v2/public/symbols`);
      const data = (await response.json()) as Record<string, any>;
      if (!data) console.log("no data");

      if (data?.result) {
        this.symbols = data.result
          .filter((item: Record<string, any>) => {
            const name = item.name;
            const last3 = name.slice(name.length - 4, name.length);
            return last3 === "USDT" && item.status === "Trading";
          })
          .map((item: any) => item.name);

        this.emit(EVENTS.SYMBOLS_FETCHED, this.symbols);
      } else {
        console.log("No symbols found on Bybit");
      }
    } catch (error) {
      console.error("Something went wrong. Try again later");
      return [];
    }
  }

  public async subscribeToStreams(symbols: string[]) {
    console.log("Closing all existing connections on Bybit");
    this.closeAllConnections();

    if (!symbols.length) return;
    const handleMessage = (data: Record<string, any>) => {
      const message = JSON.parse(data as any);
      this.emit(EVENTS.MESSAGE_RECEIVED, message);
    };

    const wsUrl = `wss://stream.bybit.com/v5/public/linear`;
    const wSocket = new WebSocket(wsUrl);
    this.connections.push(wSocket);

    wSocket.on("open", () => {
      try {
        const res = wSocket.send(
          JSON.stringify({
            op: "subscribe",
            args: symbols.map((symbol) => `publicTrade.${symbol}`),
          })
        );
      } catch (error) {
        console.log(error);
      }

      console.log(
        `WebSocket connection established on Bybit for group ${symbols}`
      );
    });

    wSocket.on("message", handleMessage);

    wSocket.on("error", (error) => {
      console.log("WebSocket error: " + error.message);
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

export default BybitAPIService;
