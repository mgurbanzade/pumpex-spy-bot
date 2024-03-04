import BotService from "./services/BotService";
import BinanceAPIService from "./services/BinanceAPIService";
import { EVENTS } from "./utils/constants";
import BybitAPIService from "./services/BybitAPIService";
import { adaptBinanceMessage, adaptBybitMessage } from "./utils/adapters";

const binance = new BinanceAPIService();
const bybit = new BybitAPIService();
const bot = new BotService();

binance.on(EVENTS.MESSAGE_RECEIVED, (message) => {
  const adaptedMessage = adaptBinanceMessage(message);
  bot.handleMessage(adaptedMessage);
});

binance.on(EVENTS.SYMBOLS_FETCHED, (symbols: string[]) => {
  bot.setAvailableSymbols(symbols);
});

bybit.on(EVENTS.MESSAGE_RECEIVED, (message) => {
  if (!message || !message.data) return;
  const adaptedMessage = adaptBybitMessage(message);
  bot.handleMessage(adaptedMessage);
});

bybit.on(EVENTS.SYMBOLS_FETCHED, (symbols: string[]) => {
  bot.setAvailableSymbols(symbols);
});

bot.on(EVENTS.SUBSCRIPTIONS_UPDATED, (symbols: string[]) => {
  console.log("Subscriptions updated", symbols);
  bybit.subscribeToStreams(symbols);
  binance.subscribeToStreams(symbols);
});
