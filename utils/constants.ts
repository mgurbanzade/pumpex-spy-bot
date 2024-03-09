import { Language } from "@prisma/client";

export type PlatformType = "Binance" | "Bybit" | "Coinbase";

export const DEFAULT_LANGUAGE = Language.EN;
export const DEFAULT_PERCENTAGE = 0.5;
export const DEFAULT_MULTIPLIER = 1.25;

export const MIN_WINDOW_SIZE_MS = 30000;
export const DEFAULT_WINDOW_SIZE_MS = 150000;
export const MAX_WINDOW_SIZE_MS = 600000;

export const MIN_PERCENTAGE = 0.1;
export const MAX_PERCENTAGE = 100;

export const EVENTS = {
  SYMBOLS_FETCHED: "SYMBOLS_FETCHED",
  MESSAGE_RECEIVED: "MESSAGE_RECEIVED",
  SUBSCRIPTIONS_UPDATED: "SUBSCRIPTIONS_UPDATED",
  CONFIG_LOADED: "CONFIG_LOADED",
};

export const DISABLED_PAIRS = [
  "EURC-USD",
  "MOBILE/USD",
  "STRK/USD",
  "RENDER/USD",
  "cbETH-USD",
];

export const getBinanceFuturesURL = (lang: string, pair: string) => {
  return `https://binance.com/${lang}/futures/${pair}`;
};

export const getBybitFuturesURL = (pair: string) => {
  return `https://www.bybit.com/trade/usdt/${pair}`;
};

export const getCoinbaseURL = (pair: string) => {
  return `https://pro.coinbase.com/trade/${pair}`;
};
