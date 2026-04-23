import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = (e) => {
    e.preventDefault()
    // TODO: Replace with real authentication via services/api.js
    console.log('Login attempt:', { email })
    navigate('/dashboard')
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all duration-200"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all duration-200"
              />
            </div>

            <Button type="submit" variant="primary" size="lg" className="w-full">
              Sign In
            </Button>
          </form>

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
