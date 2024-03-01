import i18next from "../i18n";
import type BotService from "../services/BotService";
import type { ParseMode } from "node-telegram-bot-api";

export const saveLanguage = (
  chatId: number,
  botService: BotService,
  language: "en" | "ru" | "ua"
) => {
  botService.updateChatConfig(chatId, {
    language,
  });

  i18next.changeLanguage(language);
  botService.sendMessage(chatId, i18next.t("settings-saved"));
};

export const sendSelectLanguages = (chatId: number, botService: BotService) => {
  const options = {
    parse_mode: "Markdown" as ParseMode,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🇬🇧 English", callback_data: "en" },
          {
            text: "🇷🇺 Русский",
            callback_data: "ru",
          },
          { text: "🇺🇦 Українська", callback_data: "ua" },
        ],
      ],
    },
  };

  botService.sendMessage(chatId, `*${i18next.t("select-language")}:*`, options);
};
