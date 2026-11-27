import { Queue } from "bullmq";
import { redisConnection } from "../config/index.js";

const connection = {
  host: new URL(redisConnection.url).hostname,
  port: Number(new URL(redisConnection.url).port) || 6379,
  password: new URL(redisConnection.url).password || undefined,
  username: new URL(redisConnection.url).username || undefined,
  tls: redisConnection.url.startsWith("rediss:") ? {} : undefined,
};

export const queue = new Queue(process.env.JOB_QUEUE_NAME || "jobnester", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});
