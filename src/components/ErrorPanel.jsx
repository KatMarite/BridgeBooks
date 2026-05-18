import { useState } from 'react'

/**
 * ErrorPanel — Highly visible error notification area for the dashboard.
 *
 * Props:
 *   - errors:       Array of error objects from the API
 *   - loading:      Boolean — shows skeleton when true
 *   - onResolve:    Callback(errorId) — marks an error as resolved
 *   - onDelete:     Callback(errorId) — deletes an error entry
 *   - onClearAll:   Callback() — clears all errors
 *   - className:    Additional wrapper classes
 *
 * Each error object shape:
 *   { id, timestamp, supplier, fileName, message, resolved }
 */

function formatTimestamp(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ErrorPanel({
  errors = [],
  loading = false,
  onResolve,
  onDelete,
  onClearAll,
  className = '',
}) {
  const [confirmClear, setConfirmClear] = useState(false)

  const unresolvedErrors = errors.filter((e) => !e.resolved)
  const hasErrors = unresolvedErrors.length > 0

  // Handle clear all with confirmation
  const handleClearAll = () => {
    if (confirmClear) {
      onClearAll?.()
      setConfirmClear(false)
    } else {
      setConfirmClear(true)
      // Auto-reset confirmation after 3 seconds
      setTimeout(() => setConfirmClear(false), 3000)
    }
  }

  if (loading) {
    return (
      <section className={className} id="error-panel" aria-busy="true">
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <div className="skeleton w-40 h-5" />
          </div>
          <div className="p-5 space-y-3">
            <div className="skeleton w-full h-16 rounded-xl" />
            <div className="skeleton w-full h-16 rounded-xl" />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className={className} id="error-panel">
      {/* ── Empty state: All systems normal ── */}
      {!hasErrors && (
        <div className="bg-success/5 border border-success/20 rounded-2xl px-6 py-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-success/15 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-success">All systems normal</p>
            <p className="text-xs text-text-muted mt-0.5">
              No ingestion errors today. Everything is running smoothly.
            </p>
          </div>
        </div>
      )}

      {/* ── Error list ── */}
      {hasErrors && (
        <div className="bg-white rounded-2xl border border-error/20 shadow-sm overflow-hidden">
          {/* Header bar — red gradient */}
          <div className="bg-gradient-to-r from-error to-error/80 px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Pulsing dot */}
              <span className="relative flex h-3 w-3">
                <span className="animate-pulse-dot absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
              </span>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                {unresolvedErrors.length} Ingestion Error{unresolvedErrors.length !== 1 ? 's' : ''}
              </h2>
            </div>

            {/* Clear All button */}
            <button
              onClick={handleClearAll}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                confirmClear
                  ? 'bg-white text-error hover:bg-white/90'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {confirmClear ? 'Confirm Clear All?' : 'Clear All'}
            </button>
          </div>

          {/* Error entries */}
          <div className="divide-y divide-border max-h-[20rem] overflow-y-auto">
            {unresolvedErrors.map((err) => (
              <div
                key={err.id}
                className="px-5 py-4 hover:bg-error/[0.02] transition-colors duration-150 group"
              >
                <div className="flex items-start gap-3">
                  {/* Error icon */}
                  <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-text-primary">
                        {err.supplier}
                      </span>
                      <span className="text-xs text-text-muted">•</span>
                      <span className="text-xs text-text-muted font-mono truncate">
                        {err.fileName}
                      </span>
                    </div>
                    <p className="text-sm text-error/90 leading-relaxed">
                      {err.message}
                    </p>
                    <p className="text-xs text-text-muted mt-1.5">
                      {formatTimestamp(err.timestamp)}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity duration-200">
                    {/* Resolve button */}
                    <button
                      onClick={() => onResolve?.(err.id)}
                      className="p-1.5 rounded-lg text-success hover:bg-success/10 transition-colors duration-150 cursor-pointer"
                      aria-label={`Mark error ${err.id} as resolved`}
                      title="Mark as resolved"
                    >
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => onDelete?.(err.id)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-colors duration-150 cursor-pointer"
                      aria-label={`Delete error ${err.id}`}
                      title="Delete error"
                    >
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export default ErrorPanel
