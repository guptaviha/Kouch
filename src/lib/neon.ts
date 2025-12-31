import { neon } from '@neondatabase/serverless';

const connectionString = process.env.NEXT_PUBLIC_NEON_URL;

export type NeonClient = ReturnType<typeof neon>;

let cachedClient: NeonClient | null = null;

function ensureConnectionString(): string {
  if (!connectionString) {
    throw new Error('Missing NEXT_PUBLIC_NEON_URL for database connection');
  }
  return connectionString;
}

export function getSqlClient(): NeonClient {
  if (!cachedClient) {
    cachedClient = neon(ensureConnectionString());
  }
  return cachedClient;
}

export async function withTransaction<T>(fn: (tx: NeonClient) => Promise<T>): Promise<T> {
  const sql = getSqlClient();
  return sql.begin(async (tx) => fn(tx));
}
