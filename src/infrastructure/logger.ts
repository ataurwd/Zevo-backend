import pino from "pino";

const isProduction = process.env.NODE_ENV === "production" || process.env.RENDER === "true";

let transport: any = undefined;

if (!isProduction) {
  try {
    require.resolve("pino-pretty");
    transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
        ignore: "pid,hostname",
      },
    };
  } catch {
    transport = undefined;
  }
}

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  transport,
  base: {
    service: "nexora-api",
    env: process.env.NODE_ENV || (isProduction ? "production" : "development"),
  },
});
