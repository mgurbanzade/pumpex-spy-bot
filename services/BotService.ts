import { DateTime } from "luxon";
import EventEmitter from "events";
import TelegramBot from "node-telegram-bot-api";
import omit from "lodash.omit";
import PumpService from "./PumpService";
import type { ChatConfig, WalletWebhookMessage } from "../types";

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
import { isNegativeChatId } from "../utils/helpers";

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
      reservoir: 25,
      reservoirRefreshAmount: 25,
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
      const config = this.getChatConfig(msg.chat.id);
      return config ? sendSettingsOptions(msg, this) : handleStart(msg, this);
    });

    this.bot.on("callback_query", (cbq: CallbackQuery) =>
      handleCallbackQuery(cbq, this)
    );

    this.bot.on("message", (msg: Message) => {
      if (isNegativeChatId(msg)) {
        return sendNegativeIdMessage(msg, this);
      }

      const config = this.getChatConfig(msg.chat.id);
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

      const config = this.getChatConfig(msg.chat.id);
      if (!config) return;

      if (config.state === ChatState.SELECT_PAIRS) {
        return handleSelectPairsInput(msg, this);
      }
    });
  }

  public async initialize() {
    const chatConfigs = this.config.getAll();

    for (let chatId in chatConfigs) {
      const chatConfig = chatConfigs[chatId];
      this.pumpServices[chatId] = new PumpService(
        { ...chatConfig, chatId: Number(chatId) },
        this
      );
    }
  }

  public handleMessage(message: AdaptedMessage) {
    if (Object.keys(this.pumpServices).length > 0) {
      for (let key in this.pumpServices) {
        const chatConfig = this.getChatConfig(Number(key));
        if (!chatConfig) {
          console.log("Chat config not found for chatId", key);
          continue;
        }

        const isActiveSubscription = isSubscriptionValid(
          chatConfig.paidUntil as string
        );
        const isActiveTrial = isTrialValid(chatConfig.trialUntil as string);
        const isChatStopped = chatConfig?.state === ChatState.STOPPED;
        const isExchangeStopped = chatConfig?.stoppedExchanges.includes(
          message.platform.toLowerCase()
        );

        if (
          isExchangeStopped ||
          isChatStopped ||
          (!isActiveSubscription && !isActiveTrial)
        )
          continue;

        const pumpService = this.pumpServices[key];
        pumpService.handleMessage(message);
      }
    }
  }

  public async createChatConfig(config: Prisma.ChatConfigCreateInput) {
    const res = await this.config.createChatConfig(config);
    return res;
  }

  public updateChatConfig(
    chatId: number,
    config: Partial<Prisma.ChatConfigUpdateInput>
  ) {
    return this.config.set(chatId, config);
  }

  public getChatConfig(chatId: number): ChatConfig {
    return this.config.get(chatId);
  }

  public setNewPumpService(chatId: number) {
    const config = this.getChatConfig(chatId);

    this.pumpServices[chatId] = new PumpService({ chatId, ...config }, this);
  }

  public removePumpService(chatId: number) {
    this.pumpServices = omit(this.pumpServices, chatId);
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

  public checkAndRemoveUselessSubscriptions(chatId: number) {
    const allConfigs = this.config.getAll();
    const chatConfig = this.getChatConfig(chatId);
    const uselessSubscriptions = new Set(chatConfig?.selectedPairs);

    const allOtherPairs = new Set<string>();

    Object.keys(allConfigs).forEach((id) => {
      if (parseInt(id) !== chatId) {
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
      this.updateChatConfig(Number(chatId), {
        paidUntil: subscriptionExpiresAt.toISO(),
        state: ChatState.SEARCHING,
      });

      sendPaymentSuccess(
        Number(chatId),
        this,
        subscriptionExpiresAt.toFormat("dd.MM.yyyy")
      );
    }
  };

  // public handleBinancePaySuccess = async (data: any) => {
  //   const transactTime = DateTime.fromJSDate(new Date(data?.transactTime));
  //   const subscriptionExpiresAt = transactTime.plus({ days: 30 });
  //   const chatId = data?.merchantTradeNo?.split("date")[0];

  //   const chatConfig = this.getChatConfig(Number(chatId));

  //   if (isSubscriptionValid(chatConfig.paidUntil)) return;

  //   this.updateChatConfig(Number(chatId), {
  //     paidUntil: subscriptionExpiresAt.toISO(),
  //     state: ChatState.SEARCHING,
  //   });

  //   sendPaymentSuccess(
  //     Number(chatId),
  //     this,
  //     subscriptionExpiresAt.toFormat("dd.MM.yyyy")
  //   );
  // };

  public handleWalletPaySuccess = async (data: WalletWebhookMessage) => {
    const transactTime = DateTime.fromJSDate(
      new Date(data?.payload?.orderCompletedDateTime)
    );
    const subscriptionExpiresAt = transactTime.plus({ days: 30 });
    const chatId = data?.payload?.customData;

    const chatConfig = this.getChatConfig(Number(chatId));

    if (isSubscriptionValid(chatConfig.paidUntil)) return;

    this.updateChatConfig(Number(chatId), {
      paidUntil: subscriptionExpiresAt.toISO(),
      state: ChatState.SEARCHING,
    });

    sendPaymentSuccess(
      Number(chatId),
      this,
      subscriptionExpiresAt.toFormat("dd.MM.yyyy")
    );
  };

  public async sendMessage(
    chatId: number,
    message: string,
    options?: SendMessageOptions
  ) {
    const wrappedFunc = this.limiter.wrap(async () => {
      this.bot.sendMessage(chatId, message, options);
    });

    try {
      await wrappedFunc();
    } catch (e) {
      console.log("chatId: ", chatId, e);
    }
  }
}
