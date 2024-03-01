import i18next from "../i18n";
import type BotService from "../services/BotService";
import type { Message, ParseMode } from "node-telegram-bot-api";

export const sendPercentageOptions = (
  chatId: number,
  botService: BotService
) => {
  const options = {
    parse_mode: "Markdown" as ParseMode,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "1%", callback_data: "1%" },
          { text: "1.5%", callback_data: "1.5%" },
          { text: "2%", callback_data: "2%" },
          { text: "2.5%", callback_data: "2.5%" },
        ],
        [
          { text: "3%", callback_data: "3%" },
          { text: "3.5%", callback_data: "3.5%" },
          { text: "5%", callback_data: "5%" },
          { text: "10%", callback_data: "10%" },
        ],
      ],
    },
  };
  botService.sendMessage(chatId, i18next.t("select-percentage-desc"), options);
};

export const sendSettingsOptions = (msg: Message, botService: BotService) => {
  const options = {
    parse_mode: "Markdown" as ParseMode,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: i18next.t("select-pairs"),
            callback_data: "select-pairs",
          },
        ],
        [
          {
            text: i18next.t("exclude-pairs"),
            callback_data: "exclude-pairs",
          },
        ],
        [
          {
            text: i18next.t("select-language"),
            callback_data: "select-language",
          },
        ],
        [
          {
            text: i18next.t("select-percentage"),
            callback_data: "select-percentage",
          },
        ],
      ],
    },
  };
  botService.sendMessage(msg.chat.id, i18next.t("select-settings"), options);
};
