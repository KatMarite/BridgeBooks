import { useState } from 'react'
import { useNavigate, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Button from '../components/Button'
import Alert from '../components/Alert'

/**
 * Login — Authentication page for BridgeBooks.
 *
 * Features:
 *   - Email + password form with validation
 *   - Submits credentials via AuthContext.login()
 *   - Shows inline error alerts on failure
 *   - Displays a spinner while the request is in flight
 *   - Redirects to Dashboard (or the originally requested page) on success
 *   - Automatically redirects to Dashboard if already authenticated
 */
function Login() {
  const { login, isAuthenticated, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // If the user is already logged in, redirect away from the login page.
  if (!authLoading && isAuthenticated) {
    const destination = location.state?.from?.pathname || '/dashboard'
    return <Navigate to={destination} replace />
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await login(email, password)
      // Redirect to the page the user originally wanted, or default to /dashboard.
      const destination = location.state?.from?.pathname || '/dashboard'
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12 bg-gradient-to-br from-primary-dark via-primary to-primary-light">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-primary-dark">Welcome Back</h1>
            <p className="text-text-secondary text-sm">
              Sign in to access your BridgeBooks dashboard
            </p>
          </div>

          {/* Error Alert */}
          <Alert
            variant="error"
            message={error}
            onDismiss={() => setError(null)}
          />

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block text-sm font-medium text-text-primary">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={submitting}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all duration-200 disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-password" className="block text-sm font-medium text-text-primary">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={submitting}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all duration-200 disabled:opacity-60"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={submitting}
            >
              {submitting ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          {/* Dev credentials hint */}
          <div className="bg-primary/5 rounded-lg p-3 text-xs text-text-secondary space-y-1">
            <p className="font-semibold text-primary-dark">Dev Credentials</p>
            <p>Email: <code className="bg-white px-1 py-0.5 rounded text-primary font-mono">admin@bridgebooks.co.za</code></p>
            <p>Password: <code className="bg-white px-1 py-0.5 rounded text-primary font-mono">bridge2026</code></p>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-text-muted">
            Don&apos;t have an account?{' '}
            <span className="text-accent-dark font-medium cursor-pointer hover:underline">
              Contact your admin
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
