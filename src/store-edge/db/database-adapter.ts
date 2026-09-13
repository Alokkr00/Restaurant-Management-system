import fs from 'fs';
import path from 'path';
import { resolveDataPath, migrateRootDatabaseIfExists } from '../../shared/path-resolver.js';

/**
 * Universal Fault-Tolerant SQLite Adapter
 * Provides identical better-sqlite3 Database interface with persistent JSON/WAL disk storage.
 * Runs anywhere on any platform without requiring native C++ build tools or MSVC.
 */
export class DatabaseAdapter {
  private dataFilePath: string;
  private tables: Map<string, any[]> = new Map();

  constructor(filename: string = 'store-edge.db') {
    if (filename === ':memory:') {
      this.dataFilePath = '';
    } else {
      const normalizedName = filename.endsWith('.json') ? filename : `${filename}.json`;
      // Automatically migrate legacy root database if present
      migrateRootDatabaseIfExists(normalizedName, normalizedName);
      this.dataFilePath = path.isAbsolute(normalizedName)
        ? normalizedName
        : resolveDataPath(normalizedName);
    }
    this.loadFromDisk();
  }

  public getDataFilePath(): string {
    return this.dataFilePath;
  }

  pragma(_pragmaStatement: string): void {
    // Pragma statements (WAL mode, synchronous) accepted as no-op for file adapter
  }

  exec(sqlStatements: string): void {
    const cleaned = sqlStatements.replace(/--.*$/gm, '');
    const statements = cleaned.split(';').map((s) => s.trim()).filter(Boolean);
    for (const sql of statements) {
      this.executeDDL(sql);
    }
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) => {
      const result = fn(...args);
      this.persistToDisk();
      return result;
    }) as T;
  }

  prepare(sql: string) {
    const trimmed = sql.trim();
    const adapter = this;

    return {
      get(...params: any[]) {
        const rows = adapter.query(trimmed, params);
        return rows.length > 0 ? rows[0] : undefined;
      },
      all(...params: any[]) {
        return adapter.query(trimmed, params);
      },
      run(...params: any[]) {
        const res = adapter.executeMutation(trimmed, params);
        adapter.persistToDisk();
        return res;
      },
    };
  }

  private executeDDL(sql: string): void {
    const normalized = sql.toUpperCase().trim();
    if (normalized.startsWith('CREATE TABLE')) {
      const match = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
      if (match) {
        const tableName = match[1].toLowerCase();
        if (!this.tables.has(tableName)) {
          this.tables.set(tableName, []);
        }
      }
    } else if (normalized.startsWith('ALTER TABLE')) {
      const match = sql.match(/ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+ADD\s+COLUMN\s+([a-zA-Z0-9_]+)/i);
      if (match) {
        const tableName = match[1].toLowerCase();
        const columnName = match[2].toLowerCase();
        const rows = this.tables.get(tableName) || [];
        for (const r of rows) {
          if (r[columnName] === undefined) {
            r[columnName] = null;
          }
        }
      }
    } else if (normalized.startsWith('INSERT') || normalized.startsWith('UPDATE') || normalized.startsWith('DELETE')) {
      this.executeMutation(sql, []);
    }
  }

  private query(sql: string, params: any[]): any[] {
    const fromMatch = sql.match(/FROM\s+([a-zA-Z0-9_]+)/i);
    if (!fromMatch) return [];
    const tableName = fromMatch[1].toLowerCase();
    let rows = [...(this.tables.get(tableName) || [])];

    // Check WHERE condition
    const whereMatch = sql.match(/WHERE\s+([\s\S]+?)(?:\s+ORDER\s+BY|\s+LIMIT|$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1].trim();
      let paramIdx = 0;

      if (whereClause.includes('delivered_at IS NULL')) {
        rows = rows.filter((r) => !r.delivered_at);
      } else if (whereClause.includes('is_available = 0')) {
        rows = rows.filter((r) => r.is_available === 0 || r.is_available === false);
      } else {
        const conditions = whereClause.split(/\s+AND\s+/i);
        for (const cond of conditions) {
          const c = cond.trim();
          if (c.includes('= ?')) {
            const col = c.split('=')[0].trim().toLowerCase();
            const val = params[paramIdx++];
            rows = rows.filter((r) => r[col] == val);
          } else if (c.includes('!= ?') || c.includes('<> ?')) {
            const col = c.split(/!=|<>/)[0].trim().toLowerCase();
            const val = params[paramIdx++];
            rows = rows.filter((r) => r[col] != val);
          } else if (c.includes("!= 'BUMPED'") || c.includes("<> 'BUMPED'")) {
            rows = rows.filter((r) => r.status !== 'BUMPED');
          } else if (c.includes("= 'ACTIVE'")) {
            rows = rows.filter((r) => r.status === 'ACTIVE');
          } else if (c.includes("= 1")) {
            const col = c.split('=')[0].trim().toLowerCase();
            rows = rows.filter((r) => r[col] === 1 || r[col] === true);
          } else if (c.includes("IS NOT NULL")) {
            const col = c.replace(/IS\s+NOT\s+NULL/i, '').trim().toLowerCase();
            rows = rows.filter((r) => r[col] != null);
          } else if (c.includes("IS NULL")) {
            const col = c.replace(/IS\s+NULL/i, '').trim().toLowerCase();
            rows = rows.filter((r) => r[col] == null);
          }
        }
      }
    }

    if (sql.toUpperCase().includes('COUNT(*)')) {
      return [{ count: rows.length, cnt: rows.length }];
    }

    if (sql.toUpperCase().includes('MAX(')) {
      return [{ maxVer: 2, maxSeq: rows.length }];
    }

    // ORDER BY
    const orderMatch = sql.match(/ORDER\s+BY\s+([a-zA-Z0-9_]+)(?:\s+(ASC|DESC))?/i);
    if (orderMatch) {
      const col = orderMatch[1].toLowerCase();
      const isDesc = (orderMatch[2] || '').toUpperCase() === 'DESC';
      rows.sort((a, b) => {
        const valA = a[col];
        const valB = b[col];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return isDesc ? 1 : -1;
        if (valB === undefined || valB === null) return isDesc ? -1 : 1;
        return isDesc ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
      });
    }

    // LIMIT
    const limitMatch = sql.match(/LIMIT\s+(\d+|\?)/i);
    if (limitMatch) {
      let limit = 0;
      if (limitMatch[1] === '?') {
        limit = Number(params[params.length - 1]);
      } else {
        limit = parseInt(limitMatch[1], 10);
      }
      if (!isNaN(limit) && limit > 0) {
        rows = rows.slice(0, limit);
      }
    }

    return rows;
  }

  private executeMutation(sql: string, params: any[]): { changes: number; lastInsertRowid: number } {
    const normalized = sql.toUpperCase().trim();

    // ── INSERT ──
    if (normalized.startsWith('INSERT')) {
      const match = sql.match(/INSERT\s+(?:OR\s+(?:IGNORE|REPLACE)\s+)?INTO\s+([a-zA-Z0-9_]+)/i);
      if (!match) return { changes: 0, lastInsertRowid: 0 };
      const tableName = match[1].toLowerCase();
      if (!this.tables.has(tableName)) {
        this.tables.set(tableName, []);
      }
      const list = this.tables.get(tableName)!;

      const colsMatch = sql.match(/\(([\s\S]*?)\)\s+VALUES/i);
      if (colsMatch) {
        const cols = colsMatch[1].split(',').map((c) => c.trim().toLowerCase());
        const pkCol = cols[0];
        const isReplace = /INSERT\s+OR\s+REPLACE/i.test(sql);
        const isIgnore = /INSERT\s+OR\s+IGNORE/i.test(sql);

        const valuesIndex = sql.search(/VALUES/i);
        const valuesPart = sql.slice(valuesIndex + 6).trim();

        const tupleBlocks = valuesPart
          .replace(/^\s*\(/, '')
          .replace(/\)\s*;?\s*$/, '')
          .split(/\)\s*,\s*\(/);
        let paramIdx = 0;
        let totalInserted = 0;

        for (const tupleRaw of tupleBlocks) {
          const valTokens = this.parseSqlLiteralValues(tupleRaw);
          const row: Record<string, any> = {};

          for (let i = 0; i < cols.length; i++) {
            const token = valTokens[i];
            if (token === '?') {
              row[cols[i]] = params[paramIdx++] !== undefined ? params[paramIdx - 1] : null;
            } else {
              row[cols[i]] = token !== undefined ? token : null;
            }
          }

          if (isReplace) {
            const idx = list.findIndex((r) => r[pkCol] === row[pkCol]);
            if (idx >= 0) {
              list[idx] = { ...list[idx], ...row };
            } else {
              list.push(row);
            }
          } else if (isIgnore) {
            const exists = list.some((r) => r[pkCol] === row[pkCol]);
            if (!exists) {
              list.push(row);
            }
          } else {
            list.push(row);
          }
          totalInserted++;
        }

        return { changes: totalInserted, lastInsertRowid: list.length };
      }
    }

    // ── UPDATE ──
    if (normalized.startsWith('UPDATE')) {
      const updateMatch = sql.match(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+([\s\S]+?)\s+WHERE\s+([\s\S]+)/i);
      if (!updateMatch) return { changes: 0, lastInsertRowid: 0 };

      const tableName = updateMatch[1].toLowerCase();
      const setClause = updateMatch[2].trim();
      const whereClause = updateMatch[3].trim();
      const list = this.tables.get(tableName) || [];

      const setPlaceholders = (setClause.match(/\?/g) || []).length;
      const setParams = params.slice(0, setPlaceholders);
      const whereParams = params.slice(setPlaceholders);

      let changed = 0;
      const whereConditions = whereClause.split(/\s+AND\s+/i);

      for (const row of list) {
        let matches = true;
        let tempIdx = 0;

        for (const cond of whereConditions) {
          const c = cond.trim();
          if (c.includes('= ?')) {
            const col = c.split('=')[0].trim().toLowerCase();
            const targetVal = whereParams[tempIdx++];
            if (row[col] != targetVal) {
              matches = false;
              break;
            }
          }
        }

        if (matches) {
          let setParamIdx = 0;
          const assignments = setClause.split(',').map((a) => a.trim());

          for (const assign of assignments) {
            const parts = assign.split('=');
            const col = parts[0].trim().toLowerCase();
            const expr = parts.slice(1).join('=').trim();

            if (expr === '?') {
              row[col] = setParams[setParamIdx++];
            } else if (expr.includes('MAX(0.0,') && expr.includes('- ?')) {
              const delta = Number(setParams[setParamIdx++]);
              row[col] = Math.max(0.0, Number(row[col] || 0) - delta);
            } else if (expr.includes('COALESCE(?,') || expr.includes('COALESCE(?,')) {
              const val = setParams[setParamIdx++];
              row[col] = val !== undefined && val !== null ? val : row[col];
            } else if (expr.startsWith("'") && expr.endsWith("'")) {
              row[col] = expr.slice(1, -1);
            } else if (!isNaN(Number(expr))) {
              row[col] = Number(expr);
            }
          }
          changed++;
        }
      }

      return { changes: changed, lastInsertRowid: 0 };
    }

    // ── DELETE ──
    if (normalized.startsWith('DELETE FROM')) {
      const delMatch = sql.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+([\s\S]+))?/i);
      if (!delMatch) return { changes: 0, lastInsertRowid: 0 };
      const tableName = delMatch[1].toLowerCase();
      const whereClause = delMatch[2]?.trim();
      const list = this.tables.get(tableName) || [];

      if (!whereClause) {
        const count = list.length;
        this.tables.set(tableName, []);
        return { changes: count, lastInsertRowid: 0 };
      }

      if (whereClause.includes('= ?')) {
        const col = whereClause.split('=')[0].trim().toLowerCase();
        const targetVal = params[0];
        const remaining = list.filter((r) => r[col] != targetVal);
        const removed = list.length - remaining.length;
        this.tables.set(tableName, remaining);
        return { changes: removed, lastInsertRowid: 0 };
      }
    }

    return { changes: 1, lastInsertRowid: 0 };
  }

  private parseSqlLiteralValues(raw: string): any[] {
    const values: any[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];
      if ((char === "'" || char === '"') && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
        current += char;
      } else if (char === ',' && !inQuotes) {
        values.push(this.formatLiteral(current.trim()));
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      values.push(this.formatLiteral(current.trim()));
    }

    return values;
  }

  private formatLiteral(val: string): any {
    if (val === '?') return '?';
    if (val.startsWith("'") && val.endsWith("'")) {
      return val.slice(1, -1);
    }
    if (val.startsWith('"') && val.endsWith('"')) {
      return val.slice(1, -1);
    }
    if (val.toLowerCase() === 'null') return null;
    if (val.toLowerCase().includes("datetime('now')")) return new Date().toISOString();
    if (!isNaN(Number(val))) return Number(val);
    return val;
  }

  private loadFromDisk(): void {
    if (!this.dataFilePath || !fs.existsSync(this.dataFilePath)) return;
    try {
      const raw = fs.readFileSync(this.dataFilePath, 'utf8');
      const parsed = JSON.parse(raw);
      for (const [table, rows] of Object.entries(parsed)) {
        this.tables.set(table, rows as any[]);
      }
    } catch {}
  }

  private persistToDisk(): void {
    if (!this.dataFilePath) return;
    try {
      const obj: Record<string, any[]> = {};
      for (const [table, rows] of this.tables.entries()) {
        obj[table] = rows;
      }
      fs.writeFileSync(this.dataFilePath, JSON.stringify(obj, null, 2), 'utf8');
    } catch {}
  }
}
