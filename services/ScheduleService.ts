import schedule from "node-schedule";
import { ChatState } from "../types";
import type BotService from "./BotService";
import { sendHelpMessage, sendTrialEndedMessage } from "../utils/senders";
import {
  HELP_MESSAGE_SCHEDULE,
  TRIAL_END_MESSAGE_SCHEDULE,
} from "../utils/constants";
import { isTrialValid } from "../utils/payments";

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
        const isValidTrial = isTrialValid(chat.trialUntil);
        return (
          !isValidTrial && !chat.paidUntil && chat.state !== ChatState.STOPPED
        );
      });

      filteredChats.forEach((chat) => {
        sendHelpMessage((chat as any).chatId, this.botService);
      });

      console.log("Help message sent to", filteredChats.length, "chats");
    });
  }

  public async scheduleTrialCheck() {
    console.log("Scheduling trial check...");

    schedule.scheduleJob(TRIAL_END_MESSAGE_SCHEDULE, async () => {
      const config = this.botService.config.getAll();
      const chats = Object.values(config);

      const filteredChats = chats.filter((chat) => {
        return !chat.paidUntil && !isTrialValid(chat.trialUntil);
      });

      filteredChats.forEach((chat) => {
        sendTrialEndedMessage((chat as any).chatId, this.botService);
      });

      console.log("Trial ended message sent to", filteredChats.length, "chats");
    });
  }
}
