import Denque from "denque";
import { DEFAULT_MULTIPLIER, WINDOW_SIZE_MS } from "../utils/constants";

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
  private pumpsCount: Record<string, number> = {}; // Новый словарь для подсчета значительных пампов
  private readonly windowSize: number = WINDOW_SIZE_MS; // 5 minutes
  private readonly percentage: number;

  constructor(percentage: number) {
    this.percentage = percentage;
  }

  addTrade(pair: string, trade: { p: string; T: number }): void {
    if (!this.queues[pair]) {
      this.queues[pair] = {
        trades: new Denque<Trade>(),
        startPrice: parseFloat(trade.p),
      };
    }

    const now = Date.now();
    const queue = this.queues[pair].trades;
    const newTradePrice = parseFloat(trade.p);
    queue.push({ price: newTradePrice, timestamp: trade.T });

    // Эффективное удаление устаревших торговых операций из начала очереди с Denque
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
