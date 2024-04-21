import type { Message } from "node-telegram-bot-api";
import type { ChatConfig } from "../types";
import type { ConfigType } from "../services/ConfigService";
import type { PlatformType } from "./constants";
import { ChatState } from "@prisma/client";
import { isSubscriptionValid, isTrialValid } from "./payments";

export const splitIntoGroups = (arr: string[], groupSize: number) => {
  const groups = [];

  for (let i = 0; i < arr.length; i += groupSize) {
    groups.push(arr.slice(i, i + groupSize));
  }

  return groups;
};

export const isNegativeChatId = (message: Message) => {
  return message.chat.id < 0;
};

export const getUniqueConfigs = (config: ConfigType) => {
  return Object.values(config)
    .filter((chat) => {
      const isValidSubscription = isSubscriptionValid(chat.paidUntil);
      const isValidTrial = isTrialValid(chat.trialUntil);
      return (
        (isValidSubscription || isValidTrial) &&
        chat.state !== ChatState.STOPPED
      );
    })
    .map((chat: any) => ({
      chatId: chat.chatId,
      percentage: chat.percentage,
      windowSize: chat.windowSize,
    }))
    .reduce((acc, { percentage, windowSize, chatId }) => {
      const key = `${percentage}:${windowSize}`;

      acc = {
        ...acc,
        [key]: acc[key] ? [...acc[key], chatId] : [chatId],
      };

      return acc;
    }, {} as { [key: string]: string[] });
};

export const getBinanceFuturesURL = (pair: string) => {
  return `https://binance.com/futures/${pair}`;
};

export const getBybitFuturesURL = (pair: string) => {
  return `https://www.bybit.com/trade/usdt/${pair}`;
};

export const getCoinbaseURL = (pair: string) => {
  return `https://pro.coinbase.com/trade/${pair}`;
};

export const getPriceInFloatingPoint = (
  price: number,
  platform: PlatformType
) => {
  const digitDispatcher = {
    Binance: 6,
    Bybit: 5,
    Coinbase: 6,
  };

  const digit = digitDispatcher[platform];
  return price <= 0.09 ? price.toFixed(digit) : price.toFixed(3);
};
