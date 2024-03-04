import Denque from "denque";
import { DEFAULT_MULTIPLIER, WINDOW_SIZE_MS } from "../utils/constants";
import type { AdaptedMessage } from "../utils/adapters";

interface Trade {
  price: number;
  timestamp: number;
}

interface Queue {
  trades: Denque<Trade>;
  startPrice: number;
}

interface PriceChangeInfo {
  priceChange: number;
  startPrice: number;
  lastPrice: number;
}

interface SignificantPumpInfo {
  pair: string;
  startPrice: number;
  lastPrice: number;
  diff: string;
  totalPumps: number;
}

class MultiTradeQueue {
  private queues: Record<string, Queue> = {};
  private lastSignificantPump: Record<
    string,
    { priceChange: number; timestamp: number }
  > = {};
  private pumpsCount: Record<string, number> = {};
  private readonly windowSize: number = WINDOW_SIZE_MS; // 5 minutes
  private readonly percentage: number;

  constructor(percentage: number) {
    this.percentage = percentage;
  }

  addTrade(message: AdaptedMessage): void {
    const { pair, trade } = message;

    if (!this.queues[pair]) {
      this.queues[pair] = {
        trades: new Denque<Trade>(),
        startPrice: parseFloat(trade.price),
      };
    }

    const now = Date.now();
    const queue = this.queues[pair].trades;
    const newTradePrice = parseFloat(trade.price);
    queue.push({ price: newTradePrice, timestamp: trade.timestamp });

    while (
      queue.length > 0 &&
      now - (queue.peekFront() as Trade).timestamp > this.windowSize
    ) {
      queue.shift();
    }

    if (newTradePrice < this.queues[pair].startPrice || queue.length === 1) {
      this.queues[pair].startPrice = newTradePrice;
    }

    if (
      queue.length > 0 &&
      this.queues[pair].startPrice !== (queue.peekFront() as Trade).price
    ) {
      this.queues[pair].startPrice = (queue.peekFront() as Trade).price;
    }
  }

  getCurrentPriceChange(pair: string): PriceChangeInfo {
    const queue = this.queues[pair]?.trades;
    if (!queue || queue.length === 0) {
      return { priceChange: 0, startPrice: 0, lastPrice: 0 };
    }
    const startPrice = this.queues[pair].startPrice;
    const lastTrade = queue.peekBack() as Trade;
    const lastTradePrice = lastTrade.price;
    const priceChange = ((lastTradePrice - startPrice) / startPrice) * 100;
    return { priceChange, startPrice, lastPrice: lastTradePrice };
  }

  checkAndLogSignificantPump(pair: string): SignificantPumpInfo | null {
    const { priceChange, startPrice, lastPrice } =
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
        startPrice,
        lastPrice,
        diff: priceChange.toFixed(2),
        totalPumps: this.pumpsCount[pair],
      };
    }

    return null;
  }
}

export default MultiTradeQueue;
