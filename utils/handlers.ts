import type {
  CallbackQuery,
  Message,
  ParseMode,
  BotCommandScopeDefault,
} from "node-telegram-bot-api";
import {
  type Prisma,
  Language,
  ChatState as PrismaChatState,
} from "@prisma/client";
import { ChatState, type ChatConfig } from "../types";
import type BotService from "../services/BotService";
import i18next from "../i18n";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PERCENTAGE,
  DEFAULT_WINDOW_SIZE_MS,
  MAX_PERCENTAGE,
  MAX_WINDOW_SIZE_MS,
  MIN_PERCENTAGE,
  MIN_WINDOW_SIZE_MS,
} from "./constants";

import {
  sendAlreadyStarted,
  sendCurrentPairs,
  sendGreetings,
  sendInvalidPairs,
  sendSelectPairs,
  sendExchangesOptions,
  sendPercentageOptions,
  sendSelectLanguages,
  sendSettingsOptions,
  sendWindowSizeOptions,
  sendSubscriptionOptions,
  sendPaymentOptions,
  sendHelpOptions,
  sendKnowledgeBase,
  sendTerms,
  sendToKnow,
  sendHowToUse,
  sendInDev,
} from "./senders";
import { isSubscriptionValid } from "./payments";
import { retrievePaymentURL } from "./binance-pay";
import { retrieveWalletPaymentUrl } from "./wallet-pay";

export const setNewChat = async (
  message: Message,
  botService: BotService
): Promise<ChatConfig> => {
  const lang = message?.from?.language_code?.toUpperCase() as Language;
  const language = [Language.EN, Language.RU, Language.UA].includes(lang)
    ? lang
    : DEFAULT_LANGUAGE;

  const config: Prisma.ChatConfigCreateInput = {
    chatId: message.chat.id,
    username: message.from?.username as string,
    language,
    percentage: DEFAULT_PERCENTAGE,
    windowSize: DEFAULT_WINDOW_SIZE_MS,
    selectedPairs: [],
    stoppedExchanges: [],
    state: PrismaChatState.START,
    paidUntil: null,
  };

  const res = await botService.createChatConfig(config);
  const { id, ...rest } = res;
  return rest;
};

export const handleStart = async (message: Message, botService: BotService) => {
  const currentChat = botService.getChatConfig(message.chat.id);

  if (!currentChat) {
    const config = await setNewChat(message, botService);
    sendGreetings(message.chat.id, botService, config);
    botService.updateChatConfig(message.chat.id, {
      state: ChatState.SELECT_PAIRS,
    });

    setTimeout(() => sendSelectPairs(message, botService), 300);
    return;
  }

  const lng = currentChat.language || DEFAULT_LANGUAGE;

  const commands = [
    { command: "start", description: i18next.t("start", { lng }) },
    { command: "settings", description: i18next.t("settings", { lng }) },
    {
      command: "knowledge",
      description: i18next.t("knowledge-base", { lng }),
    },
    { command: "help", description: i18next.t("help", { lng }) },
    { command: "stop", description: i18next.t("stop", { lng }) },
  ];

  const scope = {
    type: "chat" as BotCommandScopeDefault["type"],
    chat_id: message.chat.id,
    user_id: message.from?.id as number,
  };

  try {
    await botService.bot.setMyCommands(commands, { scope });
  } catch (e) {
    console.log(e);
  }

  const isValidSubscription = isSubscriptionValid(currentChat?.paidUntil);

  if (!isValidSubscription) {
    botService.updateChatConfig(message.chat.id, {
      state: ChatState.SUBSCRIBE,
    });

    return sendSubscriptionOptions(message, botService, "send");
  }

  if (currentChat && !currentChat?.selectedPairs?.length) {
    botService.updateChatConfig(message.chat.id, {
      state: ChatState.SELECT_PAIRS,
    });

    return sendSelectPairs(message, botService);
  }

  if (currentChat && currentChat?.selectedPairs?.length) {
    if (currentChat.state === ChatState.STOPPED) {
      botService.updateChatConfig(message.chat.id, {
        selectedPairs: currentChat.selectedPairs,
        state: ChatState.SEARCHING,
      });

      botService.setPairsToSubscribe(currentChat.selectedPairs);
      botService.setNewPumpService(message.chat.id);
      return sendCurrentPairs(message.chat.id, botService);
    }

    return sendAlreadyStarted(message, botService, currentChat);
  }
};

export const handleHelp = (message: Message, botService: BotService) => {
  return sendHelpOptions(message, botService);
};

export const handleStop = (message: Message, botService: BotService) => {
  const chatConfig = botService.getChatConfig(message.chat.id);
  const lng = chatConfig?.language || DEFAULT_LANGUAGE;
  botService.removePumpService(message.chat.id);
  botService.checkAndRemoveUselessSubscriptions(message.chat.id);
  botService.updateChatConfig(message.chat.id, {
    state: ChatState.STOPPED,
  });
  botService.sendMessage(message.chat.id, i18next.t("stopped", { lng }));
};

export const handleStopExchanges = (
  message: Message,
  botService: BotService,
  data: string
) => {
  const config = botService.getChatConfig(message.chat.id);
  if (!config) return;

  botService.updateChatConfig(message.chat.id, {
    stoppedExchanges: [...config.stoppedExchanges, data],
    state: ChatState.SEARCHING,
  });

  botService.sendMessage(
    message.chat.id,
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
      botService.updateChatConfig(message.chat.id, {
        state: ChatState.SELECT_PERCENTAGE,
      });
      sendPercentageOptions(message, botService);
      break;
    case ChatState.SELECT_WINDOW_SIZE:
      botService.updateChatConfig(message.chat.id, {
        state: ChatState.SELECT_WINDOW_SIZE,
      });
      sendWindowSizeOptions(message, botService);
      break;
    case "select-pairs":
      botService.updateChatConfig(message.chat.id, {
        state: ChatState.SELECT_PAIRS,
      });
      sendSelectPairs(message, botService, "edit");
      break;
    case "select-language":
      botService.updateChatConfig(message.chat.id, {
        state: ChatState.CHANGE_LANGUAGE,
      });
      sendSelectLanguages(message, botService);
      break;
    case "stop-exchanges":
      botService.updateChatConfig(message.chat.id, {
        state: ChatState.UNSUBSCRIBE_EXCHANGES,
      });
      sendExchangesOptions(message, botService);
      break;
    case "binance":
    case "bybit":
    case "coinbase":
      handleStopExchanges(message, botService, data);
      break;
    case "set-default-exchanges":
      handleSetDefaultExchanges(message, botService);
      break;
    case Language.EN:
    case Language.RU:
    case Language.UA:
      botService.updateChatConfig(message.chat.id, {
        state: ChatState.SEARCHING,
      });
      handleLanguageInput(message, botService, data);
      break;
    case ChatState.SETTINGS:
      botService.updateChatConfig(message.chat.id, {
        state: ChatState.SETTINGS,
      });
      sendSettingsOptions(message, botService, "edit");
      break;
    case "subscription":
      // botService.updateChatConfig(message.chat.id, {
      //   state: ChatState.SUBSCRIPTION,
      // });
      sendSubscriptionOptions(message, botService);
      break;
    case "payment-methods":
      sendPaymentOptions(message, botService);
      break;
    case "binance-pay":
      handleBinancePay(message, botService);
      break;
    case "wallet-pay":
      handleWalletPay(message, botService);
      break;
    case "knowledge":
      sendKnowledgeBase(message, botService);
      break;
    case "terms":
      sendTerms(message, botService);
      break;
    case "things-to-know":
      sendToKnow(message, botService);
      break;
    case "how-to-use":
      sendHowToUse(message, botService);
      break;
    case "in-development":
      sendInDev(message, botService);
      break;
    default:
      break;
  }
};

export const handleSelectPairsInput = (
  message: Message,
  botService: BotService
) => {
  const config = botService.getChatConfig(message.chat.id);
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
  const isValidSubscription = isSubscriptionValid(config?.paidUntil);

  if (invalidSymbols.length) {
    setTimeout(
      () =>
        sendInvalidPairs(
          message.chat.id,
          botService,
          invalidSymbols.join(", ")
        ),
      200
    );
  }

  if (validSymbols.length) {
    if (!isValidSubscription) {
      botService.updateChatConfig(message.chat.id, {
        state: ChatState.SUBSCRIBE,
        selectedPairs: validSymbols,
      });

      setTimeout(
        () => sendSubscriptionOptions(message, botService, "send"),
        200
      );

      return botService.sendMessage(
        message.chat.id,
        i18next.t("settings-saved", { lng: config?.language })
      );
    }
    botService.updateChatConfig(message.chat.id, {
      selectedPairs: validSymbols,
      state: ChatState.SEARCHING,
    });

    botService.setPairsToSubscribe(validSymbols);
    botService.setNewPumpService(message.chat.id);
    sendCurrentPairs(message.chat.id, botService);
  }
};

export const handlePercentageInput = (
  message: Message,
  botService: BotService
) => {
  const config = botService.getChatConfig(message.chat.id);
  const match = message.text?.match(/(100(\.0+)?|[0-9]|[1-9][0-9])(\.\d+)?%?/);
  const percentage = match ? parseFloat(match[0]) : 0;

  if (
    percentage &&
    percentage >= MIN_PERCENTAGE &&
    percentage <= MAX_PERCENTAGE
  ) {
    botService.updateChatConfig(message.chat.id, {
      percentage,
      state: ChatState.SEARCHING,
    });

    botService.sendMessage(
      message.chat.id,
      i18next.t("settings-saved-general", {
        percentage,
        lng: config?.language,
      }),
      { parse_mode: "Markdown" as ParseMode }
    );

    return botService.setNewPumpService(message.chat.id);
  }

  return botService.sendMessage(
    message.chat.id,
    i18next.t("invalid-percentage", { lng: config?.language }),
    { parse_mode: "Markdown" as ParseMode }
  );
};

export const handleLanguageInput = (
  message: Message,
  botService: BotService,
  language: Language
) => {
  botService.updateChatConfig(message.chat.id, {
    language,
    state: ChatState.SEARCHING,
  });

  const commands = [
    { command: "start", description: i18next.t("start", { lng: language }) },
    {
      command: "settings",
      description: i18next.t("settings", { lng: language }),
    },
    {
      command: "knowledge",
      description: i18next.t("knowledge-base", { lng: language }),
    },
    { command: "help", description: i18next.t("help", { lng: language }) },
    { command: "stop", description: i18next.t("stop", { lng: language }) },
  ];

  const scope = {
    type: "chat" as BotCommandScopeDefault["type"],
    chat_id: message.chat.id,
    user_id: message.from?.id as number,
  };

  try {
    botService.bot.setMyCommands(commands, { scope });
  } catch (e) {
    console.log(e);
  }

  botService.bot.editMessageText(
    i18next.t("settings-saved", {
      lng: language,
    }),
    {
      chat_id: message.chat.id,
      message_id: message.message_id,
    }
  );
  botService.setNewPumpService(message.chat.id);
};

const handleSetDefaultExchanges = (
  message: Message,
  botService: BotService
) => {
  const config = botService.getChatConfig(message.chat.id);
  botService.updateChatConfig(message.chat.id, {
    stoppedExchanges: [],
    state: ChatState.SEARCHING,
  });

  botService.bot.editMessageText(
    i18next.t("settings-saved", {
      lng: config?.language,
    }),
    {
      chat_id: message.chat.id,
      message_id: message.message_id,
    }
  );

  botService.setNewPumpService(message.chat.id);
};

export const handleSelectWindowSizeInput = (
  message: Message,
  botService: BotService
) => {
  const config = botService.getChatConfig(message.chat.id);
  const match = message.text?.match(/^(0\.5|([1-9](\.\d+)?|10(\.0+)?)?)$/);
  const windowSizeInMinutes = match ? parseFloat(match[0]) : 0;
  const windowSizeMs = windowSizeInMinutes * 60000;

  if (
    windowSizeInMinutes &&
    windowSizeMs >= MIN_WINDOW_SIZE_MS &&
    windowSizeMs <= MAX_WINDOW_SIZE_MS
  ) {
    botService.updateChatConfig(message.chat.id, {
      windowSize: windowSizeMs,
      state: ChatState.SEARCHING,
    });

    botService.sendMessage(
      message.chat.id,
      i18next.t("settings-saved", { lng: config?.language }),
      { parse_mode: "Markdown" as ParseMode }
    );

    return botService.setNewPumpService(message.chat.id);
  }

  return botService.sendMessage(
    message.chat.id,
    i18next.t("invalid-window-size", { lng: config?.language }),
    { parse_mode: "Markdown" as ParseMode }
  );
};

export const handleBinancePay = async (
  message: Message,
  botService: BotService
) => {
  const config = botService.getChatConfig(message.chat.id);
  botService.bot.editMessageText(
    i18next.t("please-wait", { lng: config?.language }),
    {
      chat_id: message.chat.id,
      message_id: message.message_id,
    }
  );

  const paymentUrl = await retrievePaymentURL({ chatId: message.chat.id });

  if (paymentUrl) {
    setTimeout(
      () =>
        botService.bot.editMessageText(
          i18next.t("tap-to-open", { lng: config?.language }),
          {
            chat_id: message.chat.id,
            message_id: message.message_id,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: i18next.t("switch-to-binance", {
                      lng: config?.language,
                    }),
                    url: paymentUrl,
                  },
                ],
              ],
            },
          }
        ),
      300
    );
  } else {
    botService.bot.editMessageText(
      i18next.t("failed-binance", { lng: config?.language })
    );
  }
};

const handleWalletPay = async (message: Message, botService: BotService) => {
  const config = botService.getChatConfig(message.chat.id);
  botService.bot.editMessageText(
    i18next.t("please-wait", { lng: config?.language }),
    {
      chat_id: message.chat.id,
      message_id: message.message_id,
    }
  );

  const paymentUrl = await retrieveWalletPaymentUrl({
    chatId: message.chat.id,
  });

  if (paymentUrl) {
    setTimeout(
      () =>
        botService.bot.editMessageText(
          i18next.t("tap-to-open", { lng: config?.language }),
          {
            chat_id: message.chat.id,
            message_id: message.message_id,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: i18next.t("open-wallet", {
                      lng: config?.language,
                    }),
                    url: paymentUrl,
                  },
                ],
              ],
            },
          }
        ),
      300
    );
  } else {
    botService.bot.editMessageText(
      i18next.t("failed-wallet", { lng: config?.language }) +
        "\n\n" +
        "@pumpexsupport",
      {
        chat_id: message.chat.id,
        message_id: message.message_id,
      }
    );
  }
};
