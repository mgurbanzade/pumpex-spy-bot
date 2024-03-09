import EventEmitter from "events";
import { EVENTS } from "../utils/constants";
import { PrismaClient, Prisma } from "@prisma/client";
import type { ChatConfig } from "../types";

export type ConfigType = {
  [key: string]: ChatConfig;
};

class ConfigService extends EventEmitter {
  private prisma: PrismaClient;
  public config: ConfigType;

  constructor() {
    super();
    this.config = {};
    this.prisma = new PrismaClient({
      log: ["error"],
    });
  }

  public async initialize() {
    try {
      const res = await this.prisma.chatConfig.findMany();
      this.config = res.reduce((acc, curr) => {
        return {
          ...acc,
          [curr.chatId]: curr,
        };
      }, {});

      this.emit(EVENTS.CONFIG_LOADED, res);
    } catch (e) {
      console.error("Something went wrong. ConfigService.initialize", e);
    }
  }

  public createChatConfig(data: Prisma.ChatConfigCreateInput) {
    const { id, ...rest } = data;

    this.config = {
      ...this.config,
      [data.chatId]: rest,
    };

    return this.prisma.chatConfig.create({ data });
  }

  public get(chatId: number): ChatConfig {
    return this.config[chatId];
  }

  public getAll() {
    return this.config;
  }

  public async update(chatId: number, data: Prisma.ChatConfigUpdateInput) {
    const res = await this.prisma.chatConfig.update({
      where: { chatId },
      data,
    });

    return res;
  }

  public async set(
    chatId: number,
    config: Partial<Prisma.ChatConfigUpdateInput>
  ) {
    (this.config as any)[chatId] = {
      ...this.config[chatId],
      ...config,
    };

    this.update(chatId, config);
  }

  public syncWithDB() {
    // implement
  }
}

export default ConfigService;
