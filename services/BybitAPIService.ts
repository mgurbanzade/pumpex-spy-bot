import EventEmitter from "events";
import WebSocket from "ws";
import { DateTime } from "luxon";
import { RestClientV5 } from "bybit-api";
import { EVENTS } from "../utils/constants";
import { splitIntoGroups } from "../utils/helpers";

class BybitAPIService extends EventEmitter {
  private symbols: string[] = [];
  private connections: WebSocket[] = [];
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private client: RestClientV5;

  constructor() {
    super();
    this.client = new RestClientV5();
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
      const res = await this.client.getInstrumentsInfo({
        category: "linear",
      });

      if (res?.result?.list) {
        this.symbols = res.result.list
          .filter((item: Record<string, any>) => {
            return (
              item.contractType === "LinearPerpetual" &&
              item.status === "Trading"
            );
          })
          .map((item: any) => item.symbol);

        this.emit(EVENTS.SYMBOLS_FETCHED, this.symbols);
      } else {
        console.log("No symbols found on Bybit");
      }
    } catch (e) {
      console.error("Something went wrong. Try again later");
      return [];
    }
  }

  private connectToStream(symbols: string[], index: number) {
    // console.log("Connecting to Bybit WebSocket", symbols);
    const wsUrl = `wss://stream.bybit.com/v5/public/linear`;
    const wSocket = new WebSocket(wsUrl);
    this.connections[index] = wSocket;

    wSocket.on("open", () => {
      this.reconnectAttempts = 0;

      try {
        wSocket.send(
          JSON.stringify({
            op: "subscribe",
            args: symbols.map((symbol) => `publicTrade.${symbol}`),
          })
        );
      } catch (error) {
        console.log(error);
      }

      console.log(
        "Bybit connections: ",
        `${index + 1}/${this.connections.length}`
      );
      console.log(
        `WebSocket connection established on Bybit for group ${symbols}`
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
        `Bybit webSocket connection closed with code: ${code}, reason: ${reason}`
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
          this.connectToStream(symbols, index);
        }, 1000 * this.reconnectAttempts);
      }
    });
  }

  public async subscribeToStreams(symbols: string[]) {
    console.log("Closing all existing connections on Bybit");
    this.closeAllConnections();

    if (!symbols.length) return;
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

export default BybitAPIService;
