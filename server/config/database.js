const path = require('path');
require('dotenv').config();

let activeDbMode = 'sqlite'; // 'postgres' | 'mysql' | 'sqlite'
let pgPool = null;
let mysqlPool = null;
let sqliteDb = null;

// Check if Postgres / Supabase connection is configured
const postgresUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const isPostgresConfigured = postgresUrl || process.env.DB_TYPE === 'postgres' || process.env.DB_TYPE === 'supabase';

if (isPostgresConfigured) {
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: postgresUrl || `postgres://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'db.wxltrwkyeqggpbfqeveq.supabase.co'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'postgres'}`,
      ssl: { rejectUnauthorized: false }
    });
    activeDbMode = 'postgres';
  } catch (err) {
    console.warn('pg pool init warning:', err.message);
  }
} else if (process.env.DB_TYPE === 'mysql') {
  try {
    const mysql = require('mysql2/promise');
    mysqlPool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'freelancer_payments',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4'
    });
    activeDbMode = 'mysql';
  } catch (e) {
    // mysql pool init error
  }
}

// Translate SQL query dialect for Postgres / Supabase
function adaptSqlForPostgres(sql) {
  let s = sql;
  s = s.replace(/DATE_SUB\(\s*NOW\(\)\s*,\s*INTERVAL\s*12\s*MONTH\s*\)/gi, "NOW() - INTERVAL '12 MONTH'");
  s = s.replace(/DATE_SUB\(\s*CURDATE\(\)\s*,\s*INTERVAL\s*1\s*MONTH\s*\)/gi, "CURRENT_DATE - INTERVAL '1 MONTH'");
  s = s.replace(/DATE_FORMAT\(\s*([a-zA-Z0-9_.]+)\s*,\s*'%Y-%m'\s*\)/gi, "to_char($1, 'YYYY-MM')");
  s = s.replace(/MONTH\(\s*CURDATE\(\)\s*\)/gi, "EXTRACT(MONTH FROM CURRENT_DATE)");
  s = s.replace(/YEAR\(\s*CURDATE\(\)\s*\)/gi, "EXTRACT(YEAR FROM CURRENT_DATE)");
  s = s.replace(/MONTH\s*\(([^)]+)\)/gi, "EXTRACT(MONTH FROM $1)");
  s = s.replace(/YEAR\s*\(([^)]+)\)/gi, "EXTRACT(YEAR FROM $1)");
  s = s.replace(/CURDATE\(\)/gi, "CURRENT_DATE");

  // If INSERT statement without RETURNING, append RETURNING id
  if (/^\s*INSERT\s+INTO\b/i.test(s) && !/\bRETURNING\b/i.test(s)) {
    s = s.replace(/;?\s*$/, ' RETURNING id;');
  }

  // Convert ? to $1, $2, $3...
  let paramIdx = 1;
  s = s.replace(/\?/g, () => `$${paramIdx++}`);
  return s;
}

// Translate SQL query dialect for SQLite
function adaptSqlForSqlite(sql) {
  let s = sql;
  s = s.replace(/DATE_SUB\(\s*NOW\(\)\s*,\s*INTERVAL\s*12\s*MONTH\s*\)/gi, "datetime('now', '-12 month')");
  s = s.replace(/DATE_SUB\(\s*CURDATE\(\)\s*,\s*INTERVAL\s*1\s*MONTH\s*\)/gi, "date('now', '-1 month')");
  s = s.replace(/DATE_FORMAT\(\s*([a-zA-Z0-9_.]+)\s*,\s*'%Y-%m'\s*\)/gi, "strftime('%Y-%m', $1)");
  s = s.replace(/MONTH\(\s*CURDATE\(\)\s*\)/gi, "CAST(strftime('%m', 'now') AS INTEGER)");
  s = s.replace(/YEAR\(\s*CURDATE\(\)\s*\)/gi, "CAST(strftime('%Y', 'now') AS INTEGER)");
  s = s.replace(/MONTH\(\s*([a-zA-Z0-9_.]+)\s*\)/gi, "CAST(strftime('%m', $1) AS INTEGER)");
  s = s.replace(/YEAR\(\s*([a-zA-Z0-9_.]+)\s*\)/gi, "CAST(strftime('%Y', $1) AS INTEGER)");
  s = s.replace(/CURDATE\(\)/gi, "date('now')");
  s = s.replace(/NOW\(\)/gi, "datetime('now')");
  s = s.replace(/ON DUPLICATE KEY UPDATE\s+name\s*=\s*VALUES\(name\)/gi, "ON CONFLICT(email) DO UPDATE SET name = excluded.name");
  return s;
}

function initSqlite() {
  if (sqliteDb) return sqliteDb;
  const { DatabaseSync } = require('node:sqlite');
  const dbFile = process.env.VERCEL
    ? path.join('/tmp', `${process.env.DB_NAME || 'freelancer_payments'}.sqlite`)
    : path.resolve(__dirname, '..', `${process.env.DB_NAME || 'freelancer_payments'}.sqlite`);
  sqliteDb = new DatabaseSync(dbFile);
  sqliteDb.exec('PRAGMA foreign_keys = ON;');

  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      business_name VARCHAR(255),
      phone VARCHAR(50),
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      company VARCHAR(255),
      phone VARCHAR(50),
      address TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(50) DEFAULT 'active',
      start_date DATE,
      end_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      due_date DATE,
      status VARCHAR(50) DEFAULT 'pending',
      payment_status VARCHAR(50) DEFAULT 'unpaid',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      project_id INTEGER,
      milestone_id INTEGER,
      invoice_number VARCHAR(50) UNIQUE NOT NULL,
      description TEXT,
      items TEXT,
      subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
      tax_rate DECIMAL(5,2) DEFAULT 0,
      tax_amount DECIMAL(12,2) DEFAULT 0,
      total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(50) DEFAULT 'draft',
      due_date DATE NOT NULL,
      issued_date DATE NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      invoice_id INTEGER,
      client_id INTEGER,
      paypal_order_id VARCHAR(255),
      paypal_capture_id VARCHAR(255),
      amount DECIMAL(12,2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'USD',
      status VARCHAR(50) DEFAULT 'pending',
      payment_method VARCHAR(50) DEFAULT 'paypal',
      description TEXT,
      transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      invoice_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      sent_at DATETIME NULL,
      status VARCHAR(50) DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );
  `);

  return sqliteDb;
}

async function initializeDatabase() {
  // 1. Try Supabase Postgres if configured
  if (isPostgresConfigured && pgPool) {
    try {
      const client = await pgPool.connect();
      console.log('✅ Connected to Supabase Postgres database');
      activeDbMode = 'postgres';
      client.release();
      return;
    } catch (err) {
      console.warn(`⚠️ Postgres connection error: ${err.message}. Checking fallbacks...`);
    }
  }

  // 2. Try MySQL if configured
  if (mysqlPool && process.env.DB_TYPE === 'mysql') {
    try {
      const mysql = require('mysql2/promise');
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        charset: 'utf8mb4'
      });
      await connection.query(
        `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'freelancer_payments'}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      await connection.end();
      activeDbMode = 'mysql';
      console.log('✅ Connected to MySQL database');
      return;
    } catch (err) {
      console.warn(`⚠️ MySQL unavailable (${err.message}). Falling back to local SQLite...`);
    }
  }

  // 3. Fallback to SQLite
  activeDbMode = 'sqlite';
  initSqlite();
  console.log('✅ Local persistent SQLite initialized for seamless offline operation');
}

function runSqliteQuery(sql, params = []) {
  const db = initSqlite();
  const adaptedSql = adaptSqlForSqlite(sql.trim());
  const normalizedParams = params.map(p => (p instanceof Date ? p.toISOString().split('T')[0] : p));

  const isSelect = /^\s*SELECT\b/i.test(adaptedSql);
  try {
    const stmt = db.prepare(adaptedSql);
    if (isSelect) {
      const rows = stmt.all(...normalizedParams);
      return [rows.map(r => ({ ...r })), []];
    } else {
      const info = stmt.run(...normalizedParams);
      return [{ insertId: Number(info.lastInsertRowid || 0), affectedRows: Number(info.changes || 0) }, []];
    }
  } catch (err) {
    console.error('SQLite execution error on query:', adaptedSql, err);
    throw err;
  }
}

async function runPostgresQuery(sql, params = []) {
  const adaptedSql = adaptSqlForPostgres(sql.trim());
  const normalizedParams = params.map(p => {
    if (typeof p === 'object' && p !== null && !(p instanceof Date)) {
      return JSON.stringify(p);
    }
    return p;
  });

  try {
    const res = await pgPool.query(adaptedSql, normalizedParams);
    const rows = res.rows || [];
    const insertId = rows[0]?.id ? Number(rows[0].id) : 0;
    const resultObj = {
      insertId,
      affectedRows: res.rowCount || 0
    };
    return [rows.length > 0 && /^\s*SELECT\b/i.test(adaptedSql) ? rows : (rows[0]?.id ? [resultObj] : resultObj), res.fields];
  } catch (err) {
    console.error('Postgres query error:', adaptedSql, err);
    throw err;
  }
}

const pool = {
  query: async (sql, params = []) => {
    if (activeDbMode === 'postgres' && pgPool) {
      try {
        return await runPostgresQuery(sql, params);
      } catch (err) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
          activeDbMode = 'sqlite';
          return runSqliteQuery(sql, params);
        }
        throw err;
      }
    }
    if (activeDbMode === 'sqlite') {
      return runSqliteQuery(sql, params);
    }
    try {
      return await mysqlPool.query(sql, params);
    } catch (err) {
      activeDbMode = 'sqlite';
      return runSqliteQuery(sql, params);
    }
  },
  getConnection: async () => {
    return {
      query: pool.query,
      release: () => {}
    };
  }
};

module.exports = { pool, initializeDatabase };
