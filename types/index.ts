import {
  ChatState as PrismaChatState,
  Language as PrismaLanguage,
} from "@prisma/client";

export type ChatConfig = {
  firstName: string | null;
  username: string | null;
  percentage: number;
  selectedPairs: string[];
  stoppedExchanges: string[];
  windowSize: number;
  state: ChatState | PrismaChatState;
  language: Language | PrismaLanguage;
  paidUntil: Date | string | null;
  trialUntil: Date | string | null;
};

export enum Language {
  EN = "EN",
  RU = "RU",
  UA = "UA",
}

export enum ChatState {
  START = "START",
  SETTINGS = "SETTINGS",
  SELECT_PAIRS = "SELECT_PAIRS",
  SELECT_PERCENTAGE = "SELECT_PERCENTAGE",
  SELECT_WINDOW_SIZE = "SELECT_WINDOW_SIZE",
  CHANGE_LANGUAGE = "CHANGE_LANGUAGE",
  UNSUBSCRIBE_EXCHANGES = "UNSUBSCRIBE_EXCHANGES",
  SUBSCRIBE = "SUBSCRIBE",
  SEARCHING = "SEARCHING",
  STOPPED = "STOPPED",
  SUPPORT = "SUPPORT",
}

export type AdaptedMessage = {
  platform: "Binance" | "Bybit" | "Coinbase";
  pair: string;
  trade: {
    volume: number;
    price: string;
    timestamp: number;
  };
};

type BinanceAggTradeData = {
  e: "aggTrade" | string; // Event type
  E: number; // Event time
  s: string; // Symbol
  a: number; // Aggregate trade ID
  p: string; // Price
  q: string; // Quantity
  f: number; // First trade ID
  l: number; // Last trade ID
  T: number; // Trade time
  m: boolean; // Is the buyer the market maker?
  M: boolean; // Ignore
};

export type BinanceAggTradeMessage = {
  stream: string; // Stream name
  data: BinanceAggTradeData;
};

export type BybitTradeData = {
  T: number;
  s: string;
  S: string;
  v: string;
  p: string;
  L: string;
  i: string;
  BT: boolean;
};

export type BybitTradeMessage = {
  topic: string;
  type: string;
  ts: number;
  data: BybitTradeData[];
};

export type CoinbaseTradeData = {
  type: string;
  trade_id: number;
  maker_order_id: string;
  taker_order_id: string;
  side: string;
  size: string;
  price: string;
  product_id: string;
  sequence: number;
  time: string;
};

export type WalletWebhookMessage = {
  eventId: number;
  eventDateTime: string;
  payload: {
    id: number;
    number: string;
    customData: string;
    externalId: string;
    orderAmount: Record<string, any>;
    selectedPaymentOption: Record<string, any>;
    orderCompletedDateTime: string;
  };
  type: string;
};
