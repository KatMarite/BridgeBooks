import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Button from '../components/Button'

const stats = [
  { label: 'Total Books', value: '1,247', icon: '📚' },
  { label: 'Active Loans', value: '89', icon: '🔄' },
  { label: 'Members', value: '324', icon: '👥' },
  { label: 'Overdue', value: '12', icon: '⚠️' },
]

const recentActivity = [
  { title: 'The Great Gatsby', action: 'Checked out', user: 'Alice M.', time: '2 hours ago' },
  { title: 'To Kill a Mockingbird', action: 'Returned', user: 'Bob K.', time: '3 hours ago' },
  { title: '1984', action: 'Reserved', user: 'Carol J.', time: '5 hours ago' },
  { title: 'Pride and Prejudice', action: 'Checked out', user: 'David L.', time: '1 day ago' },
]

function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary-dark">Dashboard</h1>
          <p className="text-text-secondary mt-1">
            Welcome back{user?.name ? `, ${user.name}` : ''}! Here&apos;s what&apos;s happening in your library.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/search')}>
          🔍 Find a Book
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl border border-border p-6 shadow-sm hover:shadow-md transition-shadow duration-200 group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-3xl group-hover:scale-110 transition-transform duration-200">
                {stat.icon}
              </span>
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                {stat.label}
              </span>
            </div>
            <p className="text-4xl font-extrabold text-primary-dark">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <section>
        <h2 className="text-xl font-semibold text-primary-dark mb-4">Recent Activity</h2>
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="divide-y divide-border">
            {recentActivity.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-6 py-4 hover:bg-surface transition-colors duration-150"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {item.action} by {item.user}
                  </p>
                </div>
                <span className="text-xs text-text-muted whitespace-nowrap ml-4">
                  {item.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default Dashboard
