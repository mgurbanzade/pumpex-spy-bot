import i18next from "../i18n";
import { saveLanguage, sendSelectLanguages } from "./languageUtils";
import { sendPercentageOptions } from "./keyboardUtils";
import type { CallbackQuery, Message, ParseMode } from "node-telegram-bot-api";
import type BotService from "../services/BotService";
import { DEFAULT_PERCENTAGE, PERCENTAGES } from "./constants";
import { sendSelectPairs } from "./textUtils";

export const handleStart = (msg: Message, botService: BotService) => {
  const currentChat = botService.getChatConfig(msg.chat.id);

  if (currentChat && currentChat?.selectedPairs?.length) {
    return botService.sendMessage(
      msg.chat.id,
      i18next.t("already-started", {
        percentage: currentChat.percentage,
      }),
      {
        parse_mode: "Markdown" as ParseMode,
      }
    );
  }

  const lang = msg?.from?.language_code as string;
  const language = ["en", "ru", "ua"].includes(lang)
    ? (lang as "en" | "ru" | "ua")
    : "en";

  i18next.changeLanguage(language);

  botService.updateChatConfig(msg.chat.id, {
    language,
    percentage: DEFAULT_PERCENTAGE,
    selectedPairs: [],
    isIncludePairs: false,
  });

  sendSelectPairs(msg.chat.id, botService);
};

export const handleStop = (msg: Message, botService: BotService) => {
  botService.removePumpService(msg.chat.id);
  botService.removeChatConfig(msg.chat.id);
  botService.sendMessage(msg.chat.id, i18next.t("stopped"));
};

export const handleCallbackQuery = (
  callbackQuery: CallbackQuery,
  botService: BotService
) => {
  const message = callbackQuery.message as Message;
  const data = callbackQuery.data as string;

  if (PERCENTAGES.includes(data)) {
    return handlePercentageConfig(callbackQuery, botService);
  }

  switch (data) {
    case "select-percentage":
      sendPercentageOptions(message.chat.id, botService);
      break;
    case "select-pairs":
      sendSelectPairs(message.chat.id, botService);
      break;
    case "select-language":
      sendSelectLanguages(message.chat.id, botService);
      break;
    case "en":
    case "ru":
    case "ua":
      saveLanguage(message.chat.id, botService, data);
      break;
    default:
      break;
  }
};

const handlePercentageConfig = (
  callbackQuery: CallbackQuery,
  botService: BotService
) => {
  const message = callbackQuery.message as Message;
  const data = callbackQuery.data as string;
  const percentage = Number(data.replace("%", ""));

  botService.updateChatConfig(message.chat.id, {
    percentage,
  });

  botService.bot.answerCallbackQuery(callbackQuery.id).then(() => {
    const config = botService.getChatConfig(message.chat.id);

    botService.sendMessage(
      message.chat.id,
      i18next.t("settings-saved-general", {
        percentage: config.percentage,
      })
    );

    botService.setNewPumpService(message.chat.id);
  });
};

export const sendCurrentPairs = (
  chatId: number,
  botService: BotService,
  action: "include"
) => {
  const chatConfig = botService.getChatConfig(chatId);

  if (action === "include") {
    if (chatConfig.selectedPairs.length) {
      const message = `${i18next.t(
        "current-pairs"
      )}:\n\n${chatConfig.selectedPairs.join(", ")}`;

      return botService.sendMessage(chatId, message, {
        parse_mode: "Markdown" as ParseMode,
      });
    }
  }
};
