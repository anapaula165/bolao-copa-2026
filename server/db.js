import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
const isLocal = /localhost|127\.0\.0\.1/.test(connectionString || "");

if (!connectionString) {
  console.error("⚠  Faltou definir DATABASE_URL (veja o .env.example).");
}

export const pool = new Pool({
  connectionString,
  // Bancos na nuvem (Neon, Render, Supabase) exigem SSL; local não.
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      reset_token TEXT,
      reset_expires TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS predictions (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      locked BOOLEAN NOT NULL DEFAULT FALSE,
      locked_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      results JSONB NOT NULL DEFAULT '{}'::jsonb,
      CONSTRAINT app_state_singleton CHECK (id = 1)
    );
  `);
  await pool.query(
    `INSERT INTO app_state (id, config, results)
       VALUES (1, $1::jsonb, '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify({ deadline: process.env.DEADLINE || "2026-06-11T12:00", globalLock: false, bracketOpen: false, bracketLocked: false, bracketTeams: {} })]
  );
}
