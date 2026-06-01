import express from 'express'
import cors from 'cors'
import { BOOKS } from './data/books.js'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
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
app.get('/api/books', (req, res) => {
  const q = normalizeQuery(req.query.q)
  const field = (req.query.field || 'all').toString().toLowerCase()

  if (!q) return res.json([])

  const results = BOOKS.filter((b) => matchesBook(b, q, field))
  res.json(results)
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

const PORT = Number(process.env.PORT) || 3001
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`BridgeBooks backend listening on http://localhost:${PORT}`)
})
