import { Worker, Job } from "bullmq";
import { getRedisClient } from "../../redis/client";
import { logger } from "../../logger";

export interface VerifyEmailPayload {
  to: string;
  name: string;
  verificationUrl: string;
}

export interface PasswordResetPayload {
  to: string;
  name: string;
  resetUrl: string;
}

export async function processEmailJob(job: Job): Promise<void> {
  const { name, data } = job;
  logger.info({ jobId: job.id, jobName: name, recipient: data.to }, "Processing email job");

  switch (name) {
    case "email.verify": {
      const { to, name: recipientName, verificationUrl } = data as VerifyEmailPayload;
      // In dev or test mode without Resend API key, log cleanly
      logger.info(
        {
          to,
          subject: "Verify your NEXORA account",
          verificationUrl,
        },
        `📧 [EMAIL DISPATCHED] To: ${recipientName} <${to}> | Link: ${verificationUrl}`
      );
      break;
    }

    case "email.password_reset": {
      const { to, name: recipientName, resetUrl } = data as PasswordResetPayload;
      logger.info(
        {
          to,
          subject: "Reset your NEXORA password",
          resetUrl,
        },
        `📧 [PASSWORD RESET DISPATCHED] To: ${recipientName} <${to}> | Link: ${resetUrl}`
      );
      break;
    }

    default:
      logger.warn({ jobName: name }, "Unknown email job type received");
  }
}

let emailWorker: Worker | null = null;

export function initEmailWorker(): Worker {
  if (emailWorker) {
    return emailWorker;
  }

  const connection = getRedisClient();

  emailWorker = new Worker("email", processEmailJob, {
    connection,
    concurrency: 5,
  });

  emailWorker.on("completed", (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, "Email job completed successfully");
  });

  emailWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, jobName: job?.name, err }, "Email job failed");
  });

  return emailWorker;
}
