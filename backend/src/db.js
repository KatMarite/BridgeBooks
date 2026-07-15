/**
 * db.js — PostgreSQL connection pool for BridgeBooks backend.
 *
 * Connects to PostgreSQL using the `pg` package.
 * Reads DATABASE_URL from environment, falling back to the local dev default.
 *
 * Exports:
 *   - pool:          The raw pg.Pool instance.
 *   - query(text, params):  Convenience wrapper for pool.query().
 *   - connectDb():   Attempts to connect; returns true/false.
 *   - isDbConnected: Boolean flag — true after a successful connectDb() call.
 */

import pg from 'pg'

const { Pool } = pg

const RAW_DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:admin123@localhost:5432/Bridge_dev'

// pg-connection-string reads `sslmode=require` out of the URL itself and
// treats it as an alias for 'verify-full' (full certificate chain
// validation against Node's trust store) — which then overrides whatever
// `ssl` option we pass to Pool below, and fails against Supabase's pooler
// cert ("self-signed certificate in certificate chain"). Strip it from the
// string so our explicit `ssl` option is the only thing that applies.
function stripSslMode(url) {
  const [base, query] = url.split('?')
  if (!query) return url
  const params = query.split('&').filter((p) => !p.startsWith('sslmode='))
  return params.length ? `${base}?${params.join('&')}` : base
}

const DATABASE_URL = stripSslMode(RAW_DATABASE_URL)

const pool = new Pool({
  connectionString: DATABASE_URL,
  // Still encrypts the connection — just doesn't validate Supabase's
  // certificate chain against Node's built-in CA list, same tradeoff
  // psycopg2's sslmode="require" makes on the Python side of this codebase.
  ssl: { rejectUnauthorized: false },
  // Keep the pool small for a dev/small-team backend
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

let isDbConnected = false

/**
 * Attempt to connect to PostgreSQL.
 * Logs the outcome and sets `isDbConnected`.
 * Does NOT throw — callers can check `isDbConnected` instead.
 */
async function connectDb() {
  try {
    const client = await pool.connect()
    // Quick sanity check
    await client.query('SELECT 1')
    client.release()
    isDbConnected = true
    // eslint-disable-next-line no-console
    console.log('✅ PostgreSQL connected:', DATABASE_URL.replace(/\/\/.*@/, '//<credentials>@'))
    return true
  } catch (err) {
    isDbConnected = false
    // eslint-disable-next-line no-console
    console.warn('⚠️  PostgreSQL not available — using in-memory mock data.')
    // eslint-disable-next-line no-console
    console.warn(`   Reason: ${err.message}`)
    return false
  }
}

/**
 * Run a parameterised SQL query.
 * @param {string} text — SQL statement with $1, $2, … placeholders.
 * @param {any[]}  params — Values for the placeholders.
 * @returns {Promise<import('pg').QueryResult>}
 */
function query(text, params) {
  return pool.query(text, params)
}

export { pool, query, connectDb, isDbConnected }
