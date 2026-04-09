"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseQuery = void 0;
exports.executeQuery = executeQuery;
const database_1 = require("../config/database");
function encodeValue(value) {
    if (value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)) {
        return JSON.stringify(value);
    }
    if (Array.isArray(value) &&
        value.some((item) => item !== null && typeof item === "object")) {
        return JSON.stringify(value);
    }
    return value;
}
function buildWhereClause(filters = {}, startingIndex = 1) {
    const entries = Object.entries(filters).filter(([, value]) => value !== undefined);
    if (entries.length === 0) {
        return { clause: "", values: [] };
    }
    const values = entries.map(([, value]) => encodeValue(value));
    const clause = entries
        .map(([column], index) => `${column} = $${startingIndex + index}`)
        .join(" AND ");
    return {
        clause: ` WHERE ${clause}`,
        values,
    };
}
function normalizePayload(payload) {
    return Object.fromEntries(Object.entries(payload)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, encodeValue(value)]));
}
exports.supabaseQuery = {
    async raw(text, params = []) {
        return (0, database_1.query)(text, params);
    },
    async selectMany(table, options = {}) {
        const columns = options.columns?.length ? options.columns.join(", ") : "*";
        const where = buildWhereClause(options.where);
        const values = [...where.values];
        let sql = `SELECT ${columns} FROM ${table}${where.clause}`;
        if (options.orderBy) {
            sql += ` ORDER BY ${options.orderBy}`;
        }
        if (typeof options.limit === "number") {
            sql += ` LIMIT $${values.length + 1}`;
            values.push(options.limit);
        }
        const result = await (0, database_1.query)(sql, values);
        return result.rows;
    },
    async selectOne(table, options = {}) {
        const rows = await this.selectMany(table, {
            ...options,
            limit: 1,
        });
        return rows[0] ?? null;
    },
    async insert(table, payload) {
        const normalized = normalizePayload(payload);
        const columns = Object.keys(normalized);
        const values = Object.values(normalized);
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
        const sql = `
      INSERT INTO ${table} (${columns.join(", ")})
      VALUES (${placeholders})
      RETURNING *
    `;
        const result = await (0, database_1.query)(sql, values);
        return (result.rows[0] ?? null);
    },
    async update(table, payload, where) {
        const normalized = normalizePayload(payload);
        const updateEntries = Object.entries(normalized);
        if (updateEntries.length === 0) {
            throw new Error("Update payload cannot be empty");
        }
        const setClause = updateEntries
            .map(([column], index) => `${column} = $${index + 1}`)
            .join(", ");
        const updateValues = updateEntries.map(([, value]) => value);
        const whereClause = buildWhereClause(where, updateValues.length + 1);
        const sql = `
      UPDATE ${table}
      SET ${setClause}
      ${whereClause.clause}
      RETURNING *
    `;
        const result = await (0, database_1.query)(sql, [...updateValues, ...whereClause.values]);
        return result.rows;
    },
    async remove(table, where) {
        const whereClause = buildWhereClause(where);
        const sql = `
      DELETE FROM ${table}
      ${whereClause.clause}
      RETURNING *
    `;
        const result = await (0, database_1.query)(sql, whereClause.values);
        return result.rows;
    },
    async upsert(table, payload, conflictColumns, updateColumns) {
        const normalized = normalizePayload(payload);
        const columns = Object.keys(normalized);
        const values = Object.values(normalized);
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
        const columnsToUpdate = updateColumns?.length ? updateColumns : columns;
        const updateClause = columnsToUpdate
            .map((column) => `${column} = EXCLUDED.${column}`)
            .join(", ");
        const sql = `
      INSERT INTO ${table} (${columns.join(", ")})
      VALUES (${placeholders})
      ON CONFLICT (${conflictColumns.join(", ")})
      DO UPDATE SET ${updateClause}
      RETURNING *
    `;
        const result = await (0, database_1.query)(sql, values);
        return (result.rows[0] ?? null);
    },
};
async function executeQuery(sql, params = []) {
    try {
        const result = await (0, database_1.query)(sql, params);
        return {
            success: true,
            data: result.rows,
            error: null,
        };
    }
    catch (err) {
        console.error("DB ERROR:", err);
        return {
            success: false,
            data: null,
            error: err.message || "Database error",
        };
    }
}
//# sourceMappingURL=supabaseQuery.js.map