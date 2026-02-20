import { Pool, QueryResult, QueryResultRow } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';

let pool: Pool | null = null;
let db: NodePgDatabase | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export function getDb(): NodePgDatabase {
  if (!db) {
    db = drizzle(getPool());
  }
  return db;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}
