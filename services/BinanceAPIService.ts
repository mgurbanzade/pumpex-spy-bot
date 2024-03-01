import EventEmitter from "events";
import WebSocket from "ws";

class BinanceAPIService extends EventEmitter {
  private symbols: string[] = [];

  constructor() {
    super();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.fetchSymbols();
    this.subscribeToStreams();
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

        this.emit("symbolsFetched", this.symbols);
      }
    } catch (error) {
      console.error("Something went wrong. Try again later");
      return [];
    }
  }

  private async subscribeToStreams() {
    const groupSize = 50;
    const groupsOfPairs = this.splitIntoGroups(this.symbols, groupSize);

    groupsOfPairs.forEach((pairsGroup, index) => {
      const streams = pairsGroup.map(
        (pair) => `${pair.toLowerCase()}@aggTrade`
      );
      const params = streams.join("/");
      const wsUrl = `wss://fstream.binance.com/stream?streams=${params}`;
      const wSocket = new WebSocket(wsUrl);

      wSocket.on("open", () => {
        console.log(`WebSocket connection established for group ${index + 1}`);
      });

      wSocket.on("message", (data) => {
        const message = JSON.parse(data as any);
        this.emit("messageReceived", message);
      });

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
}

export default BinanceAPIService;
