import i18next from "../i18n";
import type BotService from "../services/BotService";
import type { Message, ParseMode } from "node-telegram-bot-api";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PERCENTAGE,
  MIN_PERCENTAGE,
} from "./constants";

export const sendExchangesOptions = (
  chatId: number,
  botService: BotService
) => {
  const config = botService.getChatConfig(chatId);
  const lng = config?.language || DEFAULT_LANGUAGE;

  const options = {
    parse_mode: "Markdown" as ParseMode,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Binance",
            callback_data: "binance",
          },
          {
            text: "Bybit",
            callback_data: "bybit",
          },
        ],
      ],
    },
  };

  botService.sendMessage(
    chatId,
    i18next.t("stop-exchanges-header", {
      lng,
    }),
    options
  );
};

export const sendPercentageOptions = (
  chatId: number,
  botService: BotService
) => {
  const options = {
    parse_mode: "Markdown" as ParseMode,
  };

  botService.updateChatConfig(chatId, { isSendingPercentage: true });
  botService.sendMessage(
    chatId,
    i18next.t("select-percentage-desc", {
      default: DEFAULT_PERCENTAGE,
      min: MIN_PERCENTAGE,
      lng: botService.getChatConfig(chatId).language,
    }),
    options
  );
};

export const sendSettingsOptions = (msg: Message, botService: BotService) => {
  const config = botService.getChatConfig(msg.chat.id);
  const lng = config?.language || DEFAULT_LANGUAGE;

  const options = {
    parse_mode: "Markdown" as ParseMode,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: i18next.t("select-pairs", {
              lng,
            }),
            callback_data: "select-pairs",
          },
        ],
        [
          {
            text: i18next.t("select-percentage", {
              lng,
            }),
            callback_data: "select-percentage",
          },
        ],
        [
          {
            text: i18next.t("select-language", {
              lng,
            }),
            callback_data: "select-language",
          },
        ],
        [
          {
            text: i18next.t("stop-exchanges", {
              lng,
            }),
            callback_data: "stop-exchanges",
          },
        ],
      ],
    },
  };
  botService.sendMessage(
    msg.chat.id,
    i18next.t("select-settings", {
      lng,
    }),
    options
  );
};
