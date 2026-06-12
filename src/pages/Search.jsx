import { useMemo, useState, useEffect } from 'react'
import Alert from '../components/Alert'
import BookCard from '../components/BookCard'
import BookResultsTable from '../components/BookResultsTable'
import SearchBar from '../components/SearchBar'
import Spinner from '../components/Spinner'
import { searchBooks, exportOnixCatalogue } from '../services/api'

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'isbn', label: 'ISBN' },
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
]

function sanitizeQuery(raw, filter) {
  const trimmed = (raw || '').trim()
  if (filter === 'isbn') return trimmed.replaceAll('-', '').replaceAll(' ', '')
  return trimmed
}

function normalizeSuppliers(raw) {
  if (!raw) return {}

  // Preferred shape: object keyed by supplier id/name
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw
  }

  // Alternate shape: array of { name, price, inStock, qty }
  if (Array.isArray(raw)) {
    const out = {}
    for (const s of raw) {
      const name = (s?.name || s?.supplier || '').toString().toLowerCase()
      if (name.includes('booksite')) out.booksite = s
      else if (name.includes('jonathan')) out.jonathanBall = s
      else if (name.includes('protea')) out.protea = s
    }
    return out
  }

  return {}
}

function normalizeBook(raw) {
  const coverImageUrl =
    raw?.coverImageUrl ||
    raw?.cover_url ||
    raw?.coverUrl ||
    raw?.imageUrl ||
    raw?.thumbnailUrl ||
    ''

  const publicationDate =
    raw?.publicationDate ||
    raw?.publishedDate ||
    raw?.publication_date ||
    raw?.year ||
    ''

  return {
    id: raw?.id || raw?._id || raw?.isbn || raw?.ISBN,
    title: raw?.title || raw?.name || raw?.bookTitle || '',
    author: raw?.author || raw?.authors || raw?.bookAuthor || '',
    isbn: raw?.isbn || raw?.ISBN || raw?.isbn13 || raw?.isbn10 || '',
    publicationDate: publicationDate ? String(publicationDate) : '',
    coverImageUrl,
    suppliers: normalizeSuppliers(raw?.suppliers || raw?.supplierPricing || raw?.supplierData),
  }
}

function friendlyErrorMessage(err) {
  // Fetch/network failures typically throw TypeError("Failed to fetch") in browsers.
  const isNetworkError =
    (err && err.name === 'TypeError') ||
    ((err && typeof err.message === 'string') &&
      err.message.toLowerCase().includes('failed to fetch'))

  const msg = (err && typeof err.message === 'string' ? err.message : '').toLowerCase()
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return 'Search is taking too long. Please try again.'
  }
  if (isNetworkError) {
    return 'Unable to reach the server. Please check your connection and try again.'
  }
  return 'Something went wrong while searching. Please try again.'
}

function Search() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [results, setResults] = useState([])
  const [hasSearched, setHasSearched] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const [debouncedQuery, setDebouncedQuery] = useState(query)

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedQuery(query)
    }, 500)
    return () => clearTimeout(timerId)
  }, [query])

  const placeholder = useMemo(() => {
    if (filter === 'isbn') return 'Search by ISBN…'
    if (filter === 'title') return 'Search by title…'
    if (filter === 'author') return 'Search by author…'
    return 'Search by ISBN, title, or author…'
  }, [filter])

  const normalizedResults = useMemo(() => results.map(normalizeBook), [results])

  const performSearch = async (qString, filterType) => {
    setErrorMessage('')
    const q = sanitizeQuery(qString, filterType)

    if (!q) {
      setResults([])
      setHasSearched(false)
      return
    }

    setHasSearched(true)
    setIsLoading(true)
    try {
      const data = await searchBooks({ q, field: filterType === 'all' ? undefined : filterType })
      const list = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
      setResults(list)
    } catch (err) {
      setResults([])
      setErrorMessage(friendlyErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-search on debounced query or filter change
  useEffect(() => {
    // Avoid fetching on initial mount if query is empty
    if (!debouncedQuery && !hasSearched) return
    performSearch(debouncedQuery, filter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, filter])

  const handleClear = () => {
    setQuery('')
    setDebouncedQuery('')
    setFilter('all')
    setResults([])
    setHasSearched(false)
    setErrorMessage('')
  }

  const handleSubmit = () => {
    // Force immediate search bypass debounce
    setDebouncedQuery(query)
    performSearch(query, filter)
  }

  const handleExportOnix = async () => {
    setIsExporting(true)
    try {
      const blob = await exportOnixCatalogue()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = 'bridgebooks_onix_export.xml'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setErrorMessage(err.message || 'Failed to export ONIX')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="relative">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-primary-dark">Book Search</h1>
          <p className="text-text-secondary max-w-xl mx-auto">
            Enter an ISBN, title, or author to find books and supplier availability.
          </p>
        </div>
        <div className="absolute top-0 right-0 hidden sm:block">
          <button
            onClick={handleExportOnix}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            {isExporting ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            )}
            {isExporting ? 'Exporting...' : 'Export ONIX'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-center">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder={placeholder}
            onSubmit={handleSubmit}
            onClear={handleClear}
            filterValue={filter}
            onFilterChange={setFilter}
            filterOptions={FILTER_OPTIONS}
            isLoading={isLoading}
          />
        </div>

        <div className="flex justify-center">
          <div className="w-full max-w-3xl">
            {isLoading && <Spinner size="sm" label="Searching…" className="py-2" />}
            {!!errorMessage && (
              <Alert
                variant="error"
                message={errorMessage}
                onDismiss={() => setErrorMessage('')}
              />
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {!hasSearched && results.length === 0 && !isLoading && !errorMessage && (
          <div className="text-center py-14 border border-border bg-white rounded-2xl">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl">
              🔎
            </div>
            <p className="mt-4 text-lg font-semibold text-primary-dark">
              Enter an ISBN, title, or author to begin searching
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              Tip: ISBN searches work best without spaces or hyphens.
            </p>
          </div>
        )}

        {hasSearched && !isLoading && !errorMessage && results.length === 0 && (
          <div className="text-center py-12">
            <p className="text-xl text-text-muted">
              No books found matching ‘{sanitizeQuery(query, filter)}’. Check the details and try again.
            </p>
          </div>
        )}

        {!isLoading && !errorMessage && results.length > 0 && (
          <>
            <BookResultsTable books={normalizedResults} />
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {normalizedResults.map((b, idx) => (
                <BookCard key={b.id || b.isbn || idx} book={b} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Search
