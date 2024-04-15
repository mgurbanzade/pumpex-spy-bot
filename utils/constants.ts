import { Language } from "@prisma/client";

// export const PAY_URL = "https://pumpex.app/payments/pay";
// export const PAY_URL = "https://0ee0-84-10-81-63.ngrok-free.app/payments/pay";
export const TRIAL_DAYS = 3;
export const HELP_MESSAGE_SCHEDULE = "35 15 * * *";
export const TRIAL_END_MESSAGE_SCHEDULE = "*/12 * * *";
export const CHANNEL_URL = "https://t.me/pumpexapp";
export const SUPPORT_CHAT_URL = "https://t.me/pumpexsupport";
export type PlatformType = "Binance" | "Bybit" | "Coinbase";

export const DEFAULT_SUBSCRIPTION_PRICE = 29;
export const DEFAULT_PAIRS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "TONUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "DOGE-USD",
  "BONK-USD",
];
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
