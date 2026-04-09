"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeSupabaseSql = executeSupabaseSql;
exports.executeSupabaseSqlOne = executeSupabaseSqlOne;
exports.executeSupabaseTransaction = executeSupabaseTransaction;
const database_1 = require("../config/database");
function normalizeParam(param) {
    if (param !== null &&
        typeof param === "object") {
        return JSON.stringify(param);
    }
    return param;
}
async function executeSupabaseSql(sql, params = []) {
    const normalizedParams = params.map(normalizeParam);
    const startedAt = Date.now();
    try {
        const result = await (0, database_1.getDbPool)().query(sql, normalizedParams);
        console.log("Executed Supabase SQL", {
            duration: Date.now() - startedAt,
            rows: result.rowCount,
        });
        return result;
    }
    catch (error) {
        console.error("Supabase SQL execution failed", {
            sql,
            error,
        });
        throw error;
    }
}
async function executeSupabaseSqlOne(sql, params = []) {
    const result = await executeSupabaseSql(sql, params);
    return result.rows[0] ?? null;
}
async function executeSupabaseTransaction(callback) {
    const client = await (0, database_1.getDbPool)().connect();
    try {
        await client.query("BEGIN");
        const result = await callback(client);
        await client.query("COMMIT");
        return result;
    }
    catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=supabaseSql.js.map