import { useState, useEffect, useMemo, useCallback } from 'react'
import Alert from '../components/Alert'
import Button from '../components/Button'
import Spinner from '../components/Spinner'
import SearchBar from '../components/SearchBar'
import { searchBooks, fetchPriceOverrides, createPriceOverride, deletePriceOverride } from '../services/api'

/**
 * PriceOverrides — Staff-facing interface for managing book price overrides.
 *
 * Three sections:
 *   1. Book Search — Find and select a book to override
 *   2. Override Form — Set price, reason, and notes
 *   3. Active Overrides — Table of all current overrides with remove action
 */

const REASON_OPTIONS = [
  { value: '', label: 'Select a reason…' },
  { value: 'damaged_stock', label: 'Damaged Stock' },
  { value: 'clearance_sale', label: 'Clearance Sale' },
  { value: 'staff_discount', label: 'Staff Discount' },
  { value: 'price_match', label: 'Price Match' },
  { value: 'promotional', label: 'Promotional' },
  { value: 'other', label: 'Other' },
]

const REASON_LABELS = Object.fromEntries(REASON_OPTIONS.filter(o => o.value).map(o => [o.value, o.label]))

function formatPrice(value) {
  const num = Number(value)
  if (isNaN(num)) return '—'
  return `R ${num.toFixed(2)}`
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function normalizeBook(raw) {
  return {
    id: raw?.id || raw?._id || raw?.isbn || raw?.ISBN,
    title: raw?.title || raw?.name || '',
    author: raw?.author || raw?.authors || '',
    isbn: raw?.isbn || raw?.ISBN || raw?.isbn13 || '',
    coverImageUrl: raw?.coverImageUrl || raw?.cover_url || raw?.coverUrl || '',
  }
}

function PriceOverrides() {
  // ─── Search state ───
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  // ─── Selection & form state ───
  const [selectedBook, setSelectedBook] = useState(null)
  const [overridePrice, setOverridePrice] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formMessage, setFormMessage] = useState(null) // { type: 'success'|'error', text }

  // ─── Overrides list state ───
  const [overrides, setOverrides] = useState([])
  const [isLoadingOverrides, setIsLoadingOverrides] = useState(true)
  const [overridesError, setOverridesError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  // ─── Debounce search query ───
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 500)
    return () => clearTimeout(timer)
  }, [query])

  // ─── Auto-search on debounced query ───
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchResults([])
      return
    }
    const doSearch = async () => {
      setIsSearching(true)
      setSearchError('')
      try {
        const data = await searchBooks({ q: debouncedQuery.trim() })
        const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : []
        setSearchResults(list.map(normalizeBook))
      } catch {
        setSearchError('Search failed. Please try again.')
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }
    doSearch()
  }, [debouncedQuery])

  // ─── Load overrides on mount ───
  const loadOverrides = useCallback(async () => {
    setIsLoadingOverrides(true)
    setOverridesError('')
    try {
      const data = await fetchPriceOverrides()
      setOverrides(Array.isArray(data) ? data : [])
    } catch {
      setOverridesError('Failed to load overrides.')
    } finally {
      setIsLoadingOverrides(false)
    }
  }, [])

  useEffect(() => {
    loadOverrides()
  }, [loadOverrides])

  // ─── Select a book from search results ───
  const handleSelect = (book) => {
    setSelectedBook(book)
    setOverridePrice('')
    setReason('')
    setNotes('')
    setFormMessage(null)
    // Clear search
    setQuery('')
    setDebouncedQuery('')
    setSearchResults([])
  }

  // ─── Cancel selection ───
  const handleCancel = () => {
    setSelectedBook(null)
    setOverridePrice('')
    setReason('')
    setNotes('')
    setFormMessage(null)
  }

  // ─── Submit override ───
  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormMessage(null)

    const price = parseFloat(overridePrice)
    if (!price || price <= 0) {
      setFormMessage({ type: 'error', text: 'Please enter a valid price greater than 0.' })
      return
    }
    if (!reason) {
      setFormMessage({ type: 'error', text: 'Please select a reason for the override.' })
      return
    }

    setIsSubmitting(true)
    try {
      await createPriceOverride({
        bookId: selectedBook.id,
        isbn: selectedBook.isbn,
        title: selectedBook.title,
        author: selectedBook.author,
        overridePrice: price,
        reason,
        notes,
      })
      setFormMessage({ type: 'success', text: `Price override applied for "${selectedBook.title}".` })
      setSelectedBook(null)
      setOverridePrice('')
      setReason('')
      setNotes('')
      await loadOverrides()
    } catch (err) {
      setFormMessage({ type: 'error', text: err?.message || 'Failed to apply override.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Delete override ───
  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      await deletePriceOverride(id)
      setOverrides((prev) => prev.filter((o) => o.id !== id))
    } catch {
      setOverridesError('Failed to remove override.')
    } finally {
      setDeletingId(null)
    }
  }

  // ─── Check if a book already has an override ───
  const overriddenIsbns = useMemo(
    () => new Set(overrides.map((o) => o.isbn).filter(Boolean)),
    [overrides]
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* ─── Page Header ─── */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-primary-dark">Price Overrides</h1>
        <p className="text-text-secondary max-w-xl mx-auto">
          Search for a book, set an override price, and manage active price overrides.
        </p>
      </div>

      {/* ─── Form-level messages ─── */}
      {formMessage && (
        <div className="max-w-3xl mx-auto">
          <Alert
            variant={formMessage.type === 'success' ? 'success' : 'error'}
            message={formMessage.text}
            onDismiss={() => setFormMessage(null)}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          Section 1 — Book Search (hidden when a book is selected)
          ═══════════════════════════════════════════════ */}
      {!selectedBook && (
        <section className="space-y-4">
          <div className="flex justify-center">
            <SearchBar
              value={query}
              onChange={setQuery}
              placeholder="Search by ISBN, title, or author…"
              onSubmit={() => { setDebouncedQuery(query) }}
              onClear={() => { setQuery(''); setDebouncedQuery(''); setSearchResults([]) }}
              isLoading={isSearching}
            />
          </div>

          {/* Search feedback */}
          <div className="flex justify-center">
            <div className="w-full max-w-3xl">
              {!!searchError && (
                <Alert variant="error" message={searchError} onDismiss={() => setSearchError('')} />
              )}
            </div>
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="max-w-3xl mx-auto">
              <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
                <div className="px-5 py-3 bg-surface border-b border-border">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found — select a book
                  </p>
                </div>
                <ul className="divide-y divide-border">
                  {searchResults.map((book, idx) => {
                    const hasOverride = overriddenIsbns.has(book.isbn)
                    return (
                      <li
                        key={book.id || book.isbn || idx}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-surface/50 transition-colors duration-150"
                      >
                        {/* Cover thumbnail */}
                        <div className="w-10 h-14 rounded-lg bg-surface border border-border overflow-hidden shrink-0">
                          {book.coverImageUrl ? (
                            <img
                              src={book.coverImageUrl}
                              alt={`Cover of ${book.title}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-text-muted text-lg">
                              📘
                            </div>
                          )}
                        </div>

                        {/* Book info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-primary-dark truncate">{book.title}</p>
                          <p className="text-xs text-text-secondary truncate">{book.author || '—'}</p>
                          <p className="text-xs text-text-muted font-mono mt-0.5">{book.isbn}</p>
                        </div>

                        {/* Select / Already overridden */}
                        {hasOverride ? (
                          <span className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent/15 text-accent-dark whitespace-nowrap">
                            Override Active
                          </span>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleSelect(book)}
                          >
                            Select
                          </Button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isSearching && !searchError && searchResults.length === 0 && !debouncedQuery && (
            <div className="text-center py-14 border border-border bg-white rounded-2xl max-w-3xl mx-auto">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-accent/10 text-accent flex items-center justify-center text-3xl">
                💰
              </div>
              <p className="mt-4 text-lg font-semibold text-primary-dark">
                Search for a book to apply a price override
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Enter an ISBN, title, or author name above.
              </p>
            </div>
          )}

          {/* No results */}
          {!isSearching && !searchError && searchResults.length === 0 && debouncedQuery && (
            <div className="text-center py-12 max-w-3xl mx-auto">
              <p className="text-lg text-text-muted">
                No books found matching &lsquo;{debouncedQuery}&rsquo;.
              </p>
            </div>
          )}
        </section>
      )}

      {/* ═══════════════════════════════════════════════
          Section 2 — Override Form (visible when book is selected)
          ═══════════════════════════════════════════════ */}
      {selectedBook && (
        <section className="override-form-enter max-w-2xl mx-auto">
          <div className="rounded-2xl border border-border bg-white shadow-md overflow-hidden">
            {/* Selected book header */}
            <div className="px-6 py-5 bg-gradient-to-r from-primary/5 to-accent/5 border-b border-border">
              <div className="flex items-center gap-4">
                <div className="w-14 h-20 rounded-xl bg-surface border border-border overflow-hidden shrink-0 shadow-sm">
                  {selectedBook.coverImageUrl ? (
                    <img
                      src={selectedBook.coverImageUrl}
                      alt={`Cover of ${selectedBook.title}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-muted text-2xl">
                      📘
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-primary-dark truncate">{selectedBook.title}</p>
                  <p className="text-sm text-text-secondary">{selectedBook.author || '—'}</p>
                  <p className="text-xs text-text-muted font-mono mt-1">{selectedBook.isbn}</p>
                </div>
              </div>
            </div>

            {/* Form fields */}
            <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
              {/* Override Price */}
              <div>
                <label htmlFor="override-price" className="block text-sm font-semibold text-primary-dark mb-1.5">
                  Override Price (ZAR) <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-semibold text-sm">R</span>
                  <input
                    id="override-price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={overridePrice}
                    onChange={(e) => setOverridePrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-border bg-white text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all duration-200 shadow-sm"
                    required
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label htmlFor="override-reason" className="block text-sm font-semibold text-primary-dark mb-1.5">
                  Reason <span className="text-error">*</span>
                </label>
                <select
                  id="override-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all duration-200 shadow-sm"
                  required
                >
                  {REASON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} disabled={!opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="override-notes" className="block text-sm font-semibold text-primary-dark mb-1.5">
                  Notes <span className="text-text-muted font-normal">(optional)</span>
                </label>
                <textarea
                  id="override-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Additional context for this override…"
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all duration-200 shadow-sm resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="flex-1"
                  isLoading={isSubmitting}
                >
                  Apply Override
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════
          Section 3 — Active Overrides
          ═══════════════════════════════════════════════ */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-primary-dark">Active Overrides</h2>
          {overrides.length > 0 && (
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent/15 text-accent-dark">
              {overrides.length}
            </span>
          )}
        </div>

        {isLoadingOverrides && <Spinner size="sm" label="Loading overrides…" className="py-4" />}

        {!!overridesError && (
          <Alert variant="error" message={overridesError} onDismiss={() => setOverridesError('')} />
        )}

        {!isLoadingOverrides && !overridesError && overrides.length === 0 && (
          <div className="text-center py-10 border border-border bg-white rounded-2xl">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl">
              ✅
            </div>
            <p className="mt-3 text-base font-semibold text-primary-dark">No active overrides</p>
            <p className="mt-1 text-sm text-text-secondary">
              Search for a book above to create a price override.
            </p>
          </div>
        )}

        {/* ── Desktop table ── */}
        {!isLoadingOverrides && overrides.length > 0 && (
          <div className="hidden md:block">
            <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-surface">
                  <tr className="text-xs font-semibold text-text-muted">
                    <th className="px-5 py-3">Book</th>
                    <th className="px-5 py-3">ISBN</th>
                    <th className="px-5 py-3">Override Price</th>
                    <th className="px-5 py-3">Reason</th>
                    <th className="px-5 py-3">Applied</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {overrides.map((ov, idx) => (
                    <tr
                      key={ov.id}
                      className={`${idx > 0 ? 'border-t border-border' : ''} hover:bg-surface/40 transition-colors duration-150`}
                    >
                      <td className="px-5 py-4 align-top">
                        <p className="text-sm font-bold text-primary-dark truncate max-w-48">{ov.title}</p>
                        <p className="text-xs text-text-secondary truncate">{ov.author || '—'}</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="text-sm font-mono text-text-primary">{ov.isbn || '—'}</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-sm font-bold text-accent-dark">{formatPrice(ov.overridePrice)}</span>
                          <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse-dot" title="Active override"></span>
                        </span>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <span className="inline-block px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary/8 text-primary">
                          {REASON_LABELS[ov.reason] || ov.reason}
                        </span>
                        {ov.notes && (
                          <p className="text-xs text-text-muted mt-1 truncate max-w-40" title={ov.notes}>{ov.notes}</p>
                        )}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="text-xs text-text-secondary">{formatDate(ov.createdAt)}</p>
                      </td>
                      <td className="px-5 py-4 align-top text-right">
                        <button
                          onClick={() => handleDelete(ov.id)}
                          disabled={deletingId === ov.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-error/30 text-error bg-error/5 hover:bg-error/15 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingId === ov.id ? (
                            <Spinner size="sm" />
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Mobile cards ── */}
        {!isLoadingOverrides && overrides.length > 0 && (
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {overrides.map((ov) => (
              <div key={ov.id} className="rounded-2xl border border-border bg-white shadow-sm p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-primary-dark truncate">{ov.title}</p>
                    <p className="text-xs text-text-secondary">{ov.author || '—'}</p>
                    <p className="text-xs text-text-muted font-mono mt-0.5">{ov.isbn}</p>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/15">
                    <span className="text-sm font-bold text-accent-dark">{formatPrice(ov.overridePrice)}</span>
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse-dot"></span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-primary/8 text-primary">
                      {REASON_LABELS[ov.reason] || ov.reason}
                    </span>
                    <span className="text-xs text-text-muted">{formatDate(ov.createdAt)}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(ov.id)}
                    disabled={deletingId === ov.id}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-error/30 text-error bg-error/5 hover:bg-error/15 transition-all duration-200 cursor-pointer disabled:opacity-50"
                  >
                    {deletingId === ov.id ? '…' : 'Remove'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default PriceOverrides
