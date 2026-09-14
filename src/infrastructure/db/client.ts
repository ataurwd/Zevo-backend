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

let client: MongoClient | null = null;
let db: Db | null = null;
let lastConnectionError: Error | null = null;
let isConnecting = false;

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

export async function connectDB(maxRetries = 5, retryDelayMs = 2000): Promise<Db> {
  if (db && client) {
    return db;
  }

  isConnecting = true;
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const dbName = getDatabaseName();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(
        `Connecting to MongoDB at [${uri.replace(/:[^:@]+@/, ":****@")}] with code-configured database [${dbName}] (attempt ${attempt}/${maxRetries})...`
      );
      client = new MongoClient(uri, {
        maxPoolSize: 50,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
      });

      await client.connect();
      // Target database directly in code (does not require db name in connection URL)
      db = client.db(dbName);
      // Verify connection by pinging the target database directly (compatible with standard user roles)
      await db.command({ ping: 1 });
      logger.info(`Successfully connected to MongoDB database: [${dbName}]`);
      lastConnectionError = null;

      // Initialize initial documents directly in MongoDB if collections are empty (skips if already present)
      await bootstrapDatabase(db);

      isConnecting = false;
      return db;
    } catch (error: any) {
      lastConnectionError = error instanceof Error ? error : new Error(String(error));
      logger.error({ err: error, attempt }, `Failed to connect to MongoDB on attempt ${attempt}`);
      if (client) {
        await client.close().catch(() => {});
        client = null;
        db = null;
      }
      if (attempt === maxRetries) {
        isConnecting = false;
        throw lastConnectionError;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  isConnecting = false;
  throw lastConnectionError || new Error("MongoDB connection failed");
}

export async function ensureConnected(): Promise<Db> {
  if (db && client) {
    return db;
  }
  if (isConnecting) {
    // Wait briefly if connection already in progress
    await new Promise((resolve) => setTimeout(resolve, 800));
    if (db) return db;
  }
  return await connectDB(1, 1000);
}

export function isDbConnected(): boolean {
  return db !== null && client !== null;
}

export function getDb(): Db {
  if (!db) {
    if (lastConnectionError) {
      const msg = lastConnectionError.message || String(lastConnectionError);
      if (msg.includes("bad auth") || msg.includes("Authentication failed")) {
        throw new Error(
          "MongoDB Atlas Authentication Failed: 'bad auth'. The username or password in apps/backend/.env is invalid. Please check your Database User in MongoDB Atlas -> Security -> Database Access."
        );
      }
      if (msg.includes("ECONNREFUSED") || msg.includes("querySrv")) {
        throw new Error(
          `MongoDB Connection Error (${msg}). Unable to reach database host. Please verify your internet connection or MongoDB Atlas cluster status.`
        );
      }
      throw new Error(`MongoDB connection error: ${msg}.`);
    }
    throw new Error("Database not connected. Please verify your MongoDB connection string in apps/backend/.env.");
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
  if (!client || !db) return false;
  try {
    const dbName = getDatabaseName();
    await client.db(dbName).command({ ping: 1 });
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
