import { QueryResultRow } from "pg";
import { query } from "../config/database";

type Primitive = string | number | boolean | null;
type QueryValue = Primitive | Primitive[] | Record<string, unknown> | unknown[];

type WhereClause = Record<string, QueryValue>;

function encodeValue(value: QueryValue): QueryValue {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return JSON.stringify(value);
  }

  if (
    Array.isArray(value) &&
    value.some((item) => item !== null && typeof item === "object")
  ) {
    return JSON.stringify(value);
  }

  return value;
}

function buildWhereClause(
  filters: WhereClause = {},
  startingIndex = 1,
): { clause: string; values: QueryValue[] } {
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

function normalizePayload(payload: Record<string, QueryValue>) {
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, encodeValue(value)]),
  );
}

export const supabaseQuery = {
  async raw<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: QueryValue[] = [],
  ) {
    return query(text, params) as Promise<{ rows: T[]; rowCount: number | null }>;
  },

  async selectMany<T extends QueryResultRow = QueryResultRow>(
    table: string,
    options: {
      columns?: string[];
      where?: WhereClause;
      orderBy?: string;
      limit?: number;
    } = {},
  ) {
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

    const result = await query(sql, values);
    return result.rows as T[];
  },

  async selectOne<T extends QueryResultRow = QueryResultRow>(
    table: string,
    options: {
      columns?: string[];
      where?: WhereClause;
      orderBy?: string;
    } = {},
  ) {
    const rows = await this.selectMany<T>(table, {
      ...options,
      limit: 1,
    });

    return rows[0] ?? null;
  },

  async insert<T extends QueryResultRow = QueryResultRow>(
    table: string,
    payload: Record<string, QueryValue>,
  ) {
    const normalized = normalizePayload(payload);
    const columns = Object.keys(normalized);
    const values = Object.values(normalized);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");

    const sql = `
      INSERT INTO ${table} (${columns.join(", ")})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await query(sql, values);
    return (result.rows[0] ?? null) as T | null;
  },

  async update<T extends QueryResultRow = QueryResultRow>(
    table: string,
    payload: Record<string, QueryValue>,
    where: WhereClause,
  ) {
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

    const result = await query(sql, [...updateValues, ...whereClause.values]);
    return result.rows as T[];
  },

  async remove<T extends QueryResultRow = QueryResultRow>(
    table: string,
    where: WhereClause,
  ) {
    const whereClause = buildWhereClause(where);
    const sql = `
      DELETE FROM ${table}
      ${whereClause.clause}
      RETURNING *
    `;

    const result = await query(sql, whereClause.values);
    return result.rows as T[];
  },

  async upsert<T extends QueryResultRow = QueryResultRow>(
    table: string,
    payload: Record<string, QueryValue>,
    conflictColumns: string[],
    updateColumns?: string[],
  ) {
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

    const result = await query(sql, values);
    return (result.rows[0] ?? null) as T | null;
  },
};


type DBResponse<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
};

export async function executeQuery<T = any>(
  sql: string,
  params: any[] = []
): Promise<DBResponse<T[]>> {
  try {
    const result = await query(sql, params);

    return {
      success: true,
      data: result.rows,
      error: null,
    };
  } catch (err: any) {
    console.error("DB ERROR:", err);

    return {
      success: false,
      data: null,
      error: err.message || "Database error",
    };
  }
}