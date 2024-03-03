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

  botService.sendMessage(
    chatId,
    i18next.t("select-pairs-desc", {
      lng: botService.getChatConfig(chatId).language,
    }),
    options
  );
};

export const handleIncludePairs = (
  message: Message,
  botService: BotService
) => {
  const availableSymbols = botService.getAvailableSymbols();

  const inputSymbols =
    message.text
      ?.split(",")
      .map((text) => text.trim())
      .filter((sym) => sym !== "") || [];

  const invalidSymbols =
    inputSymbols.filter((sym) => !availableSymbols.includes(sym)) || [];

  const validSymbols =
    inputSymbols.filter((sym) => availableSymbols.includes(sym)) || [];

  botService.updateChatConfig(message.chat.id, {
    selectedPairs: validSymbols,
    isIncludePairs: false,
  });

  botService.setPairsToSubscribe(validSymbols);
  botService.setNewPumpService(message.chat.id);

  sendCurrentPairs(message.chat.id, botService);

  if (invalidSymbols.length) {
    setTimeout(
      () =>
        botService.sendMessage(
          message.chat.id,
          i18next.t("invalid-pairs", {
            invalidPairs: invalidSymbols.join(", "),
            lng: botService.getChatConfig(message.chat.id).language,
          }),
          { parse_mode: "Markdown" as ParseMode }
        ),
      200
    );
  }
};

export const handlePercentageInput = (
  chatId: number,
  botService: BotService,
  percentage: number
) => {
  const config = botService.getChatConfig(chatId);
  botService.updateChatConfig(chatId, {
    percentage,
    isSendingPercentage: false,
  });

  botService.sendMessage(
    chatId,
    i18next.t("settings-saved-general", { percentage, lng: config.language }),
    { parse_mode: "Markdown" as ParseMode }
  );

  botService.setNewPumpService(chatId);
};
