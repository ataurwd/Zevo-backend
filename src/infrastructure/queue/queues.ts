import { Queue, JobsOptions } from "bullmq";
import { getRedisClient } from "../redis/client";
import { logger } from "../logger";

export interface SafeQueue {
  add(name: string, data: any, opts?: JobsOptions): Promise<any>;
  close(): Promise<void>;
  name: string;
}

function createSafeQueue(name: string, defaultJobOptions: JobsOptions): SafeQueue {
  const connection = getRedisClient();

  if (!connection) {
    return {
      name,
      async add(jobName: string, data: any) {
        logger.info({ queue: name, job: jobName }, "Queue job accepted (in-memory / serverless mode without Redis)");
        return { id: `mock-${Date.now()}`, name: jobName, data };
      },
      async close() {},
    };
  }

  try {
    return new Queue(name, {
      connection,
      defaultJobOptions,
    });
  } catch (err) {
    logger.warn({ err, queue: name }, "Could not initialize BullMQ queue, using fallback queue");
    return {
      name,
      async add(jobName: string, data: any) {
        logger.info({ queue: name, job: jobName }, "Queue job accepted (fallback mode)");
        return { id: `mock-${Date.now()}`, name: jobName, data };
      },
      async close() {},
    };
  }
}

export const emailQueue = createSafeQueue("email", {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2000,
  },
  removeOnComplete: 100,
  removeOnFail: 500,
});

export const notificationQueue = createSafeQueue("notification", {
  attempts: 5,
  backoff: {
    type: "fixed",
    delay: 1000,
  },
  removeOnComplete: 100,
  removeOnFail: 500,
});

export const paymentQueue = createSafeQueue("payment", {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 2000,
  },
  removeOnComplete: 200,
  removeOnFail: 1000,
});

export const deliveryQueue = createSafeQueue("delivery", {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2000,
  },
  removeOnComplete: 100,
  removeOnFail: 500,
});

logger.info("Queues initialized: email, notification, payment, delivery");


