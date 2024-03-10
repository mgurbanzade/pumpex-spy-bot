import Queue, { type Job } from "bull";

import ConfigService from "./services/ConfigService";
import BotService from "./services/BotService";
import BinanceAPIService from "./services/BinanceAPIService";
import BybitAPIService from "./services/BybitAPIService";
import { EVENTS } from "./utils/constants";
import {
  adaptBinanceMessage,
  adaptBybitMessage,
  adaptCoinbaseMessage,
} from "./utils/adapters";
import CoinbaseAPIService from "./services/CoinbaseAPIService";
import type {
  BinanceAggTradeMessage,
  BybitTradeMessage,
  ChatConfig,
  CoinbaseTradeData,
} from "./types";

const messageQueue = new Queue("messageProcessing", {
  redis: {
    host: "localhost",
    port: 6379,
  },
});

const processMessage = async ({ data }: Job) => {
  const platform = data.platform;
  const message = data.message;

  const adaptDisaptcher = {
    binance: adaptBinanceMessage,
    bybit: adaptBybitMessage,
    coinbase: adaptCoinbaseMessage,
  };

  const adaptMessage =
    adaptDisaptcher[platform as "binance" | "bybit" | "coinbase"];
  const adaptedMessage = adaptMessage(message);
  bot.handleMessage(adaptedMessage);
  return;
};

messageQueue.process((job, done) => {
  processMessage(job)
    .then((result) => done(null, result))
    .catch((err) => done(err));
});

const addMessageToQueue = (
  message: BinanceAggTradeMessage | BybitTradeMessage | CoinbaseTradeData,
  platform: "binance" | "bybit" | "coinbase"
) => {
  messageQueue.add({
    message: message,
    platform,
  });
};

const bybit = new BybitAPIService();
const binance = new BinanceAPIService();
const coinbase = new CoinbaseAPIService();
const configService = new ConfigService();
const bot = new BotService(configService);

const binanceSymbolsPromise = new Promise((resolve) => {
  binance.on(EVENTS.SYMBOLS_FETCHED, (symbols: string[]) => {
    bot.setAvailableSymbols(symbols);
    resolve(symbols);
    console.log("binance symbols fetched", symbols.length);
  });
});

const bybitSymbolsPromise = new Promise((resolve) => {
  bybit.on(EVENTS.SYMBOLS_FETCHED, (symbols: string[]) => {
    bot.setAvailableSymbols(symbols);
    resolve(symbols);
    console.log("bybit symbols fetched", symbols.length);
  });
});

const coinbaseSymbolsPromise = new Promise((resolve) => {
  coinbase.on(EVENTS.SYMBOLS_FETCHED, (symbols: string[]) => {
    bot.setAvailableSymbols(symbols);
    resolve(symbols);
    console.log("coinbase symbols fetched", symbols.length);
  });
});

Promise.all([
  binanceSymbolsPromise,
  bybitSymbolsPromise,
  coinbaseSymbolsPromise,
]).then(async () => {
  await configService.initialize();
  await bot.initialize();
});

binance.on(EVENTS.MESSAGE_RECEIVED, (message) => {
  addMessageToQueue(message, "binance");
});

bybit.on(EVENTS.MESSAGE_RECEIVED, (message) => {
  if (!message || !message.data) return;
  addMessageToQueue(message, "bybit");
});

coinbase.on(EVENTS.MESSAGE_RECEIVED, (message) => {
  if (!message || message.type !== "match") return;
  addMessageToQueue(message, "coinbase");
});

bot.on(EVENTS.SUBSCRIPTIONS_UPDATED, (symbols: string[]) => {
  const availableBybitSymbols = bybit.getSymbols();
  const availableBinanceSymbols = binance.getSymbols();
  const availableCoinbaseSymbols = coinbase.getSymbols();

  const bybitSymbols = symbols.filter((symbol) =>
    availableBybitSymbols.includes(symbol)
  );

  const binanceSymbols = symbols.filter((symbol) =>
    availableBinanceSymbols.includes(symbol)
  );

  const coinbaseSymbols = symbols.filter((symbol) =>
    availableCoinbaseSymbols.includes(symbol)
  );

  bybit.subscribeToStreams(bybitSymbols);
  binance.subscribeToStreams(binanceSymbols);
  coinbase.subscribeToStreams(coinbaseSymbols);
});

configService.on(EVENTS.CONFIG_LOADED, (config: ChatConfig[]) => {
  const pairs = config
    ?.map((item: ChatConfig) => item.selectedPairs)
    .flat() as string[];

  const uniquePairs = [...new Set(pairs)];

  if (uniquePairs.length) {
    bot.setPairsToSubscribe(uniquePairs);
  }
});
