import EventEmitter from "events";
import TelegramBot from "node-telegram-bot-api";
import omit from "lodash.omit";
import isEqual from "lodash.isequal";
import PumpService from "./PumpService";

import type {
  Message,
  CallbackQuery,
  SendMessageOptions,
} from "node-telegram-bot-api";
import {
  handleCallbackQuery,
  handleStart,
  handleStop,
} from "../utils/eventHandlers";
import { sendSettingsOptions } from "../utils/keyboardUtils";
import { handleIncludePairs } from "../utils/textUtils";
import { EVENTS } from "../utils/constants";

type BotConfig = {
  language: "en" | "ru" | "ua";
  percentage: number;
  selectedPairs: string[];
  isIncludePairs: boolean;
};

export default class BotService extends EventEmitter {
  public bot: TelegramBot;
  private chatConfig: { [key: string]: BotConfig } = {};
  private pumpServices: { [key: string]: PumpService };
  private availableSymbols: string[];
  private pairsToSubscribe: string[] = [];

  constructor() {
    super();
    this.availableSymbols = [];
    this.pumpServices = {};
    this.bot = new TelegramBot(process.env.TELEGRAM_API_TOKEN as string, {
      polling: true,
    });

    this.bot.onText(/\/start/, (msg) => handleStart(msg, this));
    this.bot.onText(/\/stop/, (msg) => handleStop(msg, this));
    this.bot.on("callback_query", (cbq: CallbackQuery) =>
      handleCallbackQuery(cbq, this)
    );

    this.bot.onText(/\/settings/, (msg) => sendSettingsOptions(msg, this));
    this.bot.onText(/([A-Z]{3,})+/, (msg) => {
      const config = this.chatConfig[msg.chat.id];
      if (!config) return;

      if (config.isIncludePairs) {
        return handleIncludePairs(msg, this);
      }
    });
  }

  public handleMessage = (message: Message) => {
    if (Object.keys(this.pumpServices).length > 0) {
      for (let key in this.pumpServices) {
        const pumpService = this.pumpServices[key];

        pumpService.handleMessage(message);
      }
    }
  };

  public updateChatConfig(chatId: number, config: Partial<BotConfig>) {
    this.chatConfig[chatId] = { ...this.chatConfig[chatId], ...config };
  }

  public removeChatConfig(chatId: number) {
    this.chatConfig = omit(this.chatConfig, chatId);
  }

  public getChatConfig(chatId: number): BotConfig {
    return this.chatConfig[chatId];
  }

  public setNewPumpService(chatId: number, selectedPairs: string[] = []) {
    const config = this.getChatConfig(chatId);
    const pumpConfig = { ...config, chatId, selectedPairs };
    this.pumpServices[chatId] = new PumpService(pumpConfig, this);
  }

  public removePumpService(chatId: number) {
    this.pumpServices = omit(this.pumpServices, chatId);
  }

  public setAvailableSymbols(symbols: string[]) {
    this.availableSymbols = symbols;
  }

  public getAvailableSymbols() {
    return this.availableSymbols;
  }

  public setPairsToSubscribe(pairs: string[]) {
    const uniquePairs = new Set([...this.pairsToSubscribe, ...pairs]);
    const uniquePairsArray = Array.from(uniquePairs);

    if (isEqual(uniquePairsArray, this.pairsToSubscribe)) return;

    this.pairsToSubscribe = Array.from(uniquePairs);
    this.emit(EVENTS.SUBSCRIPTIONS_UPDATED, this.pairsToSubscribe);
  }

  public sendMessage(
    chatId: number,
    message: string,
    options?: SendMessageOptions
  ) {
    this.bot.sendMessage(chatId, message, options);
  }
}
