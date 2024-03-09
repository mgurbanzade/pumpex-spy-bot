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
import type { ChatConfig } from "./types";

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
  const adaptedMessage = adaptBinanceMessage(message);
  bot.handleMessage(adaptedMessage);
});

bybit.on(EVENTS.MESSAGE_RECEIVED, (message) => {
  if (!message || !message.data) return;
  const adaptedMessage = adaptBybitMessage(message);
  bot.handleMessage(adaptedMessage);
});

coinbase.on(EVENTS.MESSAGE_RECEIVED, (message) => {
  if (!message || message.type !== "match") return;
  const adaptedMessage = adaptCoinbaseMessage(message);
  bot.handleMessage(adaptedMessage);
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
