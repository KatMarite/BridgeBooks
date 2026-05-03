/**
 * Spinner — Reusable loading indicator for BridgeBooks.
 *
 * Props:
 *   - size:  'sm' | 'md' | 'lg'  (default: 'md')
 *   - label: Optional text to display below the spinner (e.g. "Loading…")
 *   - className: Additional wrapper classes
 */

const sizeMap = {
  sm: 'w-5 h-5 border-2',
  md: 'w-8 h-8 border-[3px]',
  lg: 'w-12 h-12 border-4',
}

function Spinner({ size = 'md', label, className = '' }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
      role="status"
      aria-label={label || 'Loading'}
    >
      <div
        className={`${sizeMap[size]} rounded-full border-primary/20 border-t-primary animate-spin`}
      />
      {label && (
        <p className="text-sm text-text-secondary font-medium">{label}</p>
      )}
    </div>
  )
}

export default Spinner
