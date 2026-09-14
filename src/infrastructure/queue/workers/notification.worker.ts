import { Worker, Job } from "bullmq";
import { getRedisClient } from "../../redis/client";
import { logger } from "../../logger";
import { notificationService } from "../../../modules/notifications/notification.service";
import { CreateNotificationDTO } from "../../../modules/notifications/notification.types";

const connection = getRedisClient();

export const notificationWorker = new Worker<CreateNotificationDTO>(
  "notification",
  async (job: Job<CreateNotificationDTO>) => {
    logger.info(
      { jobId: job.id, userId: job.data.user_id, type: job.data.type },
      "Processing notification job"
    );

    await notificationService.createNotification(job.data);
  },
  {
    connection,
    concurrency: 5,
  }
);

notificationWorker.on("completed", (job) => {
  logger.debug({ jobId: job.id }, "Notification job completed successfully");
});

notificationWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "Notification job failed");
});
