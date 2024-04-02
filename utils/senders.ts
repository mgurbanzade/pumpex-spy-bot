import type { Message, ParseMode } from "node-telegram-bot-api";
import i18next from "../i18n";
import type BotService from "../services/BotService";
import { type ChatConfig, ChatState, Language } from "../types";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PERCENTAGE,
  DEFAULT_SUBSCRIPTION_PRICE,
  DEFAULT_WINDOW_SIZE_MS,
  MAX_WINDOW_SIZE_MS,
  MIN_PERCENTAGE,
  MIN_WINDOW_SIZE_MS,
  // PAY_URL,
  SUPPORT_CHAT_URL,
} from "./constants";
import { isSubscriptionValid } from "./payments";
import { DateTime } from "luxon";

export const sendGreetings = (
  chatId: number,
  botService: BotService,
  config: ChatConfig
) => {
  return botService.sendMessage(
    chatId,
    i18next.t("greeting", {
      lng: config.language,
      percentage: config.percentage,
    }),
    {
      parse_mode: "Markdown" as ParseMode,
    }
  );
};

export const sendSelectPairs = (
  message: Message,
  botService: BotService,
  action: "send" | "edit" = "send"
) => {
  const chatConfig = botService.getChatConfig(message.chat.id);
  const withBackButton =
    action === "edit"
      ? {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: i18next.t("back", {
                    lng: chatConfig?.language,
                  }),
                  callback_data: ChatState.SETTINGS,
                },
              ],
            ],
          },
        }
      : {};

  const options = {
    parse_mode: "Markdown" as ParseMode,
    ...withBackButton,
  };

  if (action === "edit") {
    return botService.bot.editMessageText(
      i18next.t("select-pairs-desc", {
        lng: chatConfig?.language,
      }),
      {
        chat_id: message.chat.id,
        message_id: message.message_id,
        ...options,
      }
    );
  }

  botService.bot.sendMessage(
    message.chat.id,
    i18next.t("select-pairs-desc", {
      lng: chatConfig?.language,
    }),
    options
  );
};

export const sendAlreadyStarted = (
  message: Message,
  botService: BotService,
  config: ChatConfig
) => {
  return botService.sendMessage(
    message.chat.id,
    i18next.t("already-started", {
      lng: config.language,
      percentage: config.percentage,
    }),
    {
      parse_mode: "Markdown" as ParseMode,
    }
  );
};

export const sendCurrentPairs = (chatId: number, botService: BotService) => {
  const chatConfig = botService.getChatConfig(chatId);

  if (chatConfig?.selectedPairs.length) {
    const startedTranslation = i18next.t("started", {
      lng: chatConfig.language,
    });
    const percentageTranslation = i18next.t("current-percentage", {
      lng: chatConfig.language,
      percentage: chatConfig.percentage,
    });

    const messageTranslation = i18next.t("current-pairs", {
      lng: chatConfig.language,
    });
    const message = `${startedTranslation}\n\n${percentageTranslation}\n\n${messageTranslation}\n\n${chatConfig.selectedPairs.join(
      ", "
    )}`;

    return botService.sendMessage(chatId, message, {
      parse_mode: "Markdown" as ParseMode,
    });
  }
};

export const sendInvalidPairs = (
  chatId: number,
  botService: BotService,
  invalidPairs: string
) => {
  const chatConfig = botService.getChatConfig(chatId);
  return botService.sendMessage(
    chatId,
    i18next.t("invalid-pairs", {
      invalidPairs,
      lng: chatConfig?.language,
    }),
    { parse_mode: "Markdown" as ParseMode }
  );
};

export const sendSettingsOptions = (
  msg: Message,
  botService: BotService,
  action: "edit" | "send" = "send"
) => {
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
          {
            text: i18next.t("select-percentage", {
              lng,
            }),
            callback_data: "select-percentage",
          },
        ],
        [
          {
            text: i18next.t("select-window-size", {
              lng,
            }),
            callback_data: ChatState.SELECT_WINDOW_SIZE,
          },
          {
            text: i18next.t("stop-exchanges", {
              lng,
            }),
            callback_data: "stop-exchanges",
          },
        ],
        [
          {
            text: i18next.t("select-language", {
              lng,
            }),
            callback_data: "select-language",
          },
          {
            text: i18next.t("subscription", {
              lng,
            }),
            callback_data: "subscription",
          },
        ],
      ],
    },
  };

  if (action === "edit") {
    return botService.bot.editMessageText(
      i18next.t("select-settings", {
        lng,
      }),
      {
        chat_id: msg.chat.id,
        message_id: msg.message_id,
        ...options,
      }
    );
  }

  botService.bot.sendMessage(
    msg.chat.id,
    i18next.t("select-settings", {
      lng,
    }),
    options
  );
};

export const sendHelpOptions = (msg: Message, botService: BotService) => {
  const config = botService.getChatConfig(msg.chat.id);
  const lng = config?.language || DEFAULT_LANGUAGE;

  const options = {
    parse_mode: "Markdown" as ParseMode,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: i18next.t("help", {
              lng,
            }),
            url: SUPPORT_CHAT_URL,
          },
        ],
      ],
    },
  };

  botService.bot.sendMessage(
    msg.chat.id,
    i18next.t("tap-to-open", { lng }),
    options
  );
};

export const sendExchangesOptions = (
  message: Message,
  botService: BotService
) => {
  const config = botService.getChatConfig(message.chat.id);
  const lng = config?.language || DEFAULT_LANGUAGE;

  const options = {
    parse_mode: "Markdown" as ParseMode,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "❌ Binance",
            callback_data: "binance",
          },
          {
            text: "❌ Bybit",
            callback_data: "bybit",
          },
          {
            text: "❌ Coinbase",
            callback_data: "coinbase",
          },
        ],
        [
          {
            text: i18next.t("set-default", {
              lng: config?.language,
            }),
            callback_data: "set-default-exchanges",
          },
        ],
        [
          {
            text: i18next.t("back", {
              lng: config?.language,
            }),
            callback_data: ChatState.SETTINGS,
          },
        ],
      ],
    },
  };

  botService.bot.editMessageText(
    i18next.t("stop-exchanges-header", {
      lng,
    }),
    {
      chat_id: message.chat.id,
      message_id: message.message_id,
      ...options,
    }
  );
};

export const sendPercentageOptions = (
  message: Message,
  botService: BotService
) => {
  const config = botService.getChatConfig(message.chat.id);
  const options = {
    parse_mode: "Markdown" as ParseMode,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: i18next.t("back", {
              lng: config?.language,
            }),
            callback_data: ChatState.SETTINGS,
          },
        ],
      ],
    },
  };
  botService.bot.editMessageText(
    i18next.t("select-percentage-desc", {
      default: DEFAULT_PERCENTAGE,
      min: MIN_PERCENTAGE,
      lng: config?.language,
    }),
    {
      chat_id: message.chat.id,
      message_id: message.message_id,
      ...options,
    }
  );
};

export const sendSelectLanguages = (
  message: Message,
  botService: BotService
) => {
  const config = botService.getChatConfig(message.chat.id);
  const options = {
    parse_mode: "Markdown" as ParseMode,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🇬🇧 English", callback_data: Language.EN },
          {
            text: "🇷🇺 Русский",
            callback_data: Language.RU,
          },
          { text: "🇺🇦 Українська", callback_data: Language.UA },
        ],
        [
          {
            text: i18next.t("back", {
              lng: config?.language,
            }),
            callback_data: ChatState.SETTINGS,
          },
        ],
      ],
    },
  };

  botService.bot.editMessageText(
    `*${i18next.t("select-language", {
      lng: config?.language,
    })}:*`,
    {
      chat_id: message.chat.id,
      message_id: message.message_id,
      ...options,
    }
  );
};

export const sendWindowSizeOptions = (
  message: Message,
  botService: BotService
) => {
  const config = botService.getChatConfig(message.chat.id);
  const options = {
    parse_mode: "Markdown" as ParseMode,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: i18next.t("back", {
              lng: config?.language,
            }),
            callback_data: ChatState.SETTINGS,
          },
        ],
      ],
    },
  };

  botService.bot.editMessageText(
    i18next.t("select-window-size-desc", {
      lng: config?.language,
      min: MIN_WINDOW_SIZE_MS / 60000,
      default: DEFAULT_WINDOW_SIZE_MS / 60000,
      max: MAX_WINDOW_SIZE_MS / 60000,
    }),
    {
      chat_id: message.chat.id,
      message_id: message.message_id,
      ...options,
    }
  );
};

export const sendSubscriptionOptions = (
  message: Message,
  botService: BotService,
  action: "edit" | "send" = "edit"
) => {
  const config = botService.getChatConfig(message.chat.id);
  const opts = {
    parse_mode: "Markdown" as ParseMode,
    message_id: message.message_id,
    chat_id: message.chat.id,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: i18next.t("back", {
              lng: config?.language,
            }),
            callback_data: ChatState.SETTINGS,
          },
        ],
      ],
    },
  };

  if (isSubscriptionValid(config?.paidUntil)) {
    const date = DateTime.fromJSDate(config?.paidUntil as Date).toFormat(
      "dd.MM.yyyy"
    );
    return botService.bot.editMessageText(
      i18next.t("subscription-active-until", {
        lng: config?.language,
        date,
      }),
      opts
    );
  }

  // const paramsForUrl = new URLSearchParams({
  //   chatId: message.chat.id.toString(),
  //   username: message.chat.username || "",
  //   locale: config?.language || DEFAULT_LANGUAGE,
  //   amount: DEFAULT_SUBSCRIPTION_PRICE.toString(),
  // });

  const options = {
    parse_mode: "Markdown" as ParseMode,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: i18next.t("subscription-btn", {
              lng: config?.language,
              amount: DEFAULT_SUBSCRIPTION_PRICE,
            }),
            callback_data: "payment-methods",
            // web_app: {
            //   url: PAY_URL + "?" + paramsForUrl.toString(),
            // },
          },
        ],
        action === "edit"
          ? [
              {
                text: i18next.t("back", {
                  lng: config?.language,
                }),
                callback_data: ChatState.SETTINGS,
              },
            ]
          : [],
      ],
    },
  };

  if (action === "send") {
    return botService.sendMessage(
      message.chat.id,
      i18next.t("subscription-desc", {
        lng: config?.language,
      }),
      options
    );
  }

  botService.bot.editMessageText(
    i18next.t("subscription-desc", {
      lng: config?.language,
    }),
    {
      ...options,
      chat_id: message.chat.id,
      message_id: message.message_id,
    }
  );
};

export const sendPaymentSuccess = (
  chatId: number,
  botService: BotService,
  date: string
) => {
  const config = botService.getChatConfig(chatId);
  const message = `${i18next.t("payment-success", {
    lng: config?.language,
  })}\n\n${i18next.t("subscription-active-until", {
    lng: config?.language,
    date,
  })}`;

  return botService.sendMessage(chatId, message, {
    parse_mode: "Markdown" as ParseMode,
  });
};

export const sendPaymentOptions = (
  message: Message,
  botService: BotService
) => {
  const config = botService.getChatConfig(message.chat.id);
  const options = {
    parse_mode: "Markdown" as ParseMode,
    reply_markup: {
      inline_keyboard: [
        // [
        //   {
        //     text: i18next.t("binance-pay", {
        //       lng: config?.language,
        //     }),
        //     callback_data: "binance-pay",
        //   },
        // ],
        [
          {
            text: i18next.t("wallet-pay", {
              lng: config?.language,
            }),
            callback_data: "wallet-pay",
          },
        ],
        [
          {
            text: i18next.t("back", {
              lng: config?.language,
            }),
            callback_data: ChatState.SETTINGS,
          },
        ],
      ],
    },
  };

  botService.bot.editMessageText(
    i18next.t("choose-payment-method", {
      lng: config?.language,
    }),
    {
      ...options,
      chat_id: message.chat.id,
      message_id: message.message_id,
    }
  );
};

export const sendKnowledgeBase = (
  message: Message,
  botService: BotService,
  action: "send" | "edit" = "edit"
) => {
  const config = botService.getChatConfig(message.chat.id);

  const options = {
    parse_mode: "Markdown" as ParseMode,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: i18next.t("terms", {
              lng: config?.language,
            }),
            callback_data: "terms",
          },
        ],
        [
          {
            text: i18next.t("things-to-know", {
              lng: config?.language,
            }),
            callback_data: "things-to-know",
          },
        ],
        [
          {
            text: i18next.t("how-to-use", {
              lng: config?.language,
            }),
            callback_data: "how-to-use",
          },
        ],
        [
          {
            text: i18next.t("in-development", {
              lng: config?.language,
            }),
            callback_data: "in-development",
          },
        ],
        // [
        //   {
        //     text: i18next.t("back", {
        //       lng: config?.language,
        //     }),
        //     callback_data: "knowledge",
        //   },
        // ],
      ],
    },
  };

  if (message.message_id && action === "edit") {
    return botService.bot.editMessageText(
      i18next.t("knowledge-base", {
        lng: config.language,
      }),
      {
        ...options,
        message_id: message.message_id,
        chat_id: message.chat.id,
      }
    );
  }

  return botService.sendMessage(
    message.chat.id,
    i18next.t("knowledge-base", {
      lng: config.language,
    }),
    options
  );
};

export const sendTerms = (message: Message, botService: BotService) => {
  const config = botService.getChatConfig(message.chat.id);

  const options = {
    parse_mode: "Markdown" as ParseMode,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: i18next.t("back", {
              lng: config?.language,
            }),
            callback_data: "knowledge",
          },
        ],
      ],
    },
  };

  botService.bot.editMessageText(
    i18next.t("terms-desc", {
      lng: config?.language,
    }),
    {
      ...options,
      chat_id: message.chat.id,
      message_id: message.message_id,
    }
  );
};

export const sendToKnow = (message: Message, botService: BotService) => {
  const config = botService.getChatConfig(message.chat.id);

  const options = {
    parse_mode: "Markdown" as ParseMode,
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: i18next.t("back", {
              lng: config?.language,
            }),
            callback_data: "knowledge",
          },
        ],
      ],
    },
  };

  botService.bot.editMessageText(
    i18next.t("to-know-desc", {
      lng: config?.language,
    }),
    {
      ...options,
      chat_id: message.chat.id,
      message_id: message.message_id,
    }
  );
};

export const sendHowToUse = (message: Message, botService: BotService) => {
  const config = botService.getChatConfig(message.chat.id);

  const options = {
    parse_mode: "Markdown" as ParseMode,
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: i18next.t("back", {
              lng: config?.language,
            }),
            callback_data: "knowledge",
          },
        ],
      ],
    },
  };

  botService.bot.editMessageText(
    i18next.t("how-to-desc", {
      lng: config?.language,
    }),
    {
      ...options,
      chat_id: message.chat.id,
      message_id: message.message_id,
    }
  );
};

export const sendInDev = (message: Message, botService: BotService) => {
  const config = botService.getChatConfig(message.chat.id);

  const options = {
    parse_mode: "Markdown" as ParseMode,
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: i18next.t("back", {
              lng: config?.language,
            }),
            callback_data: "knowledge",
          },
        ],
      ],
    },
  };

  botService.bot.editMessageText(
    i18next.t("in-dev-desc", {
      lng: config?.language,
    }),
    {
      ...options,
      chat_id: message.chat.id,
      message_id: message.message_id,
    }
  );
};
