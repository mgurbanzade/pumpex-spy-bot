import i18next from "../i18n";
import type BotService from "../services/BotService";
import type { Message, ParseMode } from "node-telegram-bot-api";
import { sendCurrentPairs } from "./eventHandlers";

export const sendSelectPairs = (chatId: number, botService: BotService) => {
  const options = {
    parse_mode: "Markdown" as ParseMode,
  };

  botService.updateChatConfig(chatId, {
    isIncludePairs: true,
  });
  botService.sendMessage(chatId, i18next.t("select-pairs-desc"), options);
};

export const sendExcludePairs = (chatId: number, botService: BotService) => {
  const options = {
    parse_mode: "Markdown" as ParseMode,
  };

  botService.updateChatConfig(chatId, {
    isExcludePairs: true,
  });
  botService.sendMessage(chatId, i18next.t("exclude-pairs-desc"), options);
};

export const handleIncludePairs = (
  message: Message,
  botService: BotService
) => {
  const symbols = message.text?.split(",").filter((sym) => {
    const symbol = sym.trim();
    const availableSymbols = botService.getAvailableSymbols();
    return availableSymbols.indexOf(symbol) !== -1;
  });

  botService.updateChatConfig(message.chat.id, {
    selectedPairs: symbols,
    isIncludePairs: false,
  });

  botService.removePumpService(message.chat.id);
  botService.setNewPumpService(message.chat.id, symbols);

  botService.sendMessage(message.chat.id, i18next.t("settings-saved"));
  sendCurrentPairs(message.chat.id, botService, "include");
};

export const handleExcludePairs = (
  message: Message,
  botService: BotService
) => {
  const symbols = message.text?.split(",").filter((sym) => {
    const symbol = sym.trim();
    const availableSymbols = botService.getAvailableSymbols();
    return availableSymbols.indexOf(symbol) !== -1;
  });

  botService.updateChatConfig(message.chat.id, {
    excludedPairs: symbols,
    isExcludePairs: false,
  });

  botService.removePumpService(message.chat.id);
  botService.setNewPumpService(message.chat.id, [], symbols);

  botService.sendMessage(message.chat.id, i18next.t("settings-saved"));
  sendCurrentPairs(message.chat.id, botService, "exclude");
};
