import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from './Spinner'

/**
 * ProtectedRoute — Wraps page content that requires authentication.
 *
 * Behaviour:
 *   1. While the initial auth check is running, shows a full-page spinner.
 *   2. If the user is NOT authenticated, redirects to /login
 *      (preserving the attempted URL so we can redirect back after login).
 *   3. If authenticated, renders the child content.
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  // Still checking localStorage — don't flash the login page.
  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size="lg" label="Verifying session…" />
      </div>
    )
  }

  // Not authenticated — redirect to login, preserving the target path.
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

export default ProtectedRoute
