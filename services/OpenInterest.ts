import WebSocket from "ws";
import { DateTime } from "luxon";
import crypto from "crypto";
import axios from "axios";

const getCoinGlassUrl = (symbol: string) =>
  `https://www.coinglass.com/tv/Binance_${symbol}`;
const PUMP_INTERVAL = 1000 * 5; // 5 min
// const OPEN_INTEREST_INTERVAL = 60000 * 5; // 5 min

class OpenInterestService {
  private intervalId: any = null;
  private baseUrl: string = "https://api.binance.com";
  private symbols: string[] = [];
  private data: any = {};
  private prevData: any = {};

  // private prevOpenInterest: any = {};
  // private openInterest: any = {};
  // private emptyOpenInterest: string[] = [];

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.fetchSymbols();
    // setInterval(() => {
    //   this.pollOpenInterest();
    // }, OPEN_INTEREST_INTERVAL);
  }

  private async fetchSymbols() {
    try {
      // const response = await fetch(`${this.baseUrl}/api/v3/exchangeInfo`);
      // const data = await response.json();
      // if (data?.symbols) {
      //   this.symbols = data.symbols
      //     .filter(
      //       (item) => item.symbol.includes("USDT") && item.status === "TRADING"
      //     )
      //     .map((item: any) => item.symbol);
      // }
    } catch (error) {
      console.error("Error fetching altcoin symbols:", error);
      return [];
    }
  }

  // private fetchOpenInterest = async (symbol) => {
  //   try {
  //     const response = await axios.get(
  //       `https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=5m&limit=1`
  //     );

  //     if (!response.data || !response.data.length) {
  //       this.emptyOpenInterest.push(symbol);
  //     }
  //     return response.data[0];
  //   } catch (error) {
  //     console.error(`Error fetching open interest for ${symbol}:`, error);
  //     return null;
  //   }
  // };

  // private fetchOpenInterestForAllSymbols = async () => {
  //   const openInterestPromises = this.symbols
  //     .filter((sym) => this.emptyOpenInterest.indexOf(sym) === -1)
  //     .map(this.fetchOpenInterest);
  //   const openInterestResults = await Promise.all(openInterestPromises);

  //   return openInterestResults.filter((result) => result !== null);
  // };

  // private pollOpenInterest = async (period: string = "5m") => {
  //   const markets = await this.fetchOpenInterestForAllSymbols();
  //   markets
  //     .filter((item) => item?.sumOpenInterestValue)
  //     .forEach((market) => {
  //       const { symbol, sumOpenInterest, sumOpenInterestValue, timestamp } =
  //         market;
  //       this.prevOpenInterest[symbol] = { ...this.openInterest[symbol] };
  //       const prevData = this.prevOpenInterest[symbol];
  //       const presentedSum =
  //         new Intl.NumberFormat("en-US", {
  //           maximumFractionDigits: 0,
  //           minimumFractionDigits: 0,
  //         })
  //           .format(sumOpenInterestValue)
  //           .replace(/,/g, " ") + " USDT";

  //       const diffPercent = prevData.sum
  //         ? (
  //             ((sumOpenInterestValue - prevData.sum) / prevData.sum) *
  //             100
  //           ).toFixed(3)
  //         : null;

  //       const sym = symbol.replace("USDT", "");

  //       this.openInterest[symbol] = {
  //         sum: sumOpenInterestValue,
  //         volume: `${parseFloat(sumOpenInterest).toFixed(3)} ${sym}`,
  //         diffPercent: diffPercent ? `${diffPercent}%` : null,
  //         presentedSum,
  //         timestamp: DateTime.fromMillis(timestamp).toFormat("HH:mm:ss"),
  //       };
  //     });

  // };
}

export default OpenInterestService;
