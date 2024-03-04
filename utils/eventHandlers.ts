import i18next from "../i18n";
import { saveLanguage, sendSelectLanguages } from "./languageUtils";
import { sendExchangesOptions, sendPercentageOptions } from "./keyboardUtils";
import type { CallbackQuery, Message, ParseMode } from "node-telegram-bot-api";
import type BotService from "../services/BotService";
import { DEFAULT_LANGUAGE, DEFAULT_PERCENTAGE } from "./constants";
import { sendSelectPairs } from "./textUtils";

export const handleStart = (msg: Message, botService: BotService) => {
  const currentChat = botService.getChatConfig(msg.chat.id);

  if (!currentChat) {
    const lang = msg?.from?.language_code as string;
    const language = ["en", "ru", "ua"].includes(lang)
      ? (lang as "en" | "ru" | "ua")
      : DEFAULT_LANGUAGE;

    botService.updateChatConfig(msg.chat.id, {
      language,
      percentage: DEFAULT_PERCENTAGE,
      selectedPairs: [],
      isIncludePairs: false,
    });

    return sendSelectPairs(msg.chat.id, botService);
  }

  if (currentChat && !currentChat?.selectedPairs?.length) {
    return sendSelectPairs(msg.chat.id, botService);
  }

  if (currentChat && currentChat?.selectedPairs?.length) {
    return botService.sendMessage(
      msg.chat.id,
      i18next.t("already-started", {
        lng: currentChat.language,
        percentage: currentChat.percentage || DEFAULT_PERCENTAGE,
      }),
      {
        parse_mode: "Markdown" as ParseMode,
      }
    );
  }
};

export const handleStop = (msg: Message, botService: BotService) => {
  const lng =
    botService.getChatConfig(msg.chat.id)?.language || DEFAULT_LANGUAGE;
  botService.removePumpService(msg.chat.id);
  botService.checkAndRemoveUselessSubscriptions(msg.chat.id);
  botService.removeChatConfig(msg.chat.id);
  botService.sendMessage(msg.chat.id, i18next.t("stopped", { lng }));
};

export const handleStopExchanges = (
  msg: Message,
  botService: BotService,
  data: string
) => {
  const config = botService.getChatConfig(msg.chat.id);
  if (!config) return;

  botService.unsubscribeFromExchange(msg.chat.id, data);
  botService.sendMessage(
    msg.chat.id,
    i18next.t("settings-saved", {
      lng: config.language,
    })
  );
};

export const handleCallbackQuery = (
  callbackQuery: CallbackQuery,
  botService: BotService
) => {
  const message = callbackQuery.message as Message;
  const data = callbackQuery.data as string;

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
    case "stop-exchanges":
      sendExchangesOptions(message.chat.id, botService);
      return;
    case "binance":
    case "bybit":
      handleStopExchanges(message, botService, data);
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

export const sendCurrentPairs = (chatId: number, botService: BotService) => {
  const chatConfig = botService.getChatConfig(chatId);

  if (chatConfig.selectedPairs.length) {
    const messageTranslation = i18next.t("current-pairs", {
      lng: chatConfig.language,
    });
    const message = `${messageTranslation}:\n\n${chatConfig.selectedPairs.join(
      ", "
    )}`;

    return botService.sendMessage(chatId, message, {
      parse_mode: "Markdown" as ParseMode,
    });
  }
};
