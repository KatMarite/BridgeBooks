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

export async function fetchDashboardStats() {
  return request('/dashboard/stats')
}

export async function fetchRecentActivity() {
  return request('/dashboard/activity')
}
