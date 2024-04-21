import express from "express";
import Queue, { type Job } from "bull";

import ConfigService from "./services/ConfigService";
import BotService from "./services/BotService";
import BinanceAPIService from "./services/BinanceAPIService";
import BybitAPIService from "./services/BybitAPIService";
import { EVENTS } from "./utils/constants";
import {
  adaptBinanceMessage,
  adaptBybitMessage,
  adaptCoinbaseMessage,
} from "./utils/adapters";
import CoinbaseAPIService from "./services/CoinbaseAPIService";
import {
  ChatState,
  type BinanceAggTradeMessage,
  type BybitTradeMessage,
  type ChatConfig,
  type CoinbaseTradeData,
  type WalletWebhookMessage,
} from "./types";
// import { validatePayment } from "./utils/payments";
import { verifyWalletSignature } from "./utils/wallet-pay";
import ScheduleService from "./services/ScheduleService";
import { isSubscriptionValid, isTrialValid } from "./utils/payments";

const messageQueue = new Queue("messageProcessing", {
  redis: {
    host: "localhost",
    port: 6379,
  },
});

const processMessage = async ({ data }: Job) => {
  const platform = data.platform;
  const message = data.message;

  const adaptDisaptcher = {
    binance: adaptBinanceMessage,
    bybit: adaptBybitMessage,
    coinbase: adaptCoinbaseMessage,
  };

  const adaptMessage =
    adaptDisaptcher[platform as "binance" | "bybit" | "coinbase"];
  const adaptedMessage = adaptMessage(message);
  bot.handleMessage(adaptedMessage);
  return;
};

messageQueue.process((job, done) => {
  processMessage(job)
    .then((result) => done(null, result))
    .catch((err) => done(err));
});

const addMessageToQueue = (
  message: BinanceAggTradeMessage | BybitTradeMessage | CoinbaseTradeData,
  platform: "binance" | "bybit" | "coinbase"
) => {
  messageQueue.add({
    message: message,
    platform,
  });
};

const bybit = new BybitAPIService();
const binance = new BinanceAPIService();
const coinbase = new CoinbaseAPIService();
const configService = new ConfigService();
const bot = new BotService(configService);
const scheduleService = new ScheduleService(bot);

const binanceSymbolsPromise = new Promise((resolve) => {
  binance.on(EVENTS.SYMBOLS_FETCHED, (symbols: string[]) => {
    bot.setAvailableSymbols(symbols);
    resolve(symbols);
    console.log("binance symbols fetched", symbols.length);
  });
});

const bybitSymbolsPromise = new Promise((resolve) => {
  bybit.on(EVENTS.SYMBOLS_FETCHED, (symbols: string[]) => {
    bot.setAvailableSymbols(symbols);
    resolve(symbols);
    console.log("bybit symbols fetched", symbols.length);
  });
});

const coinbaseSymbolsPromise = new Promise((resolve) => {
  coinbase.on(EVENTS.SYMBOLS_FETCHED, (symbols: string[]) => {
    bot.setAvailableSymbols(symbols);
    resolve(symbols);
    console.log("coinbase symbols fetched", symbols.length);
  });
});

Promise.all([
  binanceSymbolsPromise,
  bybitSymbolsPromise,
  coinbaseSymbolsPromise,
]).then(async () => {
  await configService.initialize();
  await bot.initialize();
});

binance.on(EVENTS.MESSAGE_RECEIVED, (message) => {
  addMessageToQueue(message, "binance");
});

bybit.on(EVENTS.MESSAGE_RECEIVED, (message) => {
  if (!message || !message.data) return;
  addMessageToQueue(message, "bybit");
});

coinbase.on(EVENTS.MESSAGE_RECEIVED, (message) => {
  if (!message || message.type !== "match") return;
  addMessageToQueue(message, "coinbase");
});

bot.on(EVENTS.SUBSCRIPTIONS_UPDATED, (symbols: string[]) => {
  const availableBybitSymbols = bybit.getSymbols();
  const availableBinanceSymbols = binance.getSymbols();
  const availableCoinbaseSymbols = coinbase.getSymbols();

  const bybitSymbols = symbols.filter((symbol) =>
    availableBybitSymbols.includes(symbol)
  );

  const binanceSymbols = symbols.filter((symbol) =>
    availableBinanceSymbols.includes(symbol)
  );

  const coinbaseSymbols = symbols.filter((symbol) =>
    availableCoinbaseSymbols.includes(symbol)
  );

  bybit.subscribeToStreams(bybitSymbols);
  binance.subscribeToStreams(binanceSymbols);
  coinbase.subscribeToStreams(coinbaseSymbols);
});

configService.on(EVENTS.CONFIG_LOADED, (config: ChatConfig[]) => {
  const pairs = config
    ?.filter((item: ChatConfig) => {
      const isValidTrial = isTrialValid(item.trialUntil);
      const isValidSubscription = isSubscriptionValid(item.paidUntil);
      return (
        (isValidTrial || isValidSubscription) &&
        item.state !== ChatState.STOPPED
      );
    })
    ?.map((item: ChatConfig) => item.selectedPairs)
    .flat() as string[];

  const uniquePairs = [...new Set(pairs)];

  if (uniquePairs.length) {
    bot.setPairsToSubscribe(uniquePairs);
  }

  scheduleService.scheduleHelpMessage();
  scheduleService.scheduleTrialCheck();
});

const app = express();
app.use(express.text());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// app.post("/payments/callback", (req, res) => {
//   const status = req.body.status;
//   const invoiceId = req.body.invoice_id;
//   const token = req.body.token;

//   if (status === "success") {
//     const isValid = validatePayment(token);
//     if (!isValid) return;

//     bot.handlePaymentSuccess(invoiceId);
//   } else {
//     // bot.handlePaymentFailure(chatId);
//   }

//   res.json({ message: "ok" });
// });

// app.post("/payments/binance/callback", (req, res) => {
//   console.log(req.body);

//   if (req.body.bizType === "PAY" && req.body?.bizStatus === "PAY_SUCCESS") {
//     bot.handleBinancePaySuccess(JSON.parse(req.body.data));
//   }

//   res.json({ message: "ok" });
// });

app.post("/payments/wallet/callback", (req, res) => {
  req.body?.forEach((event: WalletWebhookMessage) => {
    if (event?.type === "ORDER_PAID") {
      if (verifyWalletSignature(req)) {
        bot.handleWalletPaySuccess(event);
      }
    }
  });

  res.json({ message: "ok" });
});

app.listen(3001, () => {
  console.log("Server is running on port 3001");
});
