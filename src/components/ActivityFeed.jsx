/**
 * ActivityFeed — Displays recent supplier file processing events.
 *
 * Props:
 *   - activities: Array of activity objects from the API
 *   - loading:    Boolean — shows skeleton rows when true
 *   - className:  Additional wrapper classes
 *
 * Each activity object shape:
 *   { id, timestamp, supplier, fileName, status, recordsProcessed, message }
 */

const STATUS_CONFIG = {
  success: {
    label: 'Success',
    dot: 'bg-success',
    badge: 'bg-success/10 text-success border-success/20',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  warning: {
    label: 'Warning',
    dot: 'bg-warning',
    badge: 'bg-warning/10 text-warning border-warning/20',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01" />
      </svg>
    ),
  },
  error: {
    label: 'Failed',
    dot: 'bg-error',
    badge: 'bg-error/10 text-error border-error/20',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
}

function formatTimestamp(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`

  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="skeleton w-8 h-8 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton w-40 h-3.5" />
        <div className="skeleton w-56 h-3" />
      </div>
      <div className="skeleton w-16 h-6 rounded-full" />
      <div className="skeleton w-14 h-3" />
    </div>
  )
}

function ActivityFeed({ activities = [], loading = false, className = '' }) {
  return (
    <section className={className} id="activity-feed">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-primary-dark flex items-center gap-2">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Recent Activity
        </h2>
        <span className="text-xs text-text-muted">
          {!loading && `${activities.length} events`}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="px-6 py-10 text-center text-text-muted text-sm">
            No activity found for this period.
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[28rem] overflow-y-auto">
            {activities.map((item) => {
              const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.success
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-surface/60 transition-colors duration-150"
                >
                  {/* Status dot */}
                  <div className={`w-8 h-8 rounded-full ${config.badge} border flex items-center justify-center shrink-0`}>
                    {config.icon}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">
                      {item.supplier}
                    </p>
                    <p className="text-xs text-text-muted truncate mt-0.5">
                      {item.fileName}
                      {item.recordsProcessed > 0 && (
                        <span className="ml-2 text-text-secondary">
                          • {item.recordsProcessed.toLocaleString()} records
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Status badge */}
                  <span className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${config.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                    {config.label}
                  </span>

                  {/* Timestamp */}
                  <span className="text-xs text-text-muted whitespace-nowrap ml-2">
                    {formatTimestamp(item.timestamp)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

export default ActivityFeed
