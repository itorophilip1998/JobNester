import { PrismaClient, Prisma } from "@prisma/client";

export const db = new PrismaClient();

export const json = (x: unknown) =>
  JSON.parse(JSON.stringify(x)) as Prisma.InputJsonValue;
