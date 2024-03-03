import BotService from "./services/BotService";
import BinanceAPIService from "./services/BinanceAPIService";
import { EVENTS } from "./utils/constants";

const binance = new BinanceAPIService();
const bot = new BotService();

binance.on(EVENTS.MESSAGE_RECEIVED, (message) => {
  bot.handleMessage(message);
});

binance.on(EVENTS.SYMBOLS_FETCHED, (symbols: string[]) => {
  bot.setAvailableSymbols(symbols);
});

bot.on(EVENTS.SUBSCRIPTIONS_UPDATED, (symbols: string[]) => {
  console.log("Subscriptions updated", symbols);
  binance.subscribeToStreams(symbols);
});
