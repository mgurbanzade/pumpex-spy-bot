import i18n from "../i18n";
import type BotService from "./BotService";
import MultiTradeQueue from "./MultiTradeQueue";
import { getBinanceFuturesURL } from "../utils/constants";

type Config = {
  language: "en" | "ru" | "ua";
  percentage: number;
  chatId: number;
  selectedPairs: string[];
};

class PumpService {
  private botService: BotService;
  private config: Config;
  private multiTradeQueue: MultiTradeQueue;

  constructor(config: Config, botService: BotService) {
    this.botService = botService;
    this.config = config;
    this.multiTradeQueue = new MultiTradeQueue(config.percentage);
  }

  public handleMessage = async (message: any) => {
    const stream = message.stream;
    const pair = stream.split("@")[0].toUpperCase();
    const selectedPairs = this.config.selectedPairs;
    if (selectedPairs?.length && !selectedPairs?.includes(pair)) return;
    const trade = message.data;

    this.multiTradeQueue.addTrade(pair, trade);
    const checkResult = this.multiTradeQueue.checkAndLogSignificantPump(pair);

    if (checkResult !== null) {
      const lng = this.config.language;
      const { pair, startPrice, lastPrice, diff, totalPumps } = checkResult;
      const link = getBinanceFuturesURL(lng, pair);

      const message = i18n.t("pump-detected", {
        pair: `[${pair}](${link})`,
        link,
        startPrice,
        lastPrice,
        diff,
        totalPumps,
        lng,
      });

      this.botService.sendMessage(this.config.chatId, message, {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      });
    }
  };
}

export default PumpService;
