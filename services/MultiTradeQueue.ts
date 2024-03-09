import Denque from "denque";
import { DEFAULT_MULTIPLIER, DEFAULT_WINDOW_SIZE_MS } from "../utils/constants";
import type { AdaptedMessage } from "../types";

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

interface SignificantPumpInfo {
  pair: string;
  minPrice: number;
  lastPrice: number;
  diff: string;
  totalPumps: number;
  volumeChange: number;
}

class MultiTradeQueue {
  private queues: Record<string, Queue> = {};
  private lastSignificantPump: Record<
    string,
    { priceChange: number; timestamp: number }
  > = {};
  private pumpsCount: Record<string, number> = {};
  private readonly windowSize: number = DEFAULT_WINDOW_SIZE_MS; // 5 minutes
  private readonly percentage: number;

  constructor(percentage: number, windowSize: number) {
    this.percentage = percentage;
    this.windowSize = windowSize;
  }

  addTrade(message: AdaptedMessage): void {
    const { pair, trade } = message;

    if (!this.queues[pair]) {
      this.queues[pair] = {
        trades: new Denque<Trade>(),
        minPrice: parseFloat(trade.price),
        totalVolume: trade.volume,
      };
      return;
    }

    const now = Date.now();
    const queue = this.queues[pair].trades;
    const newTradePrice = parseFloat(trade.price);
    const newTradeVolume = trade.volume;

    this.queues[pair].totalVolume += newTradeVolume;

    queue.push({
      price: newTradePrice,
      timestamp: trade.timestamp,
      volume: newTradeVolume,
    });

    this.queues[pair].minPrice = Math.min(
      this.queues[pair].minPrice,
      newTradePrice
    );

    while (
      queue.length > 0 &&
      now - (queue.peekFront() as Trade).timestamp > this.windowSize
    ) {
      const removedTrade = queue.shift();

      if (removedTrade && removedTrade.price === this.queues[pair].minPrice) {
        const prices = queue.toArray().map((trade) => trade.price);
        this.queues[pair].minPrice = Math.min(...prices);
      }
    }
  }

  getCurrentPriceChange(pair: string): PriceChangeInfo {
    const queue = this.queues[pair]?.trades;
    if (!queue || queue.length === 0) {
      return { priceChange: 0, minPrice: 0, lastPrice: 0, volumeChange: 0 };
    }
    const minPrice = this.queues[pair].minPrice;
    const lastTrade = queue.peekBack() as Trade;
    const priceChange = ((lastTrade.price - minPrice) / minPrice) * 100;

    const totalVolume = this.queues[pair].totalVolume;
    const volumeChange =
      totalVolume > 0 ? (lastTrade.volume / totalVolume) * 100 : 0;

    return { priceChange, minPrice, lastPrice: lastTrade.price, volumeChange };
  }

  checkAndLogSignificantPump(pair: string): SignificantPumpInfo | null {
    const { priceChange, minPrice, lastPrice, volumeChange } =
      this.getCurrentPriceChange(pair);
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
      this.pumpsCount[pair] = (this.pumpsCount[pair] || 0) + 1;

      return {
        pair: pair.toUpperCase(),
        minPrice,
        lastPrice,
        diff: priceChange.toFixed(2),
        totalPumps: this.pumpsCount[pair],
        volumeChange,
      };
    }

    return null;
  }
}

export default MultiTradeQueue;
