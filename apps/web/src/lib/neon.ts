import { Pool } from '@neondatabase/serverless';
import type { PoolClient } from '@neondatabase/serverless';

const connectionString = process.env.NEXT_PUBLIC_NEON_URL;

// Define the interface for our SQL client which supports:
// 1. Tagged template literal execution: await sql`SELECT ...`
// 2. Transaction handling: await sql.begin(async tx => ...)
export type SqlClient = {
  (strings: TemplateStringsArray, ...values: any[]): Promise<any[]>;
  begin: <T>(fn: (tx: SqlClient) => Promise<T>) => Promise<T>;
};

// Export alias for compatibility
export type NeonClient = SqlClient;

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    if (!connectionString) {
      throw new Error('Missing NEXT_PUBLIC_NEON_URL for database connection');
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

async function executeQuery(
  client: Pool | PoolClient,
  strings: TemplateStringsArray,
  values: any[]
): Promise<any[]> {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) {
    text += `$${i + 1}` + strings[i + 1];
  }
  const result = await client.query(text, values);
  return result.rows;
}

function createSqlClient(clientGetter: () => Pool | PoolClient): SqlClient {
  const sql = async (strings: TemplateStringsArray, ...values: any[]) => {
    return executeQuery(clientGetter(), strings, values);
  };

  sql.begin = async <T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> => {
    const executor = clientGetter();

    // Check if executor is a Pool (has connect method)
    const isPool = 'connect' in executor && typeof (executor as Pool).connect === 'function';

    if (isPool) {
      const client = await (executor as Pool).connect();
      try {
        await client.query('BEGIN');
        const txSql = createSqlClient(() => client);
        const result = await fn(txSql);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      // Nested transaction (using SAVEPOINT)
      const client = executor as PoolClient;
      // Generate a simple unique savepoint name
      const savepointId = `sp_${Math.random().toString(36).substring(2, 9)}`;

      try {
        await client.query(`SAVEPOINT ${savepointId}`);
        const txSql = createSqlClient(() => client);
        const result = await fn(txSql);
        await client.query(`RELEASE SAVEPOINT ${savepointId}`);
        return result;
      } catch (err) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepointId}`);
        throw err;
      }
    }
  };

  return sql as SqlClient;
}

let cachedSql: SqlClient | null = null;

export function getSqlClient(): SqlClient {
  if (!cachedSql) {
    cachedSql = createSqlClient(() => getPool());
  }
  return cachedSql;
}

export async function withTransaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
  const sql = getSqlClient();
  return sql.begin(fn);
}
