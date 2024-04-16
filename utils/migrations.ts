import { ChatState, type ChatConfig } from "@prisma/client";
import { DateTime } from "luxon";
import { DEFAULT_PAIRS } from "./constants";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ["error"],
});

async function updateUsers() {
  const chats = await prisma.chatConfig.findMany({
    where: {
      state: ChatState.STOPPED,
    },
  });

  console.log(chats);

  // const updateUserPromises = chats.map((chat: ChatConfig) =>
  //   prisma.chatConfig.update({
  //     where: {
  //       id: chat.id,
  //     },
  //     data: {
  //       chatId: String(chat.chatId) as any,
  //     },
  //   })
  // );
  // await Promise.all(updateUserPromises);
  console.log("All users updated");
}

try {
  await updateUsers();
} catch (e) {
  console.error(e);
} finally {
  await prisma.$disconnect();
}
