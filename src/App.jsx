import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Search from './pages/Search'
import SyncStatus from './pages/SyncStatus'
import './index.css'

/**
 * App — Root component for BridgeBooks.
 *
 * Routing structure:
 *   /            → Redirects to /dashboard
 *   /login       → Public — authentication screen
 *   /dashboard   → Protected — overview & stats
 *   /search      → Protected — book catalogue search
 *   /sync        → Protected — data sync status
 *
 * All protected routes are wrapped in <ProtectedRoute> which checks
 * auth state before rendering. Unauthenticated users are redirected
 * to /login with return-path preservation.
 */
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            {/* Default route → redirect to dashboard */}
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* Public route */}
            <Route path="login" element={<Login />} />

            {/* Protected routes — require authentication */}
            <Route
              path="dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="search"
              element={
                <ProtectedRoute>
                  <Search />
                </ProtectedRoute>
              }
            />
            <Route
              path="sync"
              element={
                <ProtectedRoute>
                  <SyncStatus />
                </ProtectedRoute>
              }
            />

            {/* Catch-all → redirect unknown routes to dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
