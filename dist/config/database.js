"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeSupabaseTransaction = exports.executeSupabaseSqlOne = exports.executeSupabaseSql = exports.executeFunction = exports.query = exports.getDbPool = exports.dbUrlSecret = void 0;
const pg_1 = require("pg");
const params_1 = require("firebase-functions/params");
/**
 * Secret definition for the PostgreSQL connection string.
 * This should be set in the Firebase project using:
 * firebase functions:secrets:set DATABASE_URL
 */
exports.dbUrlSecret = (0, params_1.defineSecret)("DATABASE_URL");
let pool;
/**
 * Returns the database pool, initializing it if it doesn't exist.
 * This pattern ensures connection reuse across function warm starts.
 */
const getDbPool = () => {
    if (!pool) {
        const config = {
            connectionString: exports.dbUrlSecret.value(),
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
        pool = new pg_1.Pool(config);
        pool.on("error", (err) => {
            console.error("Unexpected error on idle PostgreSQL client", err);
        });
    }
    return pool;
};
exports.getDbPool = getDbPool;
/**
 * Execute a raw or parameterized SQL query.
 * @param text The SQL query string.
 * @param params Optional array of parameters to prevent SQL injection.
 */
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await (0, exports.getDbPool)().query(text, params);
        const duration = Date.now() - start;
        console.log("Executed query", { text, duration, rows: res.rowCount });
        return res;
    }
    catch (error) {
        console.error("Database query error", { text, error });
        throw error;
    }
};
exports.query = query;
/**
 * Execute a PostgreSQL stored procedure (function).
 * @param fnName Name of the function to call.
 * @param params Array of parameters to pass to the function.
 */
const executeFunction = async (fnName, params) => {
    const placeholders = params.map((_, i) => `$${i + 1}`).join(",");
    const sql = `SELECT * FROM ${fnName}(${placeholders})`;
    return (0, exports.query)(sql, params);
};
exports.executeFunction = executeFunction;
var supabaseSql_1 = require("../utils/supabaseSql");
Object.defineProperty(exports, "executeSupabaseSql", { enumerable: true, get: function () { return supabaseSql_1.executeSupabaseSql; } });
Object.defineProperty(exports, "executeSupabaseSqlOne", { enumerable: true, get: function () { return supabaseSql_1.executeSupabaseSqlOne; } });
Object.defineProperty(exports, "executeSupabaseTransaction", { enumerable: true, get: function () { return supabaseSql_1.executeSupabaseTransaction; } });
//# sourceMappingURL=database.js.map