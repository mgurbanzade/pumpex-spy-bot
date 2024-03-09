import type {
  BinanceAggTradeMessage,
  BybitTradeData,
  BybitTradeMessage,
  CoinbaseTradeData,
  AdaptedMessage,
} from "../types";

export const adaptBinanceMessage = (
  message: BinanceAggTradeMessage
): AdaptedMessage => {
  const stream = message.stream;
  const pair = stream.split("@")[0].toUpperCase();
  const trade = {
    price: message.data.p,
    timestamp: message.data.T,
    volume: parseFloat(message.data.q) * parseFloat(message.data.p),
  };

  return { platform: "Binance", pair, trade };
};

export const adaptBybitMessage = (
  message: BybitTradeMessage
): AdaptedMessage => {
  const data = message.data;
  const sortedData = data.sort(
    (a: BybitTradeData, b: BybitTradeData) => a.T - b.T
  );
  const event = sortedData[0];

  const pair = event.s;
  const trade = {
    price: event.p,
    timestamp: event.T,
    volume: parseFloat(event.v) * parseFloat(event.p),
  };

  return { platform: "Bybit", pair, trade };
};

export const adaptCoinbaseMessage = (
  message: CoinbaseTradeData
): AdaptedMessage => {
  const pair = message.product_id;
  const trade = {
    price: message.price,
    timestamp: new Date(message.time).getTime(),
    volume: parseFloat(message.size) * parseFloat(message.price),
  };

  return { platform: "Coinbase", pair, trade };
};
