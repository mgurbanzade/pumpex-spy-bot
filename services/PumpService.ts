import i18n from "../i18n";
import MultiTradeQueue from "./MultiTradeQueue";
import type TelegramBot from "node-telegram-bot-api";

type Config = {
  language: "en" | "ru" | "ua";
  percentage: number;
  chatId: number;
  selectedPairs: string[];
};

class PumpService {
  private bot: TelegramBot;
  private config: Config;
  private multiTradeQueue: MultiTradeQueue;

  constructor(config: Config, bot: any) {
    this.bot = bot;
    this.config = config;
    this.multiTradeQueue = new MultiTradeQueue(config.percentage);
  }

  public handleMessage = (message: any) => {
    const stream = message.stream; // stream name
    const pair = stream.split("@")[0].toUpperCase(); // pair name
    const selectedPairs = this.config.selectedPairs;

    if (selectedPairs?.length && !selectedPairs?.includes(pair)) return;
    const trade = message.data;

    this.multiTradeQueue.addTrade(pair, trade); // Добавляем сделку в соответствующую очередь
    const checkResult = this.multiTradeQueue.checkAndLogSignificantPump(pair);

    if (checkResult !== null) {
      const { pair, startPrice, lastPrice, diff } = checkResult;
      const message = i18n.t("pump-detected", {
        pair,
        startPrice,
        lastPrice,
        diff,
      });

      this.bot.sendMessage(this.config.chatId, message);
    }
  };
}

export default PumpService;
