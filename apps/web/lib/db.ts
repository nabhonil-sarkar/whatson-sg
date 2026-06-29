import { Pool } from "pg";

// A single shared connection pool for the whole app. On Vercel's serverless
// runtime, modules are reused across invocations within a warm instance, so
// defining the pool at module scope avoids opening a new connection on every
// request. The global cache guards against multiple pools during dev hot-reload.
const globalForPool = globalThis as unknown as { pool?: Pool };

export const pool =
  globalForPool.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") globalForPool.pool = pool;