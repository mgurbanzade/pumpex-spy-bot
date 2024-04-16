import type { Message } from "node-telegram-bot-api";

export const splitIntoGroups = (arr: string[], groupSize: number) => {
  const groups = [];

  for (let i = 0; i < arr.length; i += groupSize) {
    groups.push(arr.slice(i, i + groupSize));
  }

  return groups;
};

export const isNegativeChatId = (message: Message) => {
  return (
    message.chat.id < 0 ||
    message.from?.is_bot ||
    !message.from?.id ||
    message.from?.id < 0
  );
};
