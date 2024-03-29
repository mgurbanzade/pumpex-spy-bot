import i18n from "../i18n";
import type BotService from "./BotService";
import MultiTradeQueue from "./MultiTradeQueue";
import {
  getBinanceFuturesURL,
  getBybitFuturesURL,
  getCoinbaseURL,
  type PlatformType,
} from "../utils/constants";
import type { AdaptedMessage } from "../types";
import type { Language } from "@prisma/client";

type Config = {
  language: Language;
  percentage: number;
  windowSize: number;
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
    this.multiTradeQueue = new MultiTradeQueue(
      config.percentage,
      config.windowSize
    );
  }

  public getPriceInFloatingPoint = (price: number, platform: PlatformType) => {
    const digitDispatcher = {
      Binance: 6,
      Bybit: 5,
      Coinbase: 6,
    };

    const digit = digitDispatcher[platform];
    return price <= 0.09 ? price.toFixed(digit) : price.toFixed(3);
  };

  public handleMessage = async (message: AdaptedMessage) => {
    const { pair, platform } = message;
    const selectedPairs = this.config.selectedPairs;
    if (selectedPairs?.length && !selectedPairs?.includes(pair)) return;

    this.multiTradeQueue.addTrade(message);
    const checkResult = this.multiTradeQueue.checkAndLogSignificantPump(pair);

    if (checkResult !== null) {
      const lng = this.config.language;
      const { pair, minPrice, lastPrice, diff, volumeChange } = checkResult;

      const currency = platform === "Coinbase" ? pair.split("-")[1] : "USDT";

      const link =
        platform === "Binance"
          ? getBinanceFuturesURL(lng, pair)
          : platform === "Bybit"
          ? getBybitFuturesURL(pair)
          : getCoinbaseURL(pair);

      const msg = i18n.t("pump-detected", {
        platform,
        currency,
        pair: `[${pair}](${link})`,
        link,
        startPrice: this.getPriceInFloatingPoint(minPrice, platform),
        lastPrice: this.getPriceInFloatingPoint(lastPrice, platform),
        volumeChange: this.getPriceInFloatingPoint(volumeChange, platform),
        diff,
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
