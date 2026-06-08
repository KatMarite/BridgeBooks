import { useEffect, useState } from 'react'

/**
 * Toast — Auto-dismissing notification component.
 *
 * Props:
 *   - message:   The notification text
 *   - variant:   'success' | 'error' (default: 'success')
 *   - duration:  Auto-dismiss time in ms (default: 4000)
 *   - onDismiss: Callback when the toast is dismissed
 */

const variantConfig = {
  success: {
    bg: 'bg-success',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  error: {
    bg: 'bg-error',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
}

function Toast({ message, variant = 'success', duration = 4000, onDismiss }) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true)
    }, duration)

    return () => clearTimeout(timer)
  }, [duration])

  useEffect(() => {
    if (isExiting) {
      const exitTimer = setTimeout(() => {
        onDismiss?.()
      }, 300) // match exit animation duration
      return () => clearTimeout(exitTimer)
    }
  }, [isExiting, onDismiss])

  if (!message) return null

  const config = variantConfig[variant] || variantConfig.success

  return (
    <div
      className={`fixed top-6 right-6 z-[100] max-w-sm w-full ${isExiting ? 'toast-exit' : 'toast-enter'}`}
      role="alert"
      aria-live="polite"
    >
      <div className={`${config.bg} text-white rounded-xl shadow-2xl overflow-hidden`}>
        <div className="flex items-start gap-3 px-4 py-3.5">
          {config.icon}
          <p className="text-sm font-medium flex-1 leading-snug">{message}</p>
          <button
            onClick={() => setIsExiting(true)}
            className="shrink-0 p-0.5 rounded-md hover:bg-white/20 transition-colors cursor-pointer"
            aria-label="Dismiss notification"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-white/20">
          <div
            className="h-full bg-white/60 rounded-full"
            style={{
              animation: `toast-progress ${duration}ms linear forwards`,
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default Toast
