import i18n from "../i18n";
import type BotService from "./BotService";
import MultiTradeQueue from "./MultiTradeQueue";
import { getBinanceFuturesURL, getBybitFuturesURL } from "../utils/constants";
import type { AdaptedMessage } from "../utils/adapters";

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
  private stoppedExchanges: string[] = [];

  constructor(config: Config, botService: BotService) {
    this.botService = botService;
    this.config = config;
    this.multiTradeQueue = new MultiTradeQueue(config.percentage);
  }

  public unsubscribeFromExchange = (exchange: string) => {
    this.stoppedExchanges.push(exchange);
  };

  public handleMessage = async (message: AdaptedMessage) => {
    const { pair, platform } = message;
    if (this.stoppedExchanges.includes(platform.toLowerCase())) return;
    const selectedPairs = this.config.selectedPairs;
    if (selectedPairs?.length && !selectedPairs?.includes(pair)) return;

    this.multiTradeQueue.addTrade(message);
    const checkResult = this.multiTradeQueue.checkAndLogSignificantPump(pair);

    if (checkResult !== null) {
      const lng = this.config.language;
      const { pair, startPrice, lastPrice, diff, totalPumps } = checkResult;

      const link =
        platform === "Binance"
          ? getBinanceFuturesURL(lng, pair)
          : getBybitFuturesURL(pair);

      const msg = i18n.t("pump-detected", {
        platform,
        pair: `[${pair}](${link})`,
        link,
        startPrice,
        lastPrice,
        diff,
        totalPumps,
        lng,
      });

      this.botService.sendMessage(this.config.chatId, msg, {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      });
    }
  };
}

export default PumpService;
