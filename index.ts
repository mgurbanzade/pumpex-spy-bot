import BotService from "./services/BotService";
import BinanceAPIService from "./services/BinanceAPIService";

const binance = new BinanceAPIService();
const bot = new BotService();

binance.on("messageReceived", (message) => {
  bot.handleMessage(message);
});

binance.on("symbolsFetched", (symbols: string[]) => {
  bot.setAvailableSymbols(symbols);
});
