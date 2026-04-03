import { Pool, PoolConfig } from "pg";
import { defineSecret } from "firebase-functions/params";

/**
 * Secret definition for the PostgreSQL connection string.
 * This should be set in the Firebase project using:
 * firebase functions:secrets:set DATABASE_URL
 */
export const dbUrlSecret = defineSecret("DATABASE_URL");

let pool: Pool;

/**
 * Returns the database pool, initializing it if it doesn't exist.
 * This pattern ensures connection reuse across function warm starts.
 */
export const getDbPool = () => {
  if (!pool) {
    const config: PoolConfig = {
      connectionString: dbUrlSecret.value(),
      // Max connections per function instance.
      // Keep this low to avoid exhausting the DB connection limit as you scale.
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: {
        // Supabase requires SSL.
        // rejectUnauthorized is set to false for standard Supabase connections.
        rejectUnauthorized: false,
      },
    };
    pool = new Pool(config);

    pool.on("error", (err) => {
      console.error("Unexpected error on idle PostgreSQL client", err);
    });
  }
  return pool;
};

/**
 * Execute a raw or parameterized SQL query.
 * @param text The SQL query string.
 * @param params Optional array of parameters to prevent SQL injection.
 */
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await getDbPool().query(text, params);
    const duration = Date.now() - start;
    console.log("Executed query", { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error("Database query error", { text, error });
    throw error;
  }
};

/**
 * Execute a PostgreSQL stored procedure (function).
 * @param fnName Name of the function to call.
 * @param params Array of parameters to pass to the function.
 */
export const executeFunction = async (fnName: string, params: any[]) => {
  const placeholders = params.map((_, i) => `$${i + 1}`).join(",");
  const sql = `SELECT * FROM ${fnName}(${placeholders})`;
  return query(sql, params);
};
