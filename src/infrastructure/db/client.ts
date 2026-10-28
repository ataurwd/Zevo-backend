import dns from "node:dns";
import { MongoClient, Db } from "mongodb";
import { logger } from "../logger";
import { bootstrapDatabase } from "./bootstrap";

// Ensure Node.js DNS resolver handles MongoDB Atlas SRV lookups reliably on Windows
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // Ignore in environments where setting DNS servers is not permitted
}

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  var _mongoClient: MongoClient | undefined;
  var _mongoDb: Db | undefined;
  var _mongoBootstrapped: boolean | undefined;
}

let lastConnectionError: Error | null = null;

// Explicit meaningful database name configured directly in CODE (not from URL)
export const CODE_CONFIGURED_DB_NAME = "zevo_marketplace_db";

export function getDatabaseName(): string {
  // Code-defined database name has first-class priority, with env override if provided
  const explicit = process.env.MONGODB_DB_NAME || process.env.DB_NAME || process.env.DATABASE_NAME;
  if (explicit && explicit.trim() && explicit.trim() !== "default" && explicit.trim() !== "test") {
    return explicit.trim();
  }
  return CODE_CONFIGURED_DB_NAME;
}

const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.SERVERLESS
);

const MONGO_OPTIONS = {
  maxPoolSize: isServerless ? 10 : 50,
  minPoolSize: isServerless ? 0 : 5,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 15000,
  socketTimeoutMS: 45000,
  maxIdleTimeMS: 30000,
};

async function ensureBootstrapped(targetDb: Db): Promise<void> {
  if (globalThis._mongoBootstrapped || process.env.SKIP_DB_BOOTSTRAP === "true") {
    return;
  }

  try {
    // Quick count: If users collection has at least 1 document, we are already seeded
    const userCount = await targetDb.collection("users").countDocuments({}, { limit: 1 });
    if (userCount > 0) {
      globalThis._mongoBootstrapped = true;
      return;
    }

    logger.info("Empty database detected. Running initial bootstrap seeding...");
    await bootstrapDatabase(targetDb);
    globalThis._mongoBootstrapped = true;
  } catch (err) {
    logger.warn({ err }, "Bootstrap check failed, proceeding without blocking");
  }
}

export async function connectDB(maxRetries = 3, retryDelayMs = 1500): Promise<Db> {
  // 1. Fast path: return existing cached db if already connected
  if (globalThis._mongoDb && globalThis._mongoClient) {
    return globalThis._mongoDb;
  }

  const dbName = getDatabaseName();
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";

  // 2. Re-use pending connection promise if another request is already connecting
  if (!globalThis._mongoClientPromise) {
    globalThis._mongoClientPromise = (async () => {
      let lastErr: Error | null = null;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          logger.info(
            `Connecting to MongoDB [${uri.replace(/:[^:@]+@/, ":****@")}] [${dbName}] (attempt ${attempt}/${maxRetries})...`
          );
          const client = new MongoClient(uri, MONGO_OPTIONS);
          await client.connect();
          const targetDb = client.db(dbName);
          await targetDb.command({ ping: 1 });

          globalThis._mongoClient = client;
          globalThis._mongoDb = targetDb;
          lastConnectionError = null;

          logger.info(`Successfully connected to MongoDB database: [${dbName}]`);

          // Run fast / non-blocking bootstrap check
          await ensureBootstrapped(targetDb);

          return client;
        } catch (err: any) {
          lastErr = err instanceof Error ? err : new Error(String(err));
          logger.error({ err, attempt }, `MongoDB connection attempt ${attempt} failed`);
          if (attempt === maxRetries) {
            lastConnectionError = lastErr;
            globalThis._mongoClientPromise = undefined;
            throw lastErr;
          }
          await new Promise((r) => setTimeout(r, retryDelayMs));
        }
      }
      throw lastErr || new Error("MongoDB connection failed");
    })();
  }

  try {
    const client = await globalThis._mongoClientPromise;
    const targetDb = client.db(dbName);
    globalThis._mongoClient = client;
    globalThis._mongoDb = targetDb;
    return targetDb;
  } catch (err) {
    globalThis._mongoClientPromise = undefined;
    throw err;
  }
}

export async function ensureConnected(): Promise<Db> {
  if (globalThis._mongoDb && globalThis._mongoClient) {
    return globalThis._mongoDb;
  }
  return await connectDB(2, 1000);
}

export function isDbConnected(): boolean {
  return Boolean(globalThis._mongoDb && globalThis._mongoClient);
}

export function getDb(): Db {
  const db = globalThis._mongoDb;
  if (!db) {
    if (lastConnectionError) {
      const msg = lastConnectionError.message || String(lastConnectionError);
      if (msg.includes("bad auth") || msg.includes("Authentication failed")) {
        throw new Error(
          "MongoDB Atlas Authentication Failed: 'bad auth'. The username or password in MONGODB_URI is invalid. Please check your Database User in MongoDB Atlas -> Security -> Database Access."
        );
      }
      if (msg.includes("ECONNREFUSED") || msg.includes("querySrv")) {
        throw new Error(
          `MongoDB Connection Error (${msg}). Unable to reach database host. Please verify your internet connection or MongoDB Atlas cluster network access (0.0.0.0/0).`
        );
      }
      throw new Error(`MongoDB connection error: ${msg}.`);
    }
    throw new Error("Database not connected. Please verify your MONGODB_URI in Vercel environment variables.");
  }
  return db;
}

export function getClient(): MongoClient {
  if (!globalThis._mongoClient) {
    throw new Error("MongoClient not initialized. Call connectDB() or ensureConnected() first.");
  }
  return globalThis._mongoClient;
}

export async function checkDBHealth(): Promise<boolean> {
  try {
    if (!globalThis._mongoClient) {
      await ensureConnected();
    }
    if (!globalThis._mongoClient) return false;
    const dbName = getDatabaseName();
    await globalThis._mongoClient.db(dbName).command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

export async function closeDB(): Promise<void> {
  if (globalThis._mongoClient) {
    await globalThis._mongoClient.close();
    globalThis._mongoClient = undefined;
    globalThis._mongoDb = undefined;
    globalThis._mongoClientPromise = undefined;
    logger.info("MongoDB connection closed");
  }
}

