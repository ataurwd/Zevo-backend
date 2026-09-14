import { Worker, Job } from "bullmq";
import { getRedisClient } from "../../redis/client";
import { logger } from "../../logger";
import { deliveryService } from "../../../modules/delivery/delivery.service";
import { deliveryRepository } from "../../../modules/delivery/delivery.repository";

const connection = getRedisClient();

export const deliveryWorker = new Worker(
  "delivery",
  async (job: Job) => {
    logger.info(`Starting delivery job ${job.id} (${job.name})`);

    switch (job.name) {
      case "delivery.assign": {
        const { taskId } = job.data;
        if (taskId) {
          await deliveryService.autoAssignTask(taskId);
        }
        break;
      }

      case "delivery.timeout": {
        const { taskId } = job.data;
        if (taskId) {
          const task = await deliveryRepository.findTaskById(taskId);
          if (task && task.status === "assigned") {
            logger.warn({ taskId }, "Delivery assignment timed out; reassigning task");
            await deliveryRepository.updateTaskStatus(taskId, "unassigned", {
              delivery_agent_id: null,
            });
            await deliveryService.autoAssignTask(taskId);
          }
        }
        break;
      }

      default:
        logger.warn(`Unknown delivery job: ${job.name}`);
        break;
    }
  },
  {
    connection,
    concurrency: 5,
  }
);

deliveryWorker.on("completed", (job: Job) => {
  logger.debug({ jobId: job.id, name: job.name }, "Delivery job completed");
});

deliveryWorker.on("failed", (job: Job | undefined, err: Error) => {
  logger.error({ jobId: job?.id, name: job?.name, err }, "Delivery job failed");
});
