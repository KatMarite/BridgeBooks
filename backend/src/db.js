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

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:admin123@localhost:5432/Bridge_dev'

const pool = new Pool({
  connectionString: DATABASE_URL,
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
