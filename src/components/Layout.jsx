import { Outlet, NavLink } from 'react-router-dom'

function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      {/* Navigation Bar */}
      <nav className="bg-primary text-text-inverse shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <NavLink to="/dashboard" className="flex items-center gap-2 group">
              <span className="text-2xl font-bold tracking-tight group-hover:text-accent-light transition-colors duration-200">
                📚 BridgeBooks
              </span>
            </NavLink>

            {/* Nav Links */}
            <div className="flex items-center gap-1">
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-white/20 text-white shadow-inner'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/search"
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-white/20 text-white shadow-inner'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                Search
              </NavLink>
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
                Login
              </NavLink>
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-primary-dark text-text-inverse/60 text-center py-6 text-sm">
        <p>&copy; {new Date().getFullYear()} BridgeBooks. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default Layout
