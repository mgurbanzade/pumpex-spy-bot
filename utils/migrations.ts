import { ChatState, type ChatConfig } from "@prisma/client";
import { DateTime } from "luxon";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ["error"],
});

async function updateUsers() {
  const chats = await prisma.chatConfig.findMany({
    where: {
      state: ChatState.STOPPED,
      // trialUntil: {
      //   lt: DateTime.now().toJSDate(),
      // },
    },
  });

  console.log(chats.length);

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
  // await Promise.all(chats);
  console.log("All users updated");
}

try {
  await updateUsers();
} catch (e) {
  console.error(e);
} finally {
  await prisma.$disconnect();
}
