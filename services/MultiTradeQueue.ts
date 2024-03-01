class MultiTradeQueue {
  private queues: any = {};
  private lastSignificantPump: any = {};
  private windowSize: number = 300000; // 5 minutes
  private percentage: number = 5;

  constructor(percentage: number) {
    this.queues = {};
    this.lastSignificantPump = {};
    this.percentage = percentage;
  }

  addTrade(pair: string, trade: any) {
    if (!this.queues[pair]) {
      this.queues[pair] = { trades: [], startPrice: parseFloat(trade.p) };
      this.lastSignificantPump[pair] = { priceChange: 0, timestamp: 0 };
    }

    const queue = this.queues[pair].trades;
    const now = Date.now();
    queue.push({ price: parseFloat(trade.p), timestamp: trade.T });

    // Очистка устаревших сделок и обновление начальной цены, если требуется
    while (queue.length > 0 && now - queue[0].timestamp > this.windowSize) {
      this.queues[pair].startPrice =
        queue[1]?.price || this.queues[pair].startPrice;
      queue.shift();
    }
  }

  getCurrentPriceChange(pair: string) {
    const queue = this.queues[pair].trades;
    if (queue.length === 0)
      return { priceChange: 0, startPrice: 0, lastPrice: 0 };
    const startPrice = this.queues[pair].startPrice;
    const lastTradePrice = queue[queue.length - 1].price;
    const priceChange = ((lastTradePrice - startPrice) / startPrice) * 100;
    return { priceChange, startPrice, lastPrice: lastTradePrice };
  }

  checkAndLogSignificantPump(pair: string) {
    const { priceChange, startPrice, lastPrice } =
      this.getCurrentPriceChange(pair);
    const lastPump = this.lastSignificantPump[pair];
    const now = Date.now();

    const isPump = priceChange >= this.percentage;
    const isSignificant =
      priceChange >= lastPump.priceChange + this.percentage / 2;

    if (
      isPump &&
      (isSignificant || now - lastPump.timestamp > this.windowSize)
    ) {
      console.log(
        `Significant pump detected on ${pair}: Current Change: ${priceChange.toFixed(
          2
        )}%`
      );

      this.lastSignificantPump[pair] = {
        priceChange,
        timestamp: now,
      };

      return {
        pair: pair.toUpperCase(),
        startPrice,
        lastPrice,
        diff: priceChange.toFixed(2),
      };
    } else {
      return null;
    }
  }
}

export default MultiTradeQueue;
