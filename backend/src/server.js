import express from 'express'
import cors from 'cors'
import { BOOKS } from './data/books.js'
import { connectDb, isDbConnected, query } from './db.js'

const app = express()

app.use(cors())
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

/* ===========================================================================
   Dashboard Mock Data & Endpoints
   =========================================================================== */

const SUPPLIERS = [
  'Penguin Random House',
  'HarperCollins',
  'Simon & Schuster',
  'Hachette Book Group',
  'Macmillan Publishers',
  'Scholastic',
  'Oxford University Press',
  'Cambridge University Press',
]

const ERROR_MESSAGES = [
  'Corrupt CSV file — unable to parse beyond row 142',
  'Mismatched column headers — expected 12 columns, found 9',
  'Duplicate ISBN detected: 978-0-13-468599-1 already exists in catalogue',
  'Invalid price format in column "retail_price" — non-numeric value found',
  'File encoding error — expected UTF-8 but detected ISO-8859-1',
  'Missing required field "title" in 23 rows',
  'Publication date format invalid — expected YYYY-MM-DD, got DD/MM/YYYY',
  'File size exceeds 50 MB limit (received 72.4 MB)',
]

const FILE_EXTENSIONS = ['.csv', '.xlsx', '.xml', '.json']

/** Generate a deterministic-ish timestamp string based on offset */
function makeTimestamp(hoursAgo) {
  const d = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
  return d.toISOString()
}

/** Pick a random item from an array */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Generate a supplier filename */
function makeFilename(supplier) {
  const slug = supplier.toLowerCase().replace(/[^a-z0-9]+/g, '_')
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const ext = pick(FILE_EXTENSIONS)
  return `${slug}_catalogue_${date}${ext}`
}

// ---------- In-memory error store (for resolve / delete) ----------

let nextErrorId = 1

function generateErrors(range) {
  const count = range === 'week' ? 6 : range === 'yesterday' ? 3 : 2
  const errors = []
  for (let i = 0; i < count; i++) {
    const supplier = pick(SUPPLIERS)
    errors.push({
      id: String(nextErrorId++),
      timestamp: makeTimestamp(Math.random() * (range === 'week' ? 168 : 24)),
      supplier,
      fileName: makeFilename(supplier),
      message: pick(ERROR_MESSAGES),
      resolved: false,
    })
  }
  return errors
}

// Keep a persistent error list so resolve/delete works within a session
let currentErrors = generateErrors('today')

/**
 * GET /api/dashboard/summary?range=today|yesterday|week
 */
app.get('/api/dashboard/summary', (req, res) => {
  const range = (req.query.range || 'today').toLowerCase()

  const multiplier = range === 'week' ? 7 : range === 'yesterday' ? 1 : 1
  const baseFiles = range === 'yesterday' ? 14 : 18

  const unresolvedErrors = currentErrors.filter((e) => !e.resolved).length

  res.json({
    range,
    filesReceived: baseFiles * multiplier + Math.floor(Math.random() * 5),
    newIsbnsAdded: Math.floor((42 + Math.random() * 20) * multiplier),
    metadataUpdates: Math.floor((187 + Math.random() * 60) * multiplier),
    totalErrors: unresolvedErrors,
    lastUpdated: new Date().toISOString(),
  })
})

/**
 * GET /api/dashboard/activity?range=today|yesterday|week
 */
app.get('/api/dashboard/activity', (req, res) => {
  const range = (req.query.range || 'today').toLowerCase()
  const count = range === 'week' ? 20 : range === 'yesterday' ? 10 : 8

  const statuses = ['success', 'success', 'success', 'success', 'warning', 'error']

  const activities = []
  for (let i = 0; i < count; i++) {
    const supplier = pick(SUPPLIERS)
    const status = pick(statuses)
    const hoursAgo = Math.random() * (range === 'week' ? 168 : 24)

    activities.push({
      id: `act-${Date.now()}-${i}`,
      timestamp: makeTimestamp(hoursAgo),
      supplier,
      fileName: makeFilename(supplier),
      status,
      recordsProcessed: status !== 'error' ? Math.floor(50 + Math.random() * 500) : 0,
      message:
        status === 'success'
          ? 'File processed successfully'
          : status === 'warning'
            ? 'Processed with minor warnings'
            : 'Processing failed — see error log',
    })
  }

  // Sort newest first
  activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

  res.json(activities)
})

/**
 * GET /api/dashboard/errors?range=today|yesterday|week
 */
app.get('/api/dashboard/errors', (_req, res) => {
  // Return current persistent errors
  res.json(currentErrors)
})

/**
 * POST /api/dashboard/errors/:id/resolve
 */
app.post('/api/dashboard/errors/:id/resolve', (req, res) => {
  const err = currentErrors.find((e) => e.id === req.params.id)
  if (!err) return res.status(404).json({ message: 'Error not found' })

  err.resolved = true
  res.json({ success: true, error: err })
})

/**
 * DELETE /api/dashboard/errors/:id
 */
app.delete('/api/dashboard/errors/:id', (req, res) => {
  const idx = currentErrors.findIndex((e) => e.id === req.params.id)
  if (idx === -1) return res.status(404).json({ message: 'Error not found' })

  currentErrors.splice(idx, 1)
  res.json({ success: true })
})

/**
 * POST /api/dashboard/errors/clear
 * Clears all resolved errors (or all errors if ?all=true)
 */
app.post('/api/dashboard/errors/clear', (req, res) => {
  if (req.query.all === 'true') {
    currentErrors = []
  } else {
    currentErrors = currentErrors.filter((e) => !e.resolved)
  }
  res.json({ success: true, remaining: currentErrors.length })
})

/* ===========================================================================
   Price Override Endpoints
   =========================================================================== */

let priceOverrides = []
let nextOverrideId = 1

/**
 * GET /api/price-overrides
 * Returns all active price overrides.
 */
app.get('/api/price-overrides', (_req, res) => {
  res.json(priceOverrides)
})

/**
 * POST /api/price-overrides
 * Create or update a price override.
 * Body: { bookId, isbn, title, author, originalPrice?, overridePrice, reason, notes? }
 */
app.post('/api/price-overrides', (req, res) => {
  const { bookId, isbn, title, author, originalPrice, overridePrice, reason, notes } = req.body

  if (!overridePrice || !reason) {
    return res.status(400).json({ message: 'overridePrice and reason are required' })
  }

  // Check if an override already exists for this book
  const existing = priceOverrides.find(
    (o) => (bookId && o.bookId === bookId) || (isbn && o.isbn === isbn)
  )

  if (existing) {
    // Update existing override
    existing.overridePrice = Number(overridePrice)
    existing.reason = reason
    existing.notes = notes || ''
    existing.updatedAt = new Date().toISOString()
    return res.json({ success: true, override: existing })
  }

  const override = {
    id: `po-${nextOverrideId++}`,
    bookId: bookId || isbn || `manual-${Date.now()}`,
    isbn: isbn || '',
    title: title || 'Unknown Title',
    author: author || '',
    originalPrice: originalPrice != null ? Number(originalPrice) : null,
    overridePrice: Number(overridePrice),
    reason,
    notes: notes || '',
    createdAt: new Date().toISOString(),
    createdBy: 'staff@bridgebooks.co.za',
  }

  priceOverrides.push(override)
  res.status(201).json({ success: true, override })
})

/**
 * DELETE /api/price-overrides/:id
 * Remove a price override.
 */
app.delete('/api/price-overrides/:id', (req, res) => {
  const idx = priceOverrides.findIndex((o) => o.id === req.params.id)
  if (idx === -1) return res.status(404).json({ message: 'Override not found' })

  priceOverrides.splice(idx, 1)
  res.json({ success: true })
})

/* ===========================================================================
   Indie Submissions Review Queue
   =========================================================================== */

let nextSubmissionId = 11

const indieSubmissions = [
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

/**
 * GET /api/indie-submissions
 * Query params: status, search, sort (oldest|newest)
 */
app.get('/api/indie-submissions', (req, res) => {
  let results = [...indieSubmissions]

  // Filter by status
  const status = (req.query.status || '').toLowerCase()
  if (status && status !== 'all') {
    results = results.filter((s) => s.status === status)
  }

  // Search by title or author name
  const search = (req.query.search || '').trim().toLowerCase()
  if (search) {
    results = results.filter(
      (s) =>
        s.title.toLowerCase().includes(search) ||
        s.authorName.toLowerCase().includes(search)
    )
  }

  // Sort by submission date
  const sort = (req.query.sort || 'newest').toLowerCase()
  results.sort((a, b) => {
    const da = new Date(a.submissionDate)
    const db = new Date(b.submissionDate)
    return sort === 'oldest' ? da - db : db - da
  })

  res.json(results)
})

/**
 * GET /api/indie-submissions/count
 * Returns { pending: N }
 */
app.get('/api/indie-submissions/count', (_req, res) => {
  const pending = indieSubmissions.filter((s) => s.status === 'pending').length
  res.json({ pending })
})

/**
 * GET /api/indie-submissions/:id
 */
app.get('/api/indie-submissions/:id', (req, res) => {
  const sub = indieSubmissions.find((s) => s.id === req.params.id)
  if (!sub) return res.status(404).json({ message: 'Submission not found' })
  res.json(sub)
})

/**
 * POST /api/indie-submissions/:id/approve
 * Body: { reviewedBy }
 */
app.post('/api/indie-submissions/:id/approve', (req, res) => {
  const sub = indieSubmissions.find((s) => s.id === req.params.id)
  if (!sub) return res.status(404).json({ message: 'Submission not found' })

  if (sub.status !== 'pending') {
    return res.status(400).json({ message: `Cannot approve a submission with status "${sub.status}"` })
  }

  sub.status = 'approved'
  sub.reviewedBy = req.body.reviewedBy || 'Unknown'
  sub.reviewedAt = new Date().toISOString()
  sub.rejectionReason = null

  res.json({ success: true, submission: sub })
})

/**
 * POST /api/indie-submissions/:id/reject
 * Body: { reviewedBy, rejectionReason }
 */
app.post('/api/indie-submissions/:id/reject', (req, res) => {
  const sub = indieSubmissions.find((s) => s.id === req.params.id)
  if (!sub) return res.status(404).json({ message: 'Submission not found' })

  if (sub.status !== 'pending') {
    return res.status(400).json({ message: `Cannot reject a submission with status "${sub.status}"` })
  }

  if (!req.body.rejectionReason || !req.body.rejectionReason.trim()) {
    return res.status(400).json({ message: 'A rejection reason is required' })
  }

  sub.status = 'rejected'
  sub.reviewedBy = req.body.reviewedBy || 'Unknown'
  sub.reviewedAt = new Date().toISOString()
  sub.rejectionReason = req.body.rejectionReason.trim()

  res.json({ success: true, submission: sub })
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
