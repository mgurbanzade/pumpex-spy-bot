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

import {
  EVENTS,
  MAX_ACTIVE_SUBSCRIBERS,
  OPEN_INTEREST_INTERVAL,
} from "../utils/constants";
import {
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
  getPriceInFloatingPoint,
} from "../utils/helpers";
import { type PlatformType } from "../utils/constants";
import { FORBIDDEN_ERROR, NOT_FOUND } from "../utils/errors";
import type OpenInterestService from "./OpenInterest";
import type TopPairsService from "./TopPairsService";

export default class BotService extends EventEmitter {
  private limiter: Bottleneck;
  public config: ConfigService;
  public bot: TelegramBot;
  public oiService: OpenInterestService;
  public topPairsService: TopPairsService;
  private pumpServices: { [key: string]: PumpService };
  private availableSymbols: string[];
  private pairsToSubscribe: string[] = [];
  private allTopPairs: string[] = [];
  private intervalId: Timer | null;

  constructor(
    config: ConfigService,
    oiService: OpenInterestService,
    topPairsService: TopPairsService
  ) {
    super();
    this.config = config;
    this.oiService = oiService;
    this.topPairsService = topPairsService;
    this.availableSymbols = [];
    this.allTopPairs = [];
    this.pumpServices = {};
    this.intervalId = null;

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
    this.allTopPairs = await this.getTopPairs([0, Infinity]);

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
    this.checkMaxSubscribers();
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
    const pumpServices = Object.values(this.pumpServices).filter(
      (pumpService) => pumpService.getChatIds().size > 0
    );

    pumpServices.forEach((pumpService) => {
      console.log(
        `${pumpService.getPercentage()}:${pumpService.getWindowSize()}`
      );
      console.log(
        `Chat Ids: ${Array.from(pumpService.getChatIds()).join(", ")}`
      );
    });

    this.checkMaxSubscribers();
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

    this.checkMaxSubscribers();
  }

  public setAvailableSymbols(symbols: string[]) {
    this.availableSymbols = [...this.availableSymbols, ...symbols];
  }

  public getAvailableSymbols() {
    return this.availableSymbols;
  }

  public setPairsToSubscribe(pairs: string[]) {
    const pairsToSubscribe = new Set([...this.pairsToSubscribe]);
    const allPairsExist = pairs.every((pair) => pairsToSubscribe.has(pair));

    if (allPairsExist) return;

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

    if (!subscriptionsToRemove.length) return;

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
          console.log(
            "User blocked the bot. Removing from Pump Service: ",
            chatId
          );
          this.removePumpService(chatId);
          this.updateChatConfig(chatId, {
            state: ChatState.STOPPED,
          });
          console.log("REMOVED FROM PUMP SERVICE: ", chatId);
        }

        if (error.message === NOT_FOUND) {
          console.log("----------- NOT FOUND ERROR -----------");
          console.log("Chat not found. Removing from Pump Service: ", chatId);
          this.removePumpService(chatId);
          this.updateChatConfig(chatId, {
            state: ChatState.STOPPED,
          });
          console.log("REMOVED FROM PUMP SERVICE: ", chatId);
        }
      });
    });

    return wrappedFunc();
  }

  public async sendAlerts(
    checkResult: SignificantPumpInfo,
    platform: PlatformType,
    chatIds: string[]
  ) {
    const { pair, minPrice, lastPrice, diff, volumeChange } = checkResult;
    const openInterest = this.oiService.getOIForSymbol(pair, platform);

    const currency = "USDT";

    const link =
      platform === "Binance"
        ? getBinanceFuturesURL(pair)
        : getBybitFuturesURL(pair);

    const alertFns = chatIds.map(async (chatId) => {
      const {
        language,
        selectedPairs,
        trialUntil,
        paidUntil,
        state,
        stoppedExchanges,
        windowSize,
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
      const oiDiff = openInterest?.diffPercent || 0;
      const minuteShort = i18n.t("minutes-short", { lng: language });

      const msg = i18n.t(oiDiff !== 0 ? "pump-detected-oi" : "pump-detected", {
        platform,
        currency,
        pair: `[${pair}](${link})`,
        link,
        minPrice: getPriceInFloatingPoint(minPrice, platform),
        lastPrice: getPriceInFloatingPoint(lastPrice, platform),
        volumeChange: getPriceInFloatingPoint(volumeChange, platform),
        windowSize: windowSize / 60000,
        diff,
        lng: language,
        interval: `${OPEN_INTEREST_INTERVAL / 60000} ${minuteShort}`,
        oiDiff:
          oiDiff > 0
            ? `+${oiDiff.toFixed(3)}`
            : oiDiff < 0
            ? oiDiff.toFixed(3)
            : 0,
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

  public getAllTopPairs() {
    return this.allTopPairs;
  }

  public async getTopPairs([start, final]: number[]) {
    try {
      const binanceFutures = await this.topPairsService.getBinanceFutures();
      const bybitFutures = await this.topPairsService.getBybitFutures();

      const maxLength = Math.max(
        binanceFutures?.length as number,
        bybitFutures?.length as number
      );
      const end = final === Infinity ? maxLength : final;
      const size = end - start;

      const [binance, bybit] = await Promise.all([
        binanceFutures,
        bybitFutures,
      ]);

      let i = start || 0;
      let j = start || 0;

      const binancePairs = [];
      const bybitPairs = [];
      const addedBinanceAssets = new Set<string>();
      const addedBybitAssets = new Set<string>();

      while (true) {
        const pair = binance?.[i];
        if (!pair) break;

        addedBinanceAssets.add(pair.baseAsset);
        binancePairs.push(pair.pair);
        i++;

        if (addedBinanceAssets.size === size) break;
      }

      while (true) {
        const pair = bybit?.[j];
        if (!pair) break;

        addedBybitAssets.add(pair.baseAsset);
        bybitPairs.push(pair.pair);
        j++;
        if (addedBybitAssets.size === size) break;
      }

      return Array.from(new Set([...binancePairs, ...bybitPairs]));
    } catch (e) {
      console.log("Error fetching top pairs", e);
      return [];
    }
  }

  private checkMaxSubscribers() {
    const chatIds = Object.values(this.pumpServices)
      .map((service) => Array.from(service.getChatIds()))
      .flat();

    console.log("TOTAL ACTIVE SUBSCRIBERS: ", chatIds.length);

    if (chatIds.length > MAX_ACTIVE_SUBSCRIBERS) {
      if (this.intervalId) clearInterval(this.intervalId);
      this.intervalId = setInterval(() => {
        console.log(
          "----------------------ALERT ALERT ALERT----------------------"
        );
        console.log(
          "----------------------TOO MANY CHAT IDS----------------------"
        );
        console.log(
          "----------------------TOO MANY CHAT IDS----------------------"
        );
        console.log(
          "----------------------TOO MANY CHAT IDS----------------------"
        );
        console.log(
          "----------------------TOO MANY CHAT IDS----------------------"
        );
      }, 10000);
    } else {
      if (this.intervalId) clearInterval(this.intervalId);
    }
  }
}
