export const DEFAULT_LANGUAGE = "en";
export const DEFAULT_PERCENTAGE = 1;
export const DEFAULT_MULTIPLIER = 1.25;

export const WINDOW_SIZE_MS = 150000;

export const MIN_PERCENTAGE = 0.1;
export const MAX_PERCENTAGE = 100;

export const PERCENTAGES = [
  "0.5%",
  "1%",
  "1.5%",
  "2%",
  "2.5%",
  "3%",
  "3.5%",
  "5%",
  "10%",
];

export const EVENTS = {
  SYMBOLS_FETCHED: "SYMBOLS_FETCHED",
  MESSAGE_RECEIVED: "MESSAGE_RECEIVED",
  SUBSCRIPTIONS_UPDATED: "SUBSCRIPTIONS_UPDATED",
};

export const getBinanceFuturesURL = (lang: string, pair: string) => {
  return `https://binance.com/${lang}/futures/${pair}`;
};
