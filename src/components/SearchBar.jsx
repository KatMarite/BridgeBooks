import Button from './Button'

/**
 * SearchBar — Reusable, accessible search input with optional filter + clear.
 *
 * Controlled usage:
 *   - value, onChange
 *   - onSubmit: called on form submit (Enter / Search button)
 *   - onClear: optional; shows an X button when value is non-empty
 *   - filterValue/onFilterChange/filterOptions: optional; renders a <select>
 *   - isLoading: shows loading state on the search button
 */
function SearchBar({
  placeholder = 'Search books...',
  className = '',
  value = '',
  onChange,
  onSubmit,
  onClear,
  filterValue,
  onFilterChange,
  filterOptions,
  isLoading = false,
}) {
  const showFilter = Array.isArray(filterOptions) && filterOptions.length > 0
  const showClear = typeof onClear === 'function' && (value || '').length > 0

  const handleSubmit = (e) => {
    e.preventDefault()
    if (onSubmit) onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className={`w-full max-w-3xl ${className}`}>
      <div className="flex items-stretch gap-2">
        {showFilter && (
          <div className="min-w-28">
            <label className="sr-only" htmlFor="search-filter">
              Search filter
            </label>
            <select
              id="search-filter"
              value={filterValue}
              onChange={(e) => onFilterChange && onFilterChange(e.target.value)}
              className="h-full w-full px-3 py-2.5 rounded-xl border border-border bg-white text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all duration-200 shadow-sm"
            >
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>

          <label className="sr-only" htmlFor="search-input">
            Search books
          </label>
          <input
            id="search-input"
            type="text"
            value={value}
            onChange={(e) => onChange && onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-white text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all duration-200 shadow-sm"
            autoComplete="off"
          />

          {showClear && (
            <button
              type="button"
              onClick={onClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-black/5 transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          className="px-5 py-2.5 rounded-xl h-full"
          isLoading={isLoading}
        >
          Search
        </Button>
      </div>
    </form>
  )
}

export default SearchBar
