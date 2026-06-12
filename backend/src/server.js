import express from 'express'
import cors from 'cors'
import { BOOKS } from './data/books.js'
import { connectDb, isDbConnected, query } from './db.js'
import { verifyShopifyWebhook } from './middleware/shopifyAuth.js'

const app = express()

app.use(cors())
// Webhooks require raw body for HMAC signature verification
app.use('/api/webhooks/shopify', express.raw({ type: 'application/json' }))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, dbConnected: isDbConnected })
})

/* ===========================================================================
   Authentication
   =========================================================================== */

const USERS = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@bridgebooks.co.za',
    password: 'bridge2026',
    role: 'admin',
  },
  {
    id: '2',
    name: 'Staff Member',
    email: 'staff@bridgebooks.co.za',
    password: 'staff2026',
    role: 'staff',
  },
]

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { token, user: { id, name, email, role } }
 *
 * NOTE: This is a development-only mock. Replace with real JWT auth
 * once the production database and user management are in place.
 */
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' })
  }

  const normalised = email.trim().toLowerCase()
  const found = USERS.find(
    (u) => u.email === normalised && u.password === password
  )

  if (!found) {
    return res.status(401).json({ message: 'Invalid email or password.' })
  }

  // Build a development-only fake JWT (not cryptographically valid)
  const payload = Buffer.from(
    JSON.stringify({ sub: found.id, email: found.email, role: found.role })
  ).toString('base64')
  const token = `dev.${payload}.signature`

  const { password: _pw, ...userWithoutPassword } = found
  res.json({ token, user: userWithoutPassword })
})

/* ===========================================================================
   System Sync Logs
   =========================================================================== */

/**
 * GET /api/system/sync-logs
 * Returns sync status for each primary supplier.
 *
 * The frontend Status page expects:
 *   [{ supplier, lastSyncTime, rowsProcessed, errorsFlagged, status }]
 */
app.get('/api/system/sync-logs', (_req, res) => {
  const now = Date.now()

  const syncLogs = [
    {
      supplier: 'Booksite',
      lastSyncTime: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      rowsProcessed: 1247,
      errorsFlagged: 0,
      status: 'success',
    },
    {
      supplier: 'Jonathan Ball',
      lastSyncTime: new Date(now - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
      rowsProcessed: 834,
      errorsFlagged: 3,
      status: 'success',
    },
    {
      supplier: 'Protea',
      lastSyncTime: new Date(now - 48 * 60 * 60 * 1000).toISOString(), // 48 hours ago — will show as stale
      rowsProcessed: 0,
      errorsFlagged: 8,
      status: 'failed',
    },
    {
      supplier: 'Indie Authors',
      lastSyncTime: new Date(now - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
      rowsProcessed: 23,
      errorsFlagged: 0,
      status: 'success',
    },
  ]

  res.json(syncLogs)
})

function normalizeQuery(q) {
  return (q || '').toString().trim()
}

function stripIsbnFormatting(value) {
  return (value || '').toString().replace(/[-\s]/g, '')
}

function matchesBook(book, q, field) {
  const needle = q.toLowerCase()

  const byTitle = (book.title || '').toLowerCase().includes(needle)
  const byAuthor = (book.author || '').toLowerCase().includes(needle)

  const byIsbn = stripIsbnFormatting(book.isbn).includes(stripIsbnFormatting(q))

  if (field === 'isbn') return byIsbn
  if (field === 'title') return byTitle
  if (field === 'author') return byAuthor

  return byIsbn || byTitle || byAuthor
}

/**
 * Book search endpoint
 * GET /api/books?q=...&field=all|isbn|title|author
 */
app.get('/api/books', async (req, res) => {
  const q = normalizeQuery(req.query.q)
  const field = (req.query.field || 'all').toString().toLowerCase()

  if (!q) return res.json([])

  // ── 1. PostgreSQL dual-mode integration ──
  if (isDbConnected) {
    try {
      // Build SQL based on search field
      let whereClause = ''
      let param = `%${q}%`
      
      if (field === 'isbn') {
        whereClause = 'WHERE b.isbn_13 ILIKE $1'
        param = `%${stripIsbnFormatting(q)}%`
      } else if (field === 'title') {
        whereClause = 'WHERE b.title ILIKE $1'
      } else if (field === 'author') {
        whereClause = 'WHERE b.author ILIKE $1'
      } else {
        whereClause = 'WHERE b.title ILIKE $1 OR b.author ILIKE $1 OR b.isbn_13 ILIKE $1'
      }

      // Query books and aggregate their supplier prices
      const sql = `
        SELECT 
          b.isbn_13 AS isbn, 
          b.title, 
          b.author, 
          b.publication_date AS "publicationDate", 
          b.cover_image_url AS "coverImageUrl",
          b.description,
          b.page_count AS "pageCount",
          json_object_agg(
            sp.supplier_name,
            json_build_object(
              'price', sp.retail_price,
              'inStock', sp.in_stock,
              'qty', sp.stock_quantity
            )
          ) FILTER (WHERE sp.supplier_name IS NOT NULL) AS suppliers
        FROM books b
        LEFT JOIN supplier_prices sp ON b.isbn_13 = sp.isbn_13
        ${whereClause}
        GROUP BY b.isbn_13
        LIMIT 50
      `
      
      const result = await query(sql, [param])
      return res.json(result.rows)
    } catch (err) {
      console.error('Database query failed, falling back to mock:', err)
      // Fall through to mock logic on failure
    }
  }

  // ── 2. Fallback in-memory mock logic ──
  const results = BOOKS.filter((b) => matchesBook(b, q, field))
  res.json(results)
})

/**
 * GET /api/books/:id
 * Fetch a single book by ISBN.
 */
app.get('/api/books/:id', async (req, res) => {
  const { id } = req.params

  if (isDbConnected) {
    try {
      const sql = `
        SELECT 
          b.isbn_13 AS isbn, 
          b.title, 
          b.author, 
          b.publication_date AS "publicationDate", 
          b.cover_image_url AS "coverImageUrl",
          b.description,
          b.page_count AS "pageCount",
          json_object_agg(
            sp.supplier_name,
            json_build_object(
              'price', sp.retail_price,
              'inStock', sp.in_stock,
              'qty', sp.stock_quantity
            )
          ) FILTER (WHERE sp.supplier_name IS NOT NULL) AS suppliers
        FROM books b
        LEFT JOIN supplier_prices sp ON b.isbn_13 = sp.isbn_13
        WHERE b.isbn_13 = $1
        GROUP BY b.isbn_13
      `
      const result = await query(sql, [id])
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Book not found' })
      }
      return res.json(result.rows[0])
    } catch (err) {
      console.error('Database query failed for book ID, falling back to mock:', err)
    }
  }

  const book = BOOKS.find((b) => b.isbn === id || b.id === id)
  if (!book) return res.status(404).json({ message: 'Book not found' })
  res.json(book)
})

/**
 * POST /api/books/:isbn/enrich
 * Fetches metadata from Google Books API and updates the book record.
 * Returns the updated book data.
 */
app.post('/api/books/:isbn/enrich', async (req, res) => {
  const { isbn } = req.params

  if (!isDbConnected) {
    return res.status(503).json({ message: 'Database not available' })
  }

  try {
    // 1. Verify book exists
    const bookCheck = await query('SELECT isbn_13 FROM books WHERE isbn_13 = $1', [isbn])
    if (bookCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Book not found' })
    }

    // 2. Call Google Books API (Node 24 has built-in fetch)
    const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
    const apiRes = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) })
    
    if (apiRes.status === 429) {
      return res.status(429).json({ message: 'Google Books API rate limit exceeded. Please try again later.' })
    }
    
    if (!apiRes.ok) {
        return res.status(apiRes.status).json({ message: `Google Books API error: ${apiRes.statusText}` })
    }

    const apiData = await apiRes.json()

    if (!apiData.totalItems || apiData.totalItems === 0) {
      return res.json({ enriched: false, message: 'ISBN not found on Google Books' })
    }

    const vol = apiData.items[0].volumeInfo
    const imageLinks = vol.imageLinks || {}
    let coverUrl = imageLinks.thumbnail || imageLinks.smallThumbnail || null
    if (coverUrl && coverUrl.startsWith('http://')) {
      coverUrl = coverUrl.replace('http://', 'https://')
    }

    // 3. Update the book record (only fill gaps, never overwrite supplier data)
    await query(
      `UPDATE books SET
         description = COALESCE(NULLIF(description, ''), $1),
         cover_image_url = COALESCE(NULLIF(cover_image_url, ''), $2),
         page_count = COALESCE(page_count, $3),
         updated_at = NOW()
       WHERE isbn_13 = $4`,
      [vol.description || null, coverUrl, vol.pageCount || null, isbn]
    )

    return res.json({
      enriched: true,
      data: {
        description: vol.description || null,
        coverImageUrl: coverUrl,
        pageCount: vol.pageCount || null,
        categories: vol.categories || [],
      },
    })
  } catch (err) {
    console.error('Enrichment error:', err)
    return res.status(500).json({ message: 'Enrichment failed', error: err.message })
  }
})

/* ===========================================================================
   System Sync Logs — used by the Status page
   =========================================================================== */

/**
 * GET /api/system/sync-logs
 * Returns the latest sync status for each supplier pipeline.
 * The Status page expects: { supplier, lastSyncTime, status, rowsProcessed, errorsFlagged }
 */
app.get('/api/system/sync-logs', async (_req, res) => {
  if (isDbConnected) {
    try {
      // Get the latest ingestion event for each supplier
      const result = await query(
        `SELECT DISTINCT ON (supplier_name)
           supplier_name,
           completed_at,
           status,
           records_processed,
           errors_count
         FROM ingestion_events
         ORDER BY supplier_name, completed_at DESC`
      )

      // Map supplier_name to the display names the frontend expects
      const supplierDisplayNames = {
        booksite: 'Booksite',
        jonathanBall: 'Jonathan Ball',
        protea: 'Protea',
      }

      const logs = result.rows.map((row) => ({
        supplier: supplierDisplayNames[row.supplier_name] || row.supplier_name,
        lastSyncTime: row.completed_at,
        status: row.status === 'error' ? 'failed' : row.status,
        rowsProcessed: row.records_processed,
        errorsFlagged: row.errors_count,
      }))

      // Add Indie Authors entry (no pipeline — manual submissions only)
      logs.push({
        supplier: 'Indie Authors',
        lastSyncTime: null,
        status: 'manual',
        rowsProcessed: 0,
        errorsFlagged: 0,
      })

      return res.json(logs)
    } catch (err) {
      console.error('Sync logs DB error:', err)
    }
  }

  // Fallback: no data
  res.json([])
})

/* ===========================================================================
   Dashboard Endpoints (PostgreSQL-backed via ingestion_events/ingestion_errors)
   =========================================================================== */

/**
 * Helper: compute a date range filter cutoff based on the `range` query param.
 */
function getRangeCutoff(range) {
  const now = new Date()
  if (range === 'week') return new Date(now - 7 * 24 * 60 * 60 * 1000)
  if (range === 'yesterday') {
    const y = new Date(now)
    y.setDate(y.getDate() - 1)
    y.setHours(0, 0, 0, 0)
    return y
  }
  // 'today' — midnight of the current day
  const t = new Date(now)
  t.setHours(0, 0, 0, 0)
  return t
}

/**
 * GET /api/dashboard/summary?range=today|yesterday|week
 * Returns real KPI counts from ingestion_events.
 */
app.get('/api/dashboard/summary', async (req, res) => {
  const range = (req.query.range || 'today').toLowerCase()

  if (isDbConnected) {
    try {
      const cutoff = getRangeCutoff(range)

      const summaryResult = await query(
        `SELECT
           COUNT(*)::int                                   AS "filesReceived",
           COALESCE(SUM(records_inserted), 0)::int         AS "newIsbnsAdded",
           COALESCE(SUM(records_updated), 0)::int          AS "metadataUpdates",
           MAX(completed_at)                               AS "lastUpdated"
         FROM ingestion_events
         WHERE completed_at >= $1`,
        [cutoff]
      )

      const errResult = await query(
        `SELECT COUNT(*)::int AS count
         FROM ingestion_errors
         WHERE resolved = false AND created_at >= $1`,
        [cutoff]
      )

      const row = summaryResult.rows[0]
      return res.json({
        range,
        filesReceived: row.filesReceived || 0,
        newIsbnsAdded: row.newIsbnsAdded || 0,
        metadataUpdates: row.metadataUpdates || 0,
        totalErrors: errResult.rows[0].count || 0,
        lastUpdated: row.lastUpdated || new Date().toISOString(),
      })
    } catch (err) {
      console.error('Dashboard summary DB error:', err)
    }
  }

  // Fallback: empty summary
  res.json({
    range,
    filesReceived: 0,
    newIsbnsAdded: 0,
    metadataUpdates: 0,
    totalErrors: 0,
    lastUpdated: new Date().toISOString(),
  })
})

/**
 * GET /api/dashboard/activity?range=today|yesterday|week
 * Returns real pipeline run events.
 */
app.get('/api/dashboard/activity', async (req, res) => {
  const range = (req.query.range || 'today').toLowerCase()

  if (isDbConnected) {
    try {
      const cutoff = getRangeCutoff(range)

      const result = await query(
        `SELECT
           id,
           completed_at   AS timestamp,
           supplier_name  AS supplier,
           file_name      AS "fileName",
           status,
           records_processed AS "recordsProcessed",
           message
         FROM ingestion_events
         WHERE completed_at >= $1
         ORDER BY completed_at DESC
         LIMIT 50`,
        [cutoff]
      )

      return res.json(result.rows.map((r) => ({ ...r, id: String(r.id) })))
    } catch (err) {
      console.error('Dashboard activity DB error:', err)
    }
  }

  res.json([])
})

/**
 * GET /api/dashboard/errors?range=today|yesterday|week
 * Returns real ingestion errors from the database.
 */
app.get('/api/dashboard/errors', async (req, res) => {
  if (isDbConnected) {
    try {
      const result = await query(
        `SELECT
           e.id,
           e.created_at   AS timestamp,
           e.supplier_name AS supplier,
           e.file_name     AS "fileName",
           e.message,
           e.resolved
         FROM ingestion_errors e
         ORDER BY e.created_at DESC
         LIMIT 100`
      )
      return res.json(result.rows.map((r) => ({ ...r, id: String(r.id) })))
    } catch (err) {
      console.error('Dashboard errors DB error:', err)
    }
  }
  res.json([])
})

/**
 * POST /api/dashboard/errors/:id/resolve
 */
app.post('/api/dashboard/errors/:id/resolve', async (req, res) => {
  if (isDbConnected) {
    try {
      const result = await query(
        'UPDATE ingestion_errors SET resolved = true WHERE id = $1 RETURNING *',
        [req.params.id]
      )
      if (result.rowCount === 0) return res.status(404).json({ message: 'Error not found' })
      const row = result.rows[0]
      return res.json({
        success: true,
        error: { id: String(row.id), timestamp: row.created_at, supplier: row.supplier_name, fileName: row.file_name, message: row.message, resolved: row.resolved },
      })
    } catch (err) {
      console.error('Error resolving:', err)
      return res.status(500).json({ message: 'Database error' })
    }
  }
  res.status(503).json({ message: 'Database not available' })
})

/**
 * DELETE /api/dashboard/errors/:id
 */
app.delete('/api/dashboard/errors/:id', async (req, res) => {
  if (isDbConnected) {
    try {
      const result = await query('DELETE FROM ingestion_errors WHERE id = $1 RETURNING id', [req.params.id])
      if (result.rowCount === 0) return res.status(404).json({ message: 'Error not found' })
      return res.json({ success: true })
    } catch (err) {
      console.error('Error deleting:', err)
      return res.status(500).json({ message: 'Database error' })
    }
  }
  res.status(503).json({ message: 'Database not available' })
})

/**
 * POST /api/dashboard/errors/clear
 * Clears all resolved errors (or all errors if ?all=true)
 */
app.post('/api/dashboard/errors/clear', async (req, res) => {
  if (isDbConnected) {
    try {
      if (req.query.all === 'true') {
        await query('DELETE FROM ingestion_errors')
      } else {
        await query('DELETE FROM ingestion_errors WHERE resolved = true')
      }
      const remaining = await query('SELECT COUNT(*)::int AS count FROM ingestion_errors')
      return res.json({ success: true, remaining: remaining.rows[0].count })
    } catch (err) {
      console.error('Error clearing:', err)
      return res.status(500).json({ message: 'Database error' })
    }
  }
  res.status(503).json({ message: 'Database not available' })
})

/* ===========================================================================
   Price Override Endpoints (PostgreSQL-backed)
   =========================================================================== */

/**
 * GET /api/price-overrides
 * Returns all active price overrides.
 */
app.get('/api/price-overrides', async (_req, res) => {
  if (isDbConnected) {
    try {
      const result = await query(
        `SELECT id, isbn_13 AS isbn, isbn_13 AS "bookId", title, author,
                original_price AS "originalPrice", override_price AS "overridePrice",
                reason, notes, created_by AS "createdBy",
                created_at AS "createdAt", updated_at AS "updatedAt"
         FROM price_overrides ORDER BY created_at DESC`
      )
      return res.json(result.rows)
    } catch (err) {
      console.error('DB error fetching overrides:', err)
    }
  }
  res.json([])
})

/**
 * POST /api/price-overrides
 * Create or update a price override.
 * Body: { bookId, isbn, title, author, originalPrice?, overridePrice, reason, notes? }
 */
app.post('/api/price-overrides', async (req, res) => {
  const { bookId, isbn, title, author, originalPrice, overridePrice, reason, notes } = req.body

  if (!overridePrice || !reason) {
    return res.status(400).json({ message: 'overridePrice and reason are required' })
  }

  const isbnKey = isbn || bookId

  if (isDbConnected) {
    try {
      const result = await query(
        `INSERT INTO price_overrides (isbn_13, title, author, original_price, override_price, reason, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (isbn_13) DO UPDATE SET
           override_price = EXCLUDED.override_price,
           reason = EXCLUDED.reason,
           notes = EXCLUDED.notes,
           updated_at = NOW()
         RETURNING id, isbn_13 AS isbn, isbn_13 AS "bookId", title, author,
                   original_price AS "originalPrice", override_price AS "overridePrice",
                   reason, notes, created_at AS "createdAt", updated_at AS "updatedAt"`,
        [isbnKey, title || 'Unknown', author || '', originalPrice || null, Number(overridePrice), reason, notes || '']
      )
      return res.status(201).json({ success: true, override: result.rows[0] })
    } catch (err) {
      console.error('DB error creating override:', err)
      return res.status(500).json({ message: 'Database error' })
    }
  }
  res.status(503).json({ message: 'Database not available' })
})

/**
 * DELETE /api/price-overrides/:id
 * Remove a price override.
 */
app.delete('/api/price-overrides/:id', async (req, res) => {
  if (isDbConnected) {
    try {
      const result = await query('DELETE FROM price_overrides WHERE id = $1 RETURNING id', [req.params.id])
      if (result.rowCount === 0) return res.status(404).json({ message: 'Override not found' })
      return res.json({ success: true })
    } catch (err) {
      console.error('DB error deleting override:', err)
      return res.status(500).json({ message: 'Database error' })
    }
  }
  res.status(503).json({ message: 'Database not available' })
})

/* ===========================================================================
   Indie Submissions Review Queue (PostgreSQL-backed)
   =========================================================================== */

// In-memory fallback data (used only when DB is not connected)
const FALLBACK_SUBMISSIONS = [
  {
    id: 'sub-1',
    title: 'The Karoo Dreamweaver',
    authorName: 'Lindiwe Mokoena',
    authorEmail: 'lindiwe.mokoena@gmail.com',
    synopsis: 'A magical realism novel set in the vast Karoo landscape, where a young shepherd discovers she can weave dreams into reality. As drought threatens her community, she must learn to harness her gift before the land — and its stories — are lost forever. Blending Sotho folklore with contemporary South African life.',
    pageCount: 312,
    suggestedPrice: 289.99,
    coverImageUrl: '',
    submissionDate: '2026-05-28T09:14:00Z',
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
  },
  {
    id: 'sub-2',
    title: 'Echoes of Table Mountain',
    authorName: 'James van der Berg',
    authorEmail: 'jvdberg.writes@outlook.com',
    synopsis: 'A literary thriller following a Cape Town journalist who uncovers a decades-old conspiracy buried in the archives of the District Six Museum. Each chapter peels back another layer of truth, weaving between 1968 and the present day.',
    pageCount: 278,
    suggestedPrice: 265.00,
    coverImageUrl: '',
    submissionDate: '2026-05-30T14:22:00Z',
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
  },
  {
    id: 'sub-3',
    title: 'Ubuntu Kitchen: Recipes for Community',
    authorName: 'Fatima Abrahams',
    authorEmail: 'fatima.abrahams@cookza.co.za',
    synopsis: 'A cookbook celebrating the diverse culinary traditions of South Africa. Over 120 recipes from Cape Malay to Zulu to Indian-influenced dishes, each accompanied by stories of the communities and families that created them. Includes stunning food photography.',
    pageCount: 224,
    suggestedPrice: 445.00,
    coverImageUrl: '',
    submissionDate: '2026-06-01T08:45:00Z',
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
  },
  {
    id: 'sub-4',
    title: 'The Algorithm of Us',
    authorName: 'Thabo Nkosi',
    authorEmail: 'thabo.nkosi@techmail.com',
    synopsis: 'A near-future romance set in Johannesburg where two AI researchers fall in love while building an algorithm designed to predict human compatibility. When their own relationship becomes the test case, they must decide: trust the data or trust their hearts?',
    pageCount: 198,
    suggestedPrice: 225.00,
    coverImageUrl: '',
    submissionDate: '2026-06-02T11:30:00Z',
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
  },
  {
    id: 'sub-5',
    title: 'Wildflower Coast',
    authorName: 'Sarah du Plessis',
    authorEmail: 'sarah.duplessis@writersza.org',
    synopsis: 'A coming-of-age novel following three friends through a summer on the West Coast, where fields of wildflowers hide long-buried secrets. As the Namaqualand blooms, so does the truth about the ties that bind them.',
    pageCount: 256,
    suggestedPrice: 249.99,
    coverImageUrl: '',
    submissionDate: '2026-05-15T16:00:00Z',
    status: 'approved',
    reviewedBy: 'Admin User',
    reviewedAt: '2026-05-20T10:30:00Z',
    rejectionReason: null,
  },
  {
    id: 'sub-6',
    title: 'Code of the Savanna',
    authorName: 'Mpho Dlamini',
    authorEmail: 'mpho.d@gmail.com',
    synopsis: 'A children\'s adventure book where a young programmer from Soweto creates a game that accidentally opens a portal to the African savanna. With the help of a wise pangolin and a mischievous honey badger, she must debug her code to find her way home.',
    pageCount: 144,
    suggestedPrice: 189.99,
    coverImageUrl: '',
    submissionDate: '2026-05-10T13:15:00Z',
    status: 'approved',
    reviewedBy: 'Staff Member',
    reviewedAt: '2026-05-18T09:00:00Z',
    rejectionReason: null,
  },
  {
    id: 'sub-7',
    title: 'Midnight in Maboneng',
    authorName: 'Zinhle Khumalo',
    authorEmail: 'zinhle.k@artmail.co.za',
    synopsis: 'A poetry collection exploring urban life, identity, and love in Johannesburg\'s vibrant Maboneng precinct. Each poem is paired with original street art photography from the neighbourhood.',
    pageCount: 96,
    suggestedPrice: 175.00,
    coverImageUrl: '',
    submissionDate: '2026-05-12T10:00:00Z',
    status: 'approved',
    reviewedBy: 'Admin User',
    reviewedAt: '2026-05-22T14:45:00Z',
    rejectionReason: null,
  },
  {
    id: 'sub-8',
    title: 'Get Rich Quick with Crypto',
    authorName: 'Derek Schoeman',
    authorEmail: 'derek.crypto99@mail.com',
    synopsis: 'Learn the secrets the banks don\'t want you to know! This book promises guaranteed returns through a revolutionary crypto trading strategy. Includes access to an exclusive Telegram group.',
    pageCount: 88,
    suggestedPrice: 599.99,
    coverImageUrl: '',
    submissionDate: '2026-05-08T07:30:00Z',
    status: 'rejected',
    reviewedBy: 'Admin User',
    reviewedAt: '2026-05-09T08:00:00Z',
    rejectionReason: 'Content makes unsubstantiated financial claims and promises guaranteed returns, which is misleading. The book appears to be primarily a vehicle for promoting a paid Telegram group rather than providing genuine educational content.',
  },
  {
    id: 'sub-9',
    title: 'Whispers of the Drakensberg',
    authorName: 'Nomusa Cele',
    authorEmail: 'nomusa.cele@kznwriters.co.za',
    synopsis: 'A historical novel set during the Anglo-Zulu War, told from the perspective of a young Zulu healer who must navigate between two worlds as conflict engulfs the Drakensberg mountains.',
    pageCount: 340,
    suggestedPrice: 310.00,
    coverImageUrl: '',
    submissionDate: '2026-06-04T15:20:00Z',
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
  },
  {
    id: 'sub-10',
    title: 'My Manifesto (Unedited)',
    authorName: 'Anonymous Author',
    authorEmail: 'truth.seeker.2026@protonmail.com',
    synopsis: 'A raw, unedited collection of political opinions and conspiracy theories. The author refuses editorial feedback and demands the book be published exactly as submitted.',
    pageCount: 412,
    suggestedPrice: 150.00,
    coverImageUrl: '',
    submissionDate: '2026-05-05T22:10:00Z',
    status: 'rejected',
    reviewedBy: 'Staff Member',
    reviewedAt: '2026-05-07T11:30:00Z',
    rejectionReason: 'Manuscript does not meet editorial standards. Content contains unverified claims and the author has declined all editorial collaboration. We encourage the author to work with an editor and resubmit a revised manuscript.',
  },
]

// Helper to map DB rows to the camelCase shape the frontend expects
function mapSubmissionRow(row) {
  return {
    id: String(row.id),
    title: row.title,
    authorName: row.author_name,
    authorEmail: row.author_email,
    synopsis: row.synopsis,
    pageCount: row.page_count,
    suggestedPrice: row.suggested_price ? Number(row.suggested_price) : null,
    coverImageUrl: row.cover_image_url || '',
    submissionDate: row.submission_date,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
  }
}

/**
 * GET /api/indie-submissions
 * Query params: status, search, sort (oldest|newest)
 */
app.get('/api/indie-submissions', async (req, res) => {
  const status = (req.query.status || '').toLowerCase()
  const search = (req.query.search || '').trim().toLowerCase()
  const sort = (req.query.sort || 'newest').toLowerCase()

  if (isDbConnected) {
    try {
      let sql = 'SELECT * FROM indie_submissions WHERE 1=1'
      const params = []
      let paramIdx = 1

      if (status && status !== 'all') {
        sql += ` AND status = $${paramIdx++}`
        params.push(status)
      }
      if (search) {
        sql += ` AND (title ILIKE $${paramIdx} OR author_name ILIKE $${paramIdx})`
        params.push(`%${search}%`)
        paramIdx++
      }

      sql += sort === 'oldest' ? ' ORDER BY submission_date ASC' : ' ORDER BY submission_date DESC'

      const result = await query(sql, params)
      return res.json(result.rows.map(mapSubmissionRow))
    } catch (err) {
      console.error('DB error fetching submissions:', err)
    }
  }

  // Fallback to in-memory
  let results = [...FALLBACK_SUBMISSIONS]
  if (status && status !== 'all') results = results.filter((s) => s.status === status)
  if (search) results = results.filter((s) => s.title.toLowerCase().includes(search) || s.authorName.toLowerCase().includes(search))
  results.sort((a, b) => sort === 'oldest' ? new Date(a.submissionDate) - new Date(b.submissionDate) : new Date(b.submissionDate) - new Date(a.submissionDate))
  res.json(results)
})

/**
 * GET /api/indie-submissions/count
 * Returns { pending: N }
 */
app.get('/api/indie-submissions/count', async (_req, res) => {
  if (isDbConnected) {
    try {
      const result = await query("SELECT COUNT(*) AS count FROM indie_submissions WHERE status = 'pending'")
      return res.json({ pending: Number(result.rows[0].count) })
    } catch (err) {
      console.error('DB error counting submissions:', err)
    }
  }
  const pending = FALLBACK_SUBMISSIONS.filter((s) => s.status === 'pending').length
  res.json({ pending })
})

/**
 * GET /api/indie-submissions/:id
 */
app.get('/api/indie-submissions/:id', async (req, res) => {
  if (isDbConnected) {
    try {
      const result = await query('SELECT * FROM indie_submissions WHERE id = $1', [req.params.id])
      if (result.rows.length === 0) return res.status(404).json({ message: 'Submission not found' })
      return res.json(mapSubmissionRow(result.rows[0]))
    } catch (err) {
      console.error('DB error fetching submission:', err)
    }
  }
  const sub = FALLBACK_SUBMISSIONS.find((s) => s.id === req.params.id)
  if (!sub) return res.status(404).json({ message: 'Submission not found' })
  res.json(sub)
})

/**
 * POST /api/indie-submissions/:id/approve
 * Body: { reviewedBy }
 */
app.post('/api/indie-submissions/:id/approve', async (req, res) => {
  if (isDbConnected) {
    try {
      const result = await query(
        `UPDATE indie_submissions
         SET status = 'approved', reviewed_by = $2, reviewed_at = NOW(), rejection_reason = NULL
         WHERE id = $1 AND status = 'pending'
         RETURNING *`,
        [req.params.id, req.body.reviewedBy || 'Unknown']
      )
      if (result.rowCount === 0) {
        const exists = await query('SELECT status FROM indie_submissions WHERE id = $1', [req.params.id])
        if (exists.rows.length === 0) return res.status(404).json({ message: 'Submission not found' })
        return res.status(400).json({ message: `Cannot approve a submission with status "${exists.rows[0].status}"` })
      }
      return res.json({ success: true, submission: mapSubmissionRow(result.rows[0]) })
    } catch (err) {
      console.error('DB error approving:', err)
      return res.status(500).json({ message: 'Database error' })
    }
  }
  res.status(503).json({ message: 'Database not available' })
})

/**
 * POST /api/indie-submissions
 * Public endpoint for authors to submit their books for review.
 * Body: { title, authorName, authorEmail, synopsis, pageCount, suggestedPrice, coverImageUrl }
 */
app.post('/api/indie-submissions', async (req, res) => {
  const { title, authorName, authorEmail, synopsis, pageCount, suggestedPrice, coverImageUrl } = req.body

  if (!title || !authorName || !authorEmail) {
    return res.status(400).json({ message: 'Title, Author Name, and Author Email are required' })
  }

  if (isDbConnected) {
    try {
      const result = await query(
        `INSERT INTO indie_submissions 
          (title, author_name, author_email, synopsis, page_count, suggested_price, cover_image_url, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
         RETURNING *`,
        [
          title.trim(),
          authorName.trim(),
          authorEmail.trim(),
          synopsis ? synopsis.trim() : null,
          pageCount ? parseInt(pageCount, 10) : null,
          suggestedPrice ? parseFloat(suggestedPrice) : null,
          coverImageUrl ? coverImageUrl.trim() : null
        ]
      )
      return res.status(201).json({ success: true, submission: mapSubmissionRow(result.rows[0]) })
    } catch (err) {
      console.error('DB error inserting submission:', err)
      return res.status(500).json({ message: 'Database error' })
    }
  }
  
  res.status(503).json({ message: 'Database not available' })
})

/**
 * POST /api/indie-submissions/:id/reject
 * Body: { reviewedBy, rejectionReason }
 */
app.post('/api/indie-submissions/:id/reject', async (req, res) => {
  if (!req.body.rejectionReason || !req.body.rejectionReason.trim()) {
    return res.status(400).json({ message: 'A rejection reason is required' })
  }

  if (isDbConnected) {
    try {
      const result = await query(
        `UPDATE indie_submissions
         SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW(), rejection_reason = $3
         WHERE id = $1 AND status = 'pending'
         RETURNING *`,
        [req.params.id, req.body.reviewedBy || 'Unknown', req.body.rejectionReason.trim()]
      )
      if (result.rowCount === 0) {
        const exists = await query('SELECT status FROM indie_submissions WHERE id = $1', [req.params.id])
        if (exists.rows.length === 0) return res.status(404).json({ message: 'Submission not found' })
        return res.status(400).json({ message: `Cannot reject a submission with status "${exists.rows[0].status}"` })
      }
      return res.json({ success: true, submission: mapSubmissionRow(result.rows[0]) })
    } catch (err) {
      console.error('DB error rejecting:', err)
      return res.status(500).json({ message: 'Database error' })
    }
  }
  res.status(503).json({ message: 'Database not available' })
})
/* ===========================================================================
   System & Telemetry
   =========================================================================== */

app.get('/api/system/sync-logs', async (req, res) => {
  if (!isDbConnected) return res.status(503).json({ message: 'Database not available' })
  try {
    const limit = parseInt(req.query.limit, 10) || 100
    const source = req.query.source
    
    let sql = 'SELECT * FROM ingestion_events'
    const params = []
    
    if (source) {
      sql += ' WHERE source = $1'
      params.push(source)
    }
    
    sql += ` ORDER BY started_at DESC LIMIT $${params.length + 1}`
    params.push(limit)
    
    const result = await query(sql, params)
    res.json(result.rows)
  } catch (err) {
    console.error('Error fetching sync logs:', err)
    res.status(500).json({ message: 'Database error' })
  }
})

app.post('/api/system/sync-shopify', async (req, res) => {
  // Returns immediately and runs python script in background
  try {
    const { exec } = await import('child_process')
    // Correct path for the venv in the current structure
    const pythonExec = '.\\Master Catalogue Schema\\venv\\Scripts\\python.exe'
      
    console.log('[System] Manual Shopify Sync triggered')
    exec(`"${pythonExec}" -m utils.sync_to_shopify --limit 500`, (err, stdout, stderr) => {
      if (err) console.error('[System] Manual Shopify Sync Failed:', stderr)
      else console.log('[System] Manual Shopify Sync Completed')
    })
    
    res.json({ success: true, message: 'Shopify sync started in background' })
  } catch (err) {
    console.error('Error triggering sync:', err)
    res.status(500).json({ message: 'Server error' })
  }
})
/* ===========================================================================
   Shopify Webhooks
   =========================================================================== */

app.post('/api/webhooks/shopify/orders', verifyShopifyWebhook, async (req, res) => {
  // Acknowledge receipt quickly (Shopify requires a 200 OK fast)
  res.status(200).send('OK')
  
  const order = req.bodyData // parsed in the middleware
  if (!order || !order.line_items) return

  console.log(`[Webhook] New Shopify Order received: ${order.name || order.id}`)

  if (!isDbConnected) {
    console.error('[Webhook] DB disconnected. Cannot process order.')
    return
  }

  try {
    for (const item of order.line_items) {
      const isbn = item.sku
      if (!isbn) continue

      // Check local stock
      const result = await query(
        `SELECT b.title, COALESCE(SUM(sp.stock_quantity), 0) AS total_stock,
                MAX(sp.supplier_name) AS supplier_name
         FROM books b
         LEFT JOIN supplier_prices sp ON b.isbn_13 = sp.isbn_13
         WHERE b.isbn_13 = $1
         GROUP BY b.isbn_13`,
        [isbn]
      )

      if (result.rows.length === 0) continue // Book not in our DB
      const bookData = result.rows[0]

      if (Number(bookData.total_stock) === 0) {
        // Book is sold but we have 0 stock locally (Order on Request scenario)
        const customerName = order.customer 
          ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() 
          : 'Unknown Customer'
          
        await query(
          `INSERT INTO pending_orders 
            (shopify_order_id, shopify_order_number, isbn_13, title, supplier_name, customer_name, quantity, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
          [
            order.id.toString(), 
            order.name || order.order_number, 
            isbn, 
            bookData.title || item.title, 
            bookData.supplier_name || 'Unknown',
            customerName || 'Unknown Customer',
            item.quantity || 1
          ]
        )
        console.log(`[Webhook] Created pending order alert for ISBN ${isbn}`)
      }
    }
  } catch (err) {
    console.error('[Webhook] Error processing order:', err)
  }
})

const PORT = Number(process.env.PORT) || 3001

async function startServer() {
  console.log('🔄 Starting BridgeBooks backend...')
  
  // Attempt DB connection
  const dbIsAvailable = await connectDb()
  
  if (dbIsAvailable) {
    try {
      console.log('🌱 Auto-seeding database...')
      // We run the seed script directly here by importing and calling it
      // but since it's a separate file we can just use child_process or do nothing here since package.json has 'npm run seed'.
      // Wait, the user asked for auto-seed on startup. Let's do it by running the script.
      const { exec } = await import('child_process')
      await new Promise((resolve) => {
        exec('node src/seed.js', (err, stdout, stderr) => {
          if (err) console.error('Auto-seed failed:', stderr)
          else console.log(stdout.trim())
          resolve()
        })
      })
    } catch (err) {
      console.error('Auto-seed error:', err)
    }
  }

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`🚀 BridgeBooks backend listening on http://localhost:${PORT}`)
  })
}

startServer()
