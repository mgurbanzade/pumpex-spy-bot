import Denque from "denque";
import {
  DEFAULT_MULTIPLIER,
  DEFAULT_WINDOW_SIZE_MS,
  type PlatformType,
} from "../utils/constants";
import type { AdaptedMessage, SignificantPumpInfo } from "../types";

interface Trade {
  price: number;
  timestamp: number;
  volume: number;
}

interface Queue {
  trades: Denque<Trade>;
  minPrice: number;
  totalVolume: number;
}

interface PriceChangeInfo {
  priceChange: number;
  volumeChange: number;
  minPrice: number;
  lastPrice: number;
}

class MultiTradeQueue {
  private queues: {
    [key: string]: Record<string, Queue>;
  } = {
    Binance: {},
    Bybit: {},
  };
  private lastSignificantPump: Record<
    string,
    { priceChange: number; timestamp: number }
  > = {};
  private readonly windowSize: number = DEFAULT_WINDOW_SIZE_MS; // 2.5 minutes
  private readonly percentage: number;

  constructor(percentage: number, windowSize: number) {
    this.percentage = percentage;
    this.windowSize = windowSize;
  }

  addTrade(message: AdaptedMessage): void {
    const { pair, trade, platform } = message;

    if (!this.queues[platform][pair]) {
      this.queues[platform][pair] = {
        trades: new Denque<Trade>(),
        minPrice: parseFloat(trade.price),
        totalVolume: trade.volume,
      };
      return;
    }

    const now = Date.now();
    const queue = this.queues[platform][pair].trades;
    const newTradePrice = parseFloat(trade.price);
    const newTradeVolume = trade.volume;

    this.queues[platform][pair].totalVolume += newTradeVolume;

    queue.push({
      price: newTradePrice,
      timestamp: trade.timestamp,
      volume: newTradeVolume,
    });

    let minPrice = Infinity;

    for (const trade of queue.toArray()) {
      if (trade.price < minPrice) {
        minPrice = trade.price;
      }
    }

    this.queues[platform][pair].minPrice = minPrice;

    while (
      queue.length > 0 &&
      now - (queue.peekFront() as Trade).timestamp > this.windowSize
    ) {
      const removedTrade = queue.shift() as Trade;
      this.queues[platform][pair].totalVolume -= removedTrade?.volume;

      if (
        removedTrade &&
        removedTrade.price === this.queues[platform][pair].minPrice
      ) {
        if (queue.length > 0) {
          this.queues[platform][pair].minPrice = queue
            .toArray()
            .reduce((min, trade) => Math.min(min, trade.price), Infinity);
        } else {
          this.queues[platform][pair].minPrice = newTradePrice;
        }
      }
    }
  }

  getCurrentPriceChange(pair: string, platform: PlatformType): PriceChangeInfo {
    const queue = this.queues[platform][pair]?.trades;
    if (!queue || queue.length === 0) {
      return { priceChange: 0, minPrice: 0, lastPrice: 0, volumeChange: 0 };
    }
    const minPrice = this.queues[platform][pair].minPrice;
    const lastTrade = queue.peekBack() as Trade;
    const priceChange = ((lastTrade.price - minPrice) / minPrice) * 100;

    const totalVolume = this.queues[platform][pair].totalVolume;
    const volumeChange =
      totalVolume > 0 ? (lastTrade.volume / totalVolume) * 100 : 0;

    return { priceChange, minPrice, lastPrice: lastTrade.price, volumeChange };
  }

  checkAndLogSignificantPump(
    pair: string,
    platform: PlatformType
  ): SignificantPumpInfo | null {
    const { priceChange, minPrice, lastPrice, volumeChange } =
      this.getCurrentPriceChange(pair, platform);
    const lastPump = this.lastSignificantPump[pair];
    const now = Date.now();
    const isPump = priceChange >= this.percentage;

    const isSignificant =
      !lastPump || priceChange >= lastPump.priceChange * DEFAULT_MULTIPLIER;

    if (
      isPump &&
      (isSignificant || now - (lastPump?.timestamp || 0) > this.windowSize)
    ) {
      this.lastSignificantPump[pair] = { priceChange, timestamp: now };

      return {
        pair: pair.toUpperCase(),
        minPrice,
        lastPrice,
        diff: priceChange.toFixed(2),
        volumeChange,
      };
    }

    return null;
  }
}

export default MultiTradeQueue;
