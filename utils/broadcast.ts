// import readline from "readline";
// import TelegramBot from "node-telegram-bot-api";
// import Bottleneck from "bottleneck";
// import { ChatState, PrismaClient } from "@prisma/client";
// import { DEFAULT_PAIRS } from "./constants";
// import i18next from "../i18n";

// const bot = new TelegramBot(process.env.TELEGRAM_API_PROD_TOKEN as string);

// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout,
// });

// // Функция для отправки сообщения всем пользователям
// async function broadcastMessage(i18nKey: string) {
//   const prisma = new PrismaClient({
//     log: ["error"],
//   });

//   // const chats = await prisma.chatConfig.findMany({
//   //   where: {
//   //     paidUntil: null,
//   //     state: {
//   //       not: ChatState.STOPPED,
//   //     },
//   //   },
//   // });

//   const limiter = new Bottleneck({
//     reservoir: 25,
//     reservoirRefreshAmount: 25,
//     reservoirRefreshInterval: 1000,
//     maxConcurrent: 1,
//     minTime: 40,
//   });

//   // chats.forEach((chat) => {
//   // const message = i18next.t(i18nKey, {
//   //   lng: chat.language,
//   //   pairs: DEFAULT_PAIRS.join(", ").trim(),
//   // });
//   const message = i18nKey;
//   const wrappedFunc = limiter.wrap(async () => {
//     try {
//       await bot.sendMessage(782417889, message, {
//         parse_mode: "Markdown",
//         disable_web_page_preview: true,
//       });
//     } catch (error) {
//       console.error("Error sending message to chat", 782417889, error);
//     }
//   });

//   wrappedFunc();
//   // });
// }

// // Запуск CLI
// async function startCommandLineInterface() {
//   rl.question("Введите сообщение для отправки: ", (i18nKey: string) => {
//     if (i18nKey.toLowerCase() === "exit") {
//       console.log("Выход из программы.");
//       rl.close();
//       process.exit(0);
//     } else {
//       broadcastMessage(i18nKey);
//       console.log("Сообщение отправлено!");
//       startCommandLineInterface();
//     }
//   });
// }

// startCommandLineInterface();
