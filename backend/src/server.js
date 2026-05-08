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

const PORT = Number(process.env.PORT) || 3001
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`BridgeBooks backend listening on http://localhost:${PORT}`)
})

