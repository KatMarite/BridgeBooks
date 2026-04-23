import { useState } from 'react'

/**
 * SearchBar — A reusable search input component.
 *
 * Props:
 *   - placeholder: Input placeholder text
 *   - onSearch: Callback fired with the query string on submit
 *   - className: Additional Tailwind classes for the wrapper
 */
function SearchBar({ placeholder = 'Search books...', onSearch, className = '' }) {
  const [query, setQuery] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (onSearch) onSearch(query.trim())
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex items-center gap-2 w-full max-w-xl ${className}`}
    >
      <div className="relative flex-1">
        {/* Search Icon */}
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          id="search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all duration-200 shadow-sm"
        />
      </div>
      <button
        type="submit"
        className="px-5 py-2.5 bg-accent hover:bg-accent-dark text-primary-dark font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
      >
        Search
      </button>
    </form>
  )
}

export default SearchBar
