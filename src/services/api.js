/**
 * api.js — Central API communication layer for BridgeBooks.
 *
 * This module is the single source of truth for all backend HTTP calls.
 * Replace the BASE_URL with your real API endpoint when the backend is ready.
 *
 * Usage example:
 *   import { fetchBooks, loginUser } from '../services/api'
 *   const books = await fetchBooks('gatsby')
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

/**
 * Generic fetch wrapper with error handling.
 */
async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  }

  // Attach auth token if present
  const token = localStorage.getItem('bridgebooks_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(url, config)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || 'Something went wrong')
  }

  return response.json()
}

/* ============ Auth ============ */

export async function loginUser(email, password) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

/* ============ Books ============ */

export async function fetchBooks(query = '') {
  const params = query ? `?q=${encodeURIComponent(query)}` : ''
  return request(`/books${params}`)
}

export async function searchBooks({ q, field, timeoutMs = 15000 } = {}) {
  const query = typeof q === 'string' ? q : ''
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (field) params.set('field', field)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const qs = params.toString()
    return await request(`/books${qs ? `?${qs}` : ''}`, { signal: controller.signal })
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error('Request timed out', { cause: err })
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function fetchBookById(id) {
  return request(`/books/${id}`)
}

/* ============ Dashboard ============ */

/**
 * Fetch dashboard KPI summary.
 * @param {'today'|'yesterday'|'week'} range
 */
export async function fetchDashboardSummary(range = 'today') {
  return request(`/dashboard/summary?range=${encodeURIComponent(range)}`)
}

/**
 * Fetch recent supplier activity / sync events.
 * @param {'today'|'yesterday'|'week'} range
 */
export async function fetchDashboardActivity(range = 'today') {
  return request(`/dashboard/activity?range=${encodeURIComponent(range)}`)
}

/**
 * Fetch ingestion error logs.
 * @param {'today'|'yesterday'|'week'} range
 */
export async function fetchDashboardErrors(range = 'today') {
  return request(`/dashboard/errors?range=${encodeURIComponent(range)}`)
}

/**
 * Mark a specific error as resolved.
 * @param {string} errorId
 */
export async function resolveError(errorId) {
  return request(`/dashboard/errors/${errorId}/resolve`, { method: 'POST' })
}

/**
 * Delete a specific error log entry.
 * @param {string} errorId
 */
export async function deleteError(errorId) {
  return request(`/dashboard/errors/${errorId}`, { method: 'DELETE' })
}

/**
 * Clear all resolved errors (or all errors if clearAll is true).
 * @param {boolean} clearAll
 */
export async function clearErrors(clearAll = false) {
  return request(`/dashboard/errors/clear${clearAll ? '?all=true' : ''}`, { method: 'POST' })
}

/**
 * Fetch telemetry sync logs with filters.
 */
export async function getSyncLogs({ limit, source } = {}) {
  const params = new URLSearchParams()
  if (limit) params.set('limit', limit)
  if (source) params.set('source', source)
  const qs = params.toString()
  return request(`/system/sync-logs${qs ? `?${qs}` : ''}`)
}

/**
 * Trigger manual Shopify sync in the background.
 */
export async function triggerShopifySync() {
  return request('/system/sync-shopify', { method: 'POST' })
}

/* ============ Book Enrichment ============ */

/**
 * Trigger Google Books API enrichment for a single book.
 * @param {string} isbn - ISBN-13 to enrich.
 * @returns {{ enriched: boolean, data?: object, message?: string }}
 */
export async function enrichBook(isbn) {
  return request(`/books/${isbn}/enrich`, { method: 'POST' })
}

/* ============ Price Overrides ============ */

/**
 * Fetch all active price overrides.
 */
export async function fetchPriceOverrides() {
  return request('/price-overrides')
}

/**
 * Create or update a price override.
 * @param {{ bookId, isbn, title, author, originalPrice?, overridePrice, reason, notes? }} data
 */
export async function createPriceOverride(data) {
  return request('/price-overrides', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Delete a price override by ID.
 * @param {string} id
 */
export async function deletePriceOverride(id) {
  return request(`/price-overrides/${id}`, { method: 'DELETE' })
}

/* ============ Indie Submissions ============ */

/**
 * Submit a new indie book.
 * @param {{ title, authorName, authorEmail, synopsis, pageCount, suggestedPrice, coverImageUrl }} data
 */
export async function createIndieSubmission(data) {
  return request('/indie-submissions', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Fetch indie submissions with optional filters.
 * @param {{ status?: string, search?: string, sort?: 'newest'|'oldest' }} params
 */
export async function fetchIndieSubmissions({ status, search, sort } = {}) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (search) params.set('search', search)
  if (sort) params.set('sort', sort)
  const qs = params.toString()
  return request(`/indie-submissions${qs ? `?${qs}` : ''}`)
}

/**
 * Fetch the count of pending indie submissions (for nav badge).
 */
export async function fetchIndiePendingCount() {
  return request('/indie-submissions/count')
}

/**
 * Fetch a single indie submission by ID.
 * @param {string} id
 */
export async function fetchIndieSubmissionById(id) {
  return request(`/indie-submissions/${id}`)
}

/**
 * Approve an indie submission.
 * @param {string} id
 * @param {{ reviewedBy: string }} data
 */
export async function approveIndieSubmission(id, data) {
  return request(`/indie-submissions/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Reject an indie submission.
 * @param {string} id
 * @param {{ reviewedBy: string, rejectionReason: string }} data
 */
export async function rejectIndieSubmission(id, data) {
  return request(`/indie-submissions/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/* ============ ONIX Export ============ */

/**
 * Trigger ONIX 3.0 export download.
 * Returns a Blob.
 */
export async function exportOnixCatalogue() {
  const token = localStorage.getItem('token')
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch(`${BASE_URL}/export/onix`, { headers })
  if (!response.ok) {
    let msg = 'Export failed'
    try {
      const errData = await response.json()
      msg = errData.message || msg
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return response.blob()
}
