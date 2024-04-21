import { DateTime } from "luxon";
import EventEmitter from "events";
import TelegramBot from "node-telegram-bot-api";
import PumpService from "./PumpService";
import i18n from "../i18n";
import type {
  ChatConfig,
  SignificantPumpInfo,
  WalletWebhookMessage,
} from "../types";

import type {
  Message,
  CallbackQuery,
  SendMessageOptions,
} from "node-telegram-bot-api";
import {
  handleSelectPairsInput,
  handlePercentageInput,
  handleCallbackQuery,
  handleStart,
  handleStop,
  handleSelectWindowSizeInput,
  handleHelp,
} from "../utils/handlers";

import { EVENTS } from "../utils/constants";
import {
  sendHelpMessage,
  sendKnowledgeBase,
  sendNegativeIdMessage,
  sendPaymentSuccess,
  sendSettingsOptions,
} from "../utils/senders";
import type ConfigService from "./ConfigService";
import { ChatState, type AdaptedMessage } from "../types";
import type { Prisma } from "@prisma/client";
import {
  fetchInvoice,
  isSubscriptionValid,
  isTrialValid,
} from "../utils/payments";
import Bottleneck from "bottleneck";
import {
  getUniqueConfigs,
  isNegativeChatId,
  getBinanceFuturesURL,
  getBybitFuturesURL,
  getCoinbaseURL,
  getPriceInFloatingPoint,
} from "../utils/helpers";
import { type PlatformType } from "../utils/constants";
import { FORBIDDEN_ERROR, NOT_FOUND } from "../utils/errors";

export default class BotService extends EventEmitter {
  private limiter: Bottleneck;
  public config: ConfigService;
  public bot: TelegramBot;
  private pumpServices: { [key: string]: PumpService };
  private availableSymbols: string[];
  private pairsToSubscribe: string[] = [];

  constructor(config: ConfigService) {
    super();
    this.config = config;
    this.availableSymbols = [];
    this.pumpServices = {};

    this.limiter = new Bottleneck({
      reservoir: 29,
      reservoirRefreshAmount: 29,
      reservoirRefreshInterval: 1000,
      maxConcurrent: 1,
      minTime: 40,
    });

    this.bot = new TelegramBot(process.env.TELEGRAM_API_PROD_TOKEN as string, {
      polling: true,
    });

    this.bot.onText(/\/start/, (msg) => handleStart(msg, this));
    this.bot.onText(/\/help/, (msg) => handleHelp(msg, this));
    this.bot.onText(/\/knowledge/, (msg: Message) =>
      sendKnowledgeBase(msg, this, "send")
    );
    this.bot.onText(/\/stop/, (msg) => handleStop(msg, this));
    this.bot.onText(/\/settings/, (msg: Message) => {
      if (isNegativeChatId(msg)) {
        return sendNegativeIdMessage(msg, this);
      }
      const config = this.getChatConfig(String(msg.chat.id));
      return config ? sendSettingsOptions(msg, this) : handleStart(msg, this);
    });

    this.bot.on("callback_query", (cbq: CallbackQuery) =>
      handleCallbackQuery(cbq, this)
    );

    this.bot.on("message", (msg: Message) => {
      if (isNegativeChatId(msg)) {
        return sendNegativeIdMessage(msg, this);
      }

      const config = this.getChatConfig(String(msg.chat.id));
      if (!config) return;

      if (config.state === ChatState.SELECT_PERCENTAGE) {
        return handlePercentageInput(msg, this);
      }

      if (config.state === ChatState.SELECT_WINDOW_SIZE) {
        return handleSelectWindowSizeInput(msg, this);
      }
    });

    this.bot.onText(/([A-Z]{3,})+/, (msg) => {
      if (isNegativeChatId(msg)) {
        return sendNegativeIdMessage(msg, this);
      }

      const config = this.getChatConfig(String(msg.chat.id));
      if (!config) return;

      if (config.state === ChatState.SELECT_PAIRS) {
        return handleSelectPairsInput(msg, this);
      }
    });
  }

  public async initialize() {
    const chatConfigs = this.config.getAll();
    const uniqConfig = getUniqueConfigs(chatConfigs);

    console.log(uniqConfig);

    for (const configKey in uniqConfig) {
      const [percentageStr, windowSizeStr] = configKey.split(":");
      const percentage = parseFloat(percentageStr);
      const windowSize = parseInt(windowSizeStr);

      this.pumpServices[configKey] = new PumpService(
        { percentage, windowSize, chatIds: new Set(uniqConfig[configKey]) },
        this
      );
    }

    console.log("-------- BOT SERVICE INITIALIZED --------");
    console.log(
      "ACTIVE PUMP SERVICES: ",
      Object.keys(this.pumpServices).length
    );
    console.log(Object.keys(this.pumpServices));
  }

  public handleMessage(message: AdaptedMessage) {
    Object.values(this.pumpServices).forEach((pumpService) => {
      pumpService.handleMessage(message);
    });
  }

  public async createChatConfig(config: Prisma.ChatConfigCreateInput) {
    const res = await this.config.createChatConfig(config);
    return res;
  }

  public updateChatConfig(
    chatId: string,
    config: Partial<Prisma.ChatConfigUpdateInput>
  ) {
    return this.config.set(chatId, config);
  }

  public getChatConfig(chatId: string): ChatConfig {
    return this.config.get(chatId);
  }

  public setNewPumpService(chatId: string) {
    const { windowSize, percentage, paidUntil, trialUntil } =
      this.getChatConfig(chatId);

    const isValidSub = isSubscriptionValid(paidUntil);
    const isValidTrial = isTrialValid(trialUntil);

    if (!isValidSub && !isValidTrial) return;

    const configKey = `${percentage}:${windowSize}`;

    if (this.pumpServices[configKey]) {
      const pumpService = this.pumpServices[configKey];
      pumpService.addChatId(chatId);
    } else {
      this.pumpServices[configKey] = new PumpService(
        { percentage, windowSize, chatIds: new Set([chatId]) },
        this
      );
    }

    console.log("------ ACTIVE PUMPSERVICES ------");

    Object.values(this.pumpServices)
      .filter((pumpService) => pumpService.getChatIds().size > 0)
      .forEach((pumpService) => {
        console.log(
          `${pumpService.getPercentage()}:${pumpService.getWindowSize()}`
        );
        console.log(
          `Chat Ids: ${Array.from(pumpService.getChatIds()).join(", ")}`
        );
      });
  }
  // naming is not correct. This method removes the chatId from the PumpService
  public removePumpService(chatId: string) {
    for (const key in this.pumpServices) {
      const pumpService = this.pumpServices[key];

      const chatIds = pumpService.getChatIds();

      if (chatIds.has(chatId)) {
        console.log("Removing chatId: ", chatId, "from pumpService: ", key);
        pumpService.removeChatId(chatId);
      }

      if (pumpService.getChatIds().size === 0) {
        delete this.pumpServices[key];
      }
    }
  }

  public setAvailableSymbols(symbols: string[]) {
    this.availableSymbols = [...this.availableSymbols, ...symbols];
  }

  public getAvailableSymbols() {
    return this.availableSymbols;
  }

  public setPairsToSubscribe(pairs: string[]) {
    const uniquePairs = new Set([...this.pairsToSubscribe, ...pairs]);

    this.pairsToSubscribe = Array.from(uniquePairs);
    this.emit(EVENTS.SUBSCRIPTIONS_UPDATED, this.pairsToSubscribe);
  }

  public checkAndRemoveUselessSubscriptions(chatId: string) {
    const allConfigs = this.config.getAll();
    const chatConfig = this.getChatConfig(chatId);
    const uselessSubscriptions = new Set(chatConfig?.selectedPairs);

    const allOtherPairs = new Set<string>();

    Object.keys(allConfigs).forEach((id) => {
      if (id !== chatId) {
        allConfigs[id as any].selectedPairs.forEach((pair) =>
          allOtherPairs.add(pair)
        );
      }
    });

    const subscriptionsToRemove = Array.from(uselessSubscriptions).filter(
      (pair) => !allOtherPairs.has(pair)
    );

    const updatedSubscriptions = this.pairsToSubscribe.filter(
      (pair) => !subscriptionsToRemove.includes(pair)
    );

    console.log(
      "User from chat",
      chatId,
      "stopped the bot. Removing subscriptions: ",
      subscriptionsToRemove
    );

    this.emit(EVENTS.SUBSCRIPTIONS_UPDATED, updatedSubscriptions);
  }

  public handlePaymentSuccess = async (invoiceId: string) => {
    const invoiceData: any = await fetchInvoice(invoiceId);
    const invoice = invoiceData?.result[0];
    const invoiceExpiresAt = DateTime.fromJSDate(new Date(invoice.expiry_date));
    const subscriptionExpiresAt = invoiceExpiresAt.plus({ days: 30 });

    if (invoiceData?.status === "success" && invoice.status === "paid") {
      const chatId = invoice.order_id;
      this.updateChatConfig(chatId, {
        paidUntil: subscriptionExpiresAt.toISO(),
      });

      sendPaymentSuccess(
        chatId,
        this,
        subscriptionExpiresAt.toFormat("dd.MM.yyyy")
      );
    }
  };

  public handleWalletPaySuccess = async (data: WalletWebhookMessage) => {
    const transactTime = DateTime.fromJSDate(
      new Date(data?.payload?.orderCompletedDateTime)
    );
    const subscriptionExpiresAt = transactTime.plus({ days: 30 });
    const chatId = data?.payload?.customData;

    const chatConfig = this.getChatConfig(chatId);

    if (isSubscriptionValid(chatConfig.paidUntil)) return;

    this.updateChatConfig(chatId, {
      paidUntil: subscriptionExpiresAt.toISO(),
    });

    sendPaymentSuccess(
      chatId,
      this,
      subscriptionExpiresAt.toFormat("dd.MM.yyyy")
    );
  };

  public async removeChatConfig(chatId: string) {
    await this.config.delete(chatId);
  }

  public async sendMessage(
    chatId: string,
    message: string,
    options?: SendMessageOptions
  ) {
    const wrappedFunc = this.limiter.wrap(async () => {
      this.bot.sendMessage(chatId, message, options).catch((error: any) => {
        if (error.message === FORBIDDEN_ERROR) {
          console.log("----------- FORBIDDEN ERROR -----------");
          console.log("User blocked the bot. Stopping Pump Service: ", chatId);
          this.removePumpService(chatId);
          this.updateChatConfig(chatId, {
            state: ChatState.STOPPED,
          });
          console.log("STOPPED PUMP SERVICE: ", chatId);
        }

        if (error.message === NOT_FOUND) {
          console.log("----------- NOT FOUND ERROR -----------");
          console.log("Chat not found. Stopping Pump Service: ", chatId);
          this.removePumpService(chatId);
          this.updateChatConfig(chatId, {
            state: ChatState.STOPPED,
          });
          console.log("STOPPED PUMP SERVICE: ", chatId);
        }
      });
    });

    wrappedFunc();
  }

  public async sendAlerts(
    checkResult: SignificantPumpInfo,
    platform: PlatformType,
    chatIds: string[]
  ) {
    const { pair, minPrice, lastPrice, diff, volumeChange } = checkResult;
    const currency = platform === "Coinbase" ? pair.split("-")[1] : "USDT";

    const link =
      platform === "Binance"
        ? getBinanceFuturesURL(pair)
        : platform === "Bybit"
        ? getBybitFuturesURL(pair)
        : getCoinbaseURL(pair);

    const alertFns = chatIds.map(async (chatId) => {
      const {
        language,
        selectedPairs,
        trialUntil,
        paidUntil,
        state,
        stoppedExchanges,
      } = this.getChatConfig(chatId);
      const isValidSubscription = isSubscriptionValid(paidUntil);
      const isValidTrial = isTrialValid(trialUntil);
      const isChatStopped = state === ChatState.STOPPED;
      const isExchangeStopped = stoppedExchanges.includes(
        platform.toLowerCase()
      );

      if (
        (!isValidSubscription && !isValidTrial) ||
        isChatStopped ||
        isExchangeStopped
      )
        return;

      if (selectedPairs?.length && !selectedPairs?.includes(pair)) return;

      const msg = i18n.t("pump-detected", {
        platform,
        currency,
        pair: `[${pair}](${link})`,
        link,
        startPrice: getPriceInFloatingPoint(minPrice, platform),
        lastPrice: getPriceInFloatingPoint(lastPrice, platform),
        volumeChange: getPriceInFloatingPoint(volumeChange, platform),
        diff,
        lng: language,
      });

      this.sendMessage(chatId, msg, {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      });
    });

    Promise.all(alertFns).catch((e) => {
      console.log("Error sending alerts: ", e);
    });
  }

  public getPumpServices() {
    return this.pumpServices;
  }
}
