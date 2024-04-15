import { ChatState, type ChatConfig } from "@prisma/client";
import { DateTime } from "luxon";
import { DEFAULT_PAIRS } from "./constants";

const { PrismaClient } = require("@prisma/client");

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

  // // const trialUntil = DateTime.now().plus({ days: 3 }).toJSDate();
  // const updateUserPromises = chats.map((chat: ChatConfig) =>
  //   prisma.chatConfig.delete({
  //     where: {
  //       id: chat.id,
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
