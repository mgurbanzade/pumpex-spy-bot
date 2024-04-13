import schedule from "node-schedule";
import { ChatState } from "../types";
import type BotService from "./BotService";
import { sendHelpMessage } from "../utils/senders";
import { HELP_MESSAGE_SCHEDULE } from "../utils/constants";

export default class ScheduleService {
  private botService: BotService;

  constructor(botService: BotService) {
    this.botService = botService;
  }

  public async scheduleHelpMessage() {
    console.log("Scheduling help message...");

    schedule.scheduleJob(HELP_MESSAGE_SCHEDULE, async () => {
      const config = this.botService.config.getAll();
      const chats = Object.values(config);

      const filteredChats = chats.filter((chat) => {
        return !chat.paidUntil && chat.state !== ChatState.STOPPED;
      });

      filteredChats.forEach((chat) => {
        sendHelpMessage((chat as any).chatId, this.botService);
      });

      console.log("Help message sent to", filteredChats.length, "chats");
    });
  }
}
