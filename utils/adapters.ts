export type AdaptedMessage = {
  platform: "Binance" | "Bybit";
  pair: string;
  trade: {
    price: string;
    timestamp: number;
  };
};

export const adaptBinanceMessage = (message: any): AdaptedMessage => {
  const stream = message.stream;
  const pair = stream.split("@")[0].toUpperCase();
  const trade = {
    price: message.data.p,
    timestamp: message.data.T,
  };

  return { platform: "Binance", pair, trade };
};

export const adaptBybitMessage = (message: any): AdaptedMessage => {
  const data = message.data;
  const sortedData = data.sort((a: any, b: any) => a.T - b.T);
  const event = sortedData[0];

  const pair = event.s;
  const trade = {
    price: event.p,
    timestamp: event.T,
  };

  return { platform: "Bybit", pair, trade };
};
