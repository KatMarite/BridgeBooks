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
      throw new Error('Request timed out')
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
 * Fetch system sync logs for all suppliers.
 */
export async function fetchSystemSyncLogs() {
  return request('/system/sync-logs')
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
