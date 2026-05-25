import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Layout — Main application shell.
 *
 * Renders a sticky top navigation bar with a hamburger menu for mobile,
 * the page content via <Outlet />, and a footer.
 *
 * Navigation links: Dashboard, Book Search, Sync Status.
 * Shows user info + Logout button when authenticated.
 */

// Navigation items for internal pages
const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/search', label: 'Book Search', icon: '🔍' },
  { to: '/status', label: 'System Status', icon: '⚙️' },
]

function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    setMobileMenuOpen(false)
    navigate('/login')
  }

  // Close mobile menu when a link is clicked
  const closeMobile = () => setMobileMenuOpen(false)

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      {/* ───────── Navigation Bar ───────── */}
      <nav className="bg-primary text-text-inverse shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <NavLink
              to="/dashboard"
              className="flex items-center gap-2 group"
              onClick={closeMobile}
            >
              <span className="text-2xl font-bold tracking-tight group-hover:text-accent-light transition-colors duration-200">
                📚 BridgeBooks
              </span>
            </NavLink>

            {/* ── Desktop Nav Links ── */}
            <div className="hidden md:flex items-center gap-1">
              {isAuthenticated && NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-white/20 text-white shadow-inner'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <span className="mr-1.5">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}

              {/* Auth actions */}
              {isAuthenticated ? (
                <div className="flex items-center gap-3 ml-4 pl-4 border-l border-white/20">
                  <span className="text-xs text-white/60 hidden lg:inline">
                    {user?.name || user?.email}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 text-white hover:bg-white/20 transition-all duration-200 cursor-pointer"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    `ml-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? 'bg-accent text-primary-dark shadow-md'
                        : 'bg-accent/90 text-primary-dark hover:bg-accent hover:shadow-md'
                    }`
                  }
                >
                  Sign In
                </NavLink>
              )}
            </div>

            {/* ── Mobile Hamburger Button ── */}
            <button
              id="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                /* Close (X) icon */
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                /* Hamburger icon */
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* ── Mobile Slide-down Menu ── */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-primary-dark/60 backdrop-blur-sm">
            <div className="px-4 py-3 space-y-1">
              {isAuthenticated && NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={closeMobile}
                  className={({ isActive }) =>
                    `block px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}

              {/* Mobile auth actions */}
              {isAuthenticated ? (
                <div className="pt-2 mt-2 border-t border-white/10 space-y-2">
                  <p className="px-4 text-xs text-white/50">
                    Signed in as {user?.name || user?.email}
                  </p>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-3 rounded-lg text-sm font-semibold text-white bg-white/10 hover:bg-white/20 transition-all duration-200 cursor-pointer"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <NavLink
                  to="/login"
                  onClick={closeMobile}
                  className="block px-4 py-3 rounded-lg text-sm font-semibold bg-accent text-primary-dark text-center mt-2"
                >
                  Sign In
                </NavLink>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ───────── Page Content ───────── */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* ───────── Footer ───────── */}
      <footer className="bg-primary-dark text-text-inverse/60 text-center py-6 text-sm">
        <p>&copy; {new Date().getFullYear()} BridgeBooks. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default Layout
