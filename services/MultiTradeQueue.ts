interface Trade {
  price: number;
  timestamp: number;
}

interface Queue {
  trades: Trade[];
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
}

class MultiTradeQueue {
  private queues: Record<string, Queue> = {};
  private lastSignificantPump: Record<
    string,
    { priceChange: number; timestamp: number }
  > = {};
  private readonly windowSize: number = 300000; // 5 minutes
  private readonly percentage: number;

  constructor(percentage: number) {
    this.percentage = percentage;
  }

  addTrade(pair: string, trade: { p: string; T: number }): void {
    if (!this.queues[pair]) {
      this.queues[pair] = { trades: [], startPrice: parseFloat(trade.p) };
    }

    const now = Date.now();
    const queue = this.queues[pair].trades;
    queue.push({ price: parseFloat(trade.p), timestamp: trade.T });

    while (queue.length > 0 && now - queue[0].timestamp > this.windowSize) {
      queue.shift();
    }

    if (queue.length > 0) {
      this.queues[pair].startPrice = queue[0].price;
    }
  }

  getCurrentPriceChange(pair: string): PriceChangeInfo {
    const queue = this.queues[pair]?.trades;
    if (!queue || queue.length === 0) {
      return { priceChange: 0, startPrice: 0, lastPrice: 0 };
    }
    const startPrice = this.queues[pair].startPrice;
    const lastTradePrice = queue[queue.length - 1].price;
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
      !lastPump || priceChange >= lastPump.priceChange + this.percentage / 2;

    if (
      isPump &&
      (isSignificant || now - (lastPump?.timestamp || 0) > this.windowSize)
    ) {
      this.lastSignificantPump[pair] = { priceChange, timestamp: now };

      return {
        pair: pair.toUpperCase(),
        startPrice,
        lastPrice,
        diff: priceChange.toFixed(2),
      };
    }

    return null;
  }
}

export default MultiTradeQueue;
