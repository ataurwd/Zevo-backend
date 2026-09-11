import { Worker, Job } from "bullmq";
import { getRedisClient } from "../../redis/client";
import { logger } from "../../logger";
import { PaymentService } from "../../../modules/payments/payment.service";

const connection = getRedisClient();

export const paymentWorker = new Worker(
  "payment",
  async (job: Job) => {
    logger.info(`Starting payment job ${job.id} (${job.name})`);

    switch (job.name) {
      case "payment.process_webhook": {
        const { event } = job.data;
        await PaymentService.handleWebhookEvent(event);
        break;
      }

      case "payment.transfer": {
        const { subOrderId } = job.data;
        await PaymentService.processTransfer(subOrderId);
        break;
      }

      default:
        logger.warn(`Unknown payment job name: ${job.name}`);
        break;
    }
  },
  {
    connection,
    concurrency: 5,
  }
);

paymentWorker.on("completed", (job: Job) => {
  logger.info(`Payment job ${job.id} (${job.name}) completed`);
});

paymentWorker.on("failed", (job: Job | undefined, err: Error) => {
  logger.error(
    { err, jobId: job?.id, jobName: job?.name },
    `Payment job ${job?.id} failed`
  );
});
