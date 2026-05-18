/**
 * DateRangeSelector — Segmented pill toggle for date range filtering.
 *
 * Props:
 *   - value:    Current active range ('today' | 'yesterday' | 'week')
 *   - onChange: Callback fired when a new range is selected
 *   - className: Additional wrapper classes
 */

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
]

function DateRangeSelector({ value = 'today', onChange, className = '' }) {
  return (
    <div
      id="date-range-selector"
      className={`inline-flex items-center bg-white border border-border rounded-xl p-1 shadow-sm ${className}`}
      role="radiogroup"
      aria-label="Date range"
    >
      {RANGES.map((range) => {
        const isActive = value === range.key
        return (
          <button
            key={range.key}
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(range.key)}
            className={`
              px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer
              ${isActive
                ? 'bg-primary text-white shadow-md'
                : 'text-text-secondary hover:text-primary hover:bg-surface'
              }
            `}
          >
            {range.label}
          </button>
        )
      })}
    </div>
  )
}

export default DateRangeSelector
