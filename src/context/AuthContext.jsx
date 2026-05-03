import { createContext, useContext, useState, useEffect, useCallback } from 'react'

/**
 * AuthContext — Global authentication state for BridgeBooks.
 *
 * Provides:
 *   - user:        The currently authenticated user object (or null).
 *   - token:       The stored JWT string (or null).
 *   - isAuthenticated: Boolean — true when a valid token exists.
 *   - isLoading:   Boolean — true while the initial token check is running.
 *   - login(email, password):  Authenticates and stores the token.
 *   - logout():    Clears the token and resets state.
 *   - authError:   The most recent authentication error message (or null).
 */

const AUTH_TOKEN_KEY = 'bridgebooks_token'
const AUTH_USER_KEY = 'bridgebooks_user'

const AuthContext = createContext(null)

/**
 * Custom hook to consume the auth context.
 * Throws if used outside of <AuthProvider>.
 */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>')
  }
  return ctx
}

/**
 * AuthProvider — Wraps the app and exposes auth state + helpers.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [isLoading, setIsLoading] = useState(true) // true until we check localStorage
  const [authError, setAuthError] = useState(null)

  // ---------- Bootstrap: rehydrate from localStorage on mount ----------
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(AUTH_TOKEN_KEY)
      const storedUser = localStorage.getItem(AUTH_USER_KEY)

      if (storedToken && storedUser) {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
      }
    } catch {
      // Corrupted storage — clear it out silently.
      localStorage.removeItem(AUTH_TOKEN_KEY)
      localStorage.removeItem(AUTH_USER_KEY)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ---------- Login ----------
  const login = useCallback(async (email, password) => {
    setAuthError(null)
    setIsLoading(true)

    try {
      // Try the real backend first; fall back to mock if the server is unreachable.
      let data
      try {
        const { loginUser } = await import('../services/api')
        data = await loginUser(email, password)
      } catch {
        // Backend unavailable — use mock login for development.
        const { mockLogin } = await import('../services/auth.mock')
        data = await mockLogin(email, password)
      }

      // Persist token + user
      localStorage.setItem(AUTH_TOKEN_KEY, data.token)
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user))
      setToken(data.token)
      setUser(data.user)

      return data
    } catch (err) {
      const message = err.message || 'Login failed. Please try again.'
      setAuthError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ---------- Logout ----------
  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
    setToken(null)
    setUser(null)
    setAuthError(null)
  }, [])

  // ---------- Context value ----------
  const value = {
    user,
    token,
    isAuthenticated: !!token,
    isLoading,
    authError,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
