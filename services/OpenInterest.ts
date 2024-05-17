import Binance from "node-binance-api";
import { RestClientV5 } from "bybit-api";
import { OPEN_INTEREST_INTERVAL, type PlatformType } from "../utils/constants";
import Bottleneck from "bottleneck";

interface OpenInterestResult {
  symbol: string;
  openInterest: number;
}

type OpenInterestType = {
  current: OpenInterestResult;
  previous: OpenInterestResult | null;
  diff: number | null;
  diffPercent: number | null;
};

type OpenInterestData = {
  [K in PlatformType]: {
    [key: string]: OpenInterestType;
  };
};
class OpenInterestService {
  private data: OpenInterestData = {
    Binance: {},
    Bybit: {},
    Coinbase: {},
  };
  private symbols: {
    Binance: string[];
    Bybit: string[];
    Coinbase: string[];
  };
  private binance: Binance;
  private bybit: RestClientV5;
  private binanceLimiter: Bottleneck;
  private bybitLimiter: Bottleneck;
  private updateInterval: NodeJS.Timer | null = null;

  constructor() {
    this.symbols = {
      Binance: [],
      Bybit: [],
      Coinbase: [],
    };
    this.binance = new Binance().options({
      APIKEY: process.env.BINANCE_API_KEY,
      APISECRET: process.env.BINANCE_API_SECRET,
      useServerTime: true,
    });

    this.bybit = new RestClientV5();
    this.binanceLimiter = new Bottleneck({
      reservoir: 19,
      reservoirRefreshAmount: 19,
      reservoirRefreshInterval: 1000,
      maxConcurrent: 1,
      minTime: 40,
    });

    this.bybitLimiter = new Bottleneck({
      reservoir: 9,
      reservoirRefreshAmount: 9,
      reservoirRefreshInterval: 1000,
      maxConcurrent: 1,
      minTime: 40,
    });
  }

  public startPolling(symbols: string[], platform: PlatformType): void {
    this.symbols[platform] = symbols;
    this.stopPolling();
    this.fetchOpenInterestForAllSymbols();
    this.updateInterval = setInterval(() => {
      this.fetchOpenInterestForAllSymbols();
    }, OPEN_INTEREST_INTERVAL) as any;
  }

  public stopPolling(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private async fetchOpenInterestForAllSymbols(): Promise<void> {
    const binancePromises = this.symbols["Binance"].map((symbol) =>
      this.fetchBinanceOI(symbol)
    );

    const bybitPromises = this.symbols["Bybit"].map((symbol) =>
      this.fetchBybitOI(symbol)
    );

    const binanceResults = await Promise.all(binancePromises);
    const bybitResults = await Promise.all(bybitPromises);

    const filteredBinance = binanceResults.filter((res) => res !== null);
    const filteredBybit = bybitResults.filter((res) => res !== null);

    [...filteredBinance].forEach((res) => this.handleResult(res, "Binance"));
    [...filteredBybit].forEach((res) => this.handleResult(res, "Bybit"));
  }

  private calculateDiffPercent(symbol: string, platform: PlatformType): void {
    const symbolData = this.data[platform][symbol];

    if (symbolData.previous) {
      const currentInterest = symbolData.current.openInterest;
      const previousInterest = symbolData.previous.openInterest;
      const difference = currentInterest - previousInterest;
      const diffPercent = (difference / previousInterest) * 100;
      symbolData.diff = difference;
      symbolData.diffPercent = parseFloat(diffPercent.toFixed(3));
    } else {
      symbolData.diffPercent = null;
    }

    this.data[platform][symbol] = symbolData;
  }

  private handleResult(
    result: OpenInterestResult | null,
    platform: PlatformType
  ): void {
    if (result) {
      const { symbol } = result;

      if (this.data[platform][symbol]) {
        this.data[platform][symbol].previous =
          this.data[platform][symbol].current;
        this.data[platform][symbol].current = result;

        this.calculateDiffPercent(symbol, platform);
      } else {
        this.data[platform][symbol] = {
          current: result,
          previous: null,
          diff: null,
          diffPercent: null,
        };
      }
    }
  }

  private async fetchBinanceOI(
    symbol: string
  ): Promise<OpenInterestResult | null> {
    const wrappedFunc = this.binanceLimiter.wrap(async () => {
      try {
        const openInterest = await this.binance.futuresOpenInterest(symbol);
        if (!openInterest) return null;

        return {
          symbol,
          openInterest: parseFloat(openInterest),
        };
      } catch (error) {
        console.log(
          "BINANCE: Error fetching open interest for",
          symbol,
          ":",
          error
        );
        return null;
      }
    });

    return wrappedFunc();
  }

  async fetchBybitOI(symbol: string): Promise<OpenInterestResult | null> {
    const wrappedFunc = this.bybitLimiter.wrap(async () => {
      try {
        const response = await this.bybit.getOpenInterest({
          symbol,
          category: "linear",
          intervalTime: "5min",
        });

        const result = response.result?.list?.[0];
        if (!result) return null;

        return {
          symbol,
          openInterest: Number(result.openInterest),
        };
      } catch (error) {
        console.log(
          "BYBIT: Error fetching open interest for",
          symbol,
          ":",
          error
        );

        return null;
      }
    });

    return wrappedFunc();
  }

  public getData(): OpenInterestData {
    return this.data;
  }

  public getOIForSymbol(
    symbol: string,
    platform: PlatformType
  ): OpenInterestType | null {
    return this.data[platform][symbol] || null;
  }
}

export default OpenInterestService;
