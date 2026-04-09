import { PoolClient, QueryResultRow } from "pg";
import { getDbPool } from "../config/database";

export type SqlParam =
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>
  | unknown[];

function normalizeParam(param: SqlParam): unknown {
  if (
    param !== null &&
    typeof param === "object"
  ) {
    return JSON.stringify(param);
  }

  return param;
}

export async function executeSupabaseSql<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: SqlParam[] = [],
) {
  const normalizedParams = params.map(normalizeParam);
  const startedAt = Date.now();

  try {
    const result = await getDbPool().query<T>(sql, normalizedParams);
    console.log("Executed Supabase SQL", {
      duration: Date.now() - startedAt,
      rows: result.rowCount,
    });
    return result;
  } catch (error) {
    console.error("Supabase SQL execution failed", {
      sql,
      error,
    });
    throw error;
  }
}

export async function executeSupabaseSqlOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: SqlParam[] = [],
) {
  const result = await executeSupabaseSql<T>(sql, params);
  return result.rows[0] ?? null;
}

export async function executeSupabaseTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
) {
  const client = await getDbPool().connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
