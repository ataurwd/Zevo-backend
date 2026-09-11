import { Queue } from "bullmq";
import { getRedisClient } from "../redis/client";
import { logger } from "../logger";

const connection = getRedisClient();

export const emailQueue = new Queue("email", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const notificationQueue = new Queue("notification", {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "fixed",
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

logger.info("BullMQ queues initialized: email, notification");
