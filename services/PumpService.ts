import type BotService from "./BotService";
import MultiTradeQueue from "./MultiTradeQueue";
import type { AdaptedMessage } from "../types";

type Config = {
  percentage: number;
  windowSize: number;
  chatIds: Set<string>;
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

  public handleMessage = async (message: AdaptedMessage) => {
    const { pair, platform } = message;

    this.multiTradeQueue.addTrade(message);
    const checkResult = this.multiTradeQueue.checkAndLogSignificantPump(pair);

    if (checkResult !== null) {
      this.botService.sendAlerts(
        checkResult,
        platform,
        Array.from(this.config.chatIds)
      );
    }
  };

  public addChatId = (chatId: string) => {
    this.config.chatIds.add(chatId);
  };

  public getChatIds = () => {
    return this.config.chatIds;
  };

  public removeChatId = (chatId: string) => {
    this.config.chatIds.delete(chatId);
  };

  public getPercentage = () => {
    return this.config.percentage;
  };

  public getWindowSize = () => {
    return this.config.windowSize;
  };
}

export default PumpService;
