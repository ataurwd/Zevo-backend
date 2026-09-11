import { MongoClient, Db } from "mongodb";
import { logger } from "../logger";

let client: MongoClient | null = null;
let db: Db | null = null;

const DEFAULT_URI = "mongodb://localhost:27017/nexora?replicaSet=rs0";
const DB_NAME = "nexora";

export async function connectDB(maxRetries = 5, retryDelayMs = 2000): Promise<Db> {
  if (db && client) {
    return db;
  }

  const uri = process.env.MONGODB_URI || DEFAULT_URI;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`Connecting to MongoDB (attempt ${attempt}/${maxRetries})...`);
      client = new MongoClient(uri, {
        maxPoolSize: 50,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
      });

      await client.connect();
      // Verify connection with a ping
      await client.db("admin").command({ ping: 1 });
      db = client.db(DB_NAME);
      logger.info("Successfully connected to MongoDB");
      return db;
    } catch (error) {
      logger.error({ err: error, attempt }, `Failed to connect to MongoDB on attempt ${attempt}`);
      if (client) {
        await client.close().catch(() => {});
        client = null;
      }
      if (attempt === maxRetries) {
        throw new Error(`Could not connect to MongoDB after ${maxRetries} attempts`);
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw new Error("MongoDB connection failed");
}

export function getDb(): Db {
  if (!db) {
    throw new Error("Database not initialized. Call connectDB() first.");
  }
  return db;
}

export function getClient(): MongoClient {
  if (!client) {
    throw new Error("MongoClient not initialized. Call connectDB() first.");
  }
  return client;
}

export async function checkDBHealth(): Promise<boolean> {
  if (!client) return false;
  try {
    await client.db("admin").command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

export async function closeDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    logger.info("MongoDB connection closed");
  }
}
