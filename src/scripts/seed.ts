import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { connectDB, closeDB, getDatabaseName } from "../infrastructure/db/client";
import { bootstrapDatabase } from "../infrastructure/db/bootstrap";

async function runSeed() {
  const dbName = getDatabaseName();
  console.log(`====================================================`);
  console.log(`Starting Zevo Marketplace Database Seed for [${dbName}]...`);
  console.log(`====================================================`);

  const db = await connectDB(3, 1000);
  
  // Run bootstrap in force mode to cleanly seed all users, stores, categories, and products
  await bootstrapDatabase(db, true);

  const usersCount = await db.collection("users").countDocuments();
  const storesCount = await db.collection("stores").countDocuments();
  const categoriesCount = await db.collection("categories").countDocuments();
  const productsCount = await db.collection("products").countDocuments();

  console.log(`\n🎉 Seed Completed Successfully for database: [${dbName}]!`);
  console.log(`- Users:      ${usersCount}`);
  console.log(`- Stores:     ${storesCount}`);
  console.log(`- Categories: ${categoriesCount}`);
  console.log(`- Products:   ${productsCount}`);
  console.log(`====================================================\n`);

  await closeDB();
}

runSeed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
