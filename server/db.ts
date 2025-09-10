import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.RENDER_DATABASE_URL) {
  throw new Error(
    "RENDER_DATABASE_URL must be set. Please add your Render PostgreSQL connection string.",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.RENDER_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
export const db = drizzle(pool, { schema });