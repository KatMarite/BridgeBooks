/**
 * KpiCard — Reusable Key Performance Indicator card for the dashboard.
 *
 * Props:
 *   - title:     Label text (e.g., "Files Received Today")
 *   - value:     The large number/string to display
 *   - icon:      ReactNode — an SVG icon element
 *   - accentColor: Tailwind color class for the icon background (e.g., 'bg-info')
 *   - loading:   Boolean — shows skeleton shimmer when true
 *   - className: Additional wrapper classes
 */

function KpiCard({ title, value, icon, accentColor = 'bg-primary', loading = false, className = '' }) {
  if (loading) {
    return (
      <div
        className={`bg-white rounded-2xl border border-border p-6 shadow-sm ${className}`}
        aria-busy="true"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="skeleton w-10 h-10 rounded-xl" />
          <div className="skeleton w-24 h-3" />
        </div>
        <div className="skeleton w-20 h-9 mt-1" />
      </div>
    )
  }

  return (
    <div
      className={`bg-white rounded-2xl border border-border p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className={`w-10 h-10 rounded-xl ${accentColor} bg-opacity-15 flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-300`}
        >
          {icon}
        </div>
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
          {title}
        </span>
      </div>
      <p className="text-4xl font-extrabold text-primary-dark tracking-tight">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  )
}

export default KpiCard
