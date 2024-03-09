import EventEmitter from "events";
import WebSocket from "ws";
import { DISABLED_PAIRS, EVENTS } from "../utils/constants";

class CoinbaseAPIService extends EventEmitter {
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

  public async subscribeToStreams(symbols: string[]) {
    if (!symbols.length) return;
    console.log("Closing all existing connections on Coinbase");
    this.closeAllConnections();
    const groupSize = 50;
    const groupsOfPairs = this.splitIntoGroups(symbols, groupSize);
    const handleMessage = (data: Record<string, any>) => {
      const message = JSON.parse(data as any);

      if (message.type === "error") {
        console.log(message.message + " reason: " + message.reason);
      }

      this.emit(EVENTS.MESSAGE_RECEIVED, message);
    };

    groupsOfPairs.forEach((pairsGroup, index) => {
      const wsUrl = `wss://ws-feed.pro.coinbase.com`;
      const wSocket = new WebSocket(wsUrl, {
        perMessageDeflate: true,
        maxPayload: 1024 * 1024 * 2,
      });

      this.connections.push(wSocket);

      wSocket.on("open", () => {
        try {
          const res = wSocket.send(
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

        console.log(
          `WebSocket connection established on Coinbase for group ${pairsGroup}`
        );
      });

      wSocket.on("message", handleMessage);

      wSocket.on("error", (error) => {
        console.log("WebSocket error: " + error.message);
      });
    });
  }

  public getSymbols() {
    return this.symbols;
  }

  private splitIntoGroups(arr: string[], groupSize: number) {
    const groups = [];

    for (let i = 0; i < arr.length; i += groupSize) {
      groups.push(arr.slice(i, i + groupSize));
    }

    return groups;
  }

  private closeAllConnections() {
    this.connections.forEach((connection) => {
      connection.close();
    });

    this.connections = [];
  }
}

export default CoinbaseAPIService;
