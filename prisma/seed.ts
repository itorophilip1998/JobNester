import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { emptyState } from '@jobnester/core';
const db=new PrismaClient();const s=emptyState();
await db.owner.upsert({where:{id:'owner'},update:{},create:{id:'owner',profile:s.profile as unknown as Prisma.InputJsonValue,modes:s.modes as unknown as Prisma.InputJsonValue,settings:s.settings as unknown as Prisma.InputJsonValue,portfolioDraft:s.portfolio as unknown as Prisma.InputJsonValue}});
console.log('Owner initialized. No experience or jobs have been invented.');
await db.$disconnect();
