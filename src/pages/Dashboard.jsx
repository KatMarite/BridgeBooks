import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  fetchDashboardSummary,
  fetchDashboardActivity,
  fetchDashboardErrors,
  resolveError,
  deleteError,
  clearErrors,
} from '../services/api'
import KpiCard from '../components/KpiCard'
import DateRangeSelector from '../components/DateRangeSelector'
import ActivityFeed from '../components/ActivityFeed'
import ErrorPanel from '../components/ErrorPanel'
import Alert from '../components/Alert'

/**
 * Dashboard — Daily ingestion dashboard for BridgeBooks.
 *
 * Displays:
 *   1. KPI summary cards (files received, new ISBNs, metadata updates, error count)
 *   2. Error notification panel with resolve/delete actions
 *   3. Recent supplier file processing activity feed
 *
 * Features:
 *   - Date range filtering (Today / Yesterday / This Week)
 *   - Auto-refresh polling every 60 seconds
 *   - Manual refresh button
 *   - Loading skeletons and error handling
 */

const AUTO_REFRESH_MS = 60_000 // 60 seconds

function Dashboard() {
  const { user } = useAuth()

  // ── State ──
  const [dateRange, setDateRange] = useState('today')
  const [summary, setSummary] = useState(null)
  const [activity, setActivity] = useState([])
  const [errors, setErrors] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [fetchError, setFetchError] = useState(null)

  const intervalRef = useRef(null)

  // ── Data fetching ──
  const loadDashboardData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setFetchError(null)

      try {
        const [summaryData, activityData, errorsData] = await Promise.all([
          fetchDashboardSummary(dateRange),
          fetchDashboardActivity(dateRange),
          fetchDashboardErrors(dateRange),
        ])

        setSummary(summaryData)
        setActivity(activityData)
        setErrors(errorsData)
      } catch (err) {
        setFetchError(err.message || 'Failed to load dashboard data')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [dateRange]
  )

  // Fetch on mount and when dateRange changes
  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // ── Auto-refresh polling ──
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      loadDashboardData(true)
    }, AUTO_REFRESH_MS)

    return () => clearInterval(intervalRef.current)
  }, [loadDashboardData])

  // ── Error actions ──
  const handleResolve = async (errorId) => {
    try {
      await resolveError(errorId)
      setErrors((prev) =>
        prev.map((e) => (e.id === errorId ? { ...e, resolved: true } : e))
      )
      // Update the summary error count
      setSummary((prev) =>
        prev ? { ...prev, totalErrors: Math.max(0, prev.totalErrors - 1) } : prev
      )
    } catch {
      setFetchError('Failed to resolve error')
    }
  }

  const handleDelete = async (errorId) => {
    try {
      await deleteError(errorId)
      const deleted = errors.find((e) => e.id === errorId)
      setErrors((prev) => prev.filter((e) => e.id !== errorId))
      // Update summary if it was unresolved
      if (deleted && !deleted.resolved) {
        setSummary((prev) =>
          prev ? { ...prev, totalErrors: Math.max(0, prev.totalErrors - 1) } : prev
        )
      }
    } catch {
      setFetchError('Failed to delete error')
    }
  }

  const handleClearAll = async () => {
    try {
      await clearErrors(true)
      setErrors([])
      setSummary((prev) => (prev ? { ...prev, totalErrors: 0 } : prev))
    } catch {
      setFetchError('Failed to clear errors')
    }
  }

  // ── KPI card definitions ──
  const kpiCards = [
    {
      title: 'Files Received',
      value: summary?.filesReceived ?? 0,
      accentColor: 'bg-info',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
        </svg>
      ),
    },
    {
      title: 'New ISBNs Added',
      value: summary?.newIsbnsAdded ?? 0,
      accentColor: 'bg-success',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      title: 'Metadata Updates',
      value: summary?.metadataUpdates ?? 0,
      accentColor: 'bg-primary-light',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
    },
    {
      title: 'Ingestion Errors',
      value: summary?.totalErrors ?? 0,
      accentColor: summary?.totalErrors > 0 ? 'bg-error' : 'bg-success',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
    },
  ]

  // ── Greeting based on time of day ──
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── Header Row ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary-dark">
            {greeting}{user?.name ? `, ${user.name}` : ''}
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Here&apos;s your daily ingestion overview.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <DateRangeSelector value={dateRange} onChange={setDateRange} />

          {/* Refresh button */}
          <button
            id="dashboard-refresh-btn"
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-border rounded-xl text-sm font-medium text-text-secondary hover:text-primary hover:border-primary/30 hover:shadow-sm transition-all duration-200 cursor-pointer disabled:opacity-50"
            aria-label="Refresh dashboard data"
          >
            <svg
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Fetch Error Alert ── */}
      {fetchError && (
        <Alert
          variant="error"
          message={fetchError}
          onDismiss={() => setFetchError(null)}
        />
      )}

      {/* ── KPI Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpiCards.map((card) => (
          <KpiCard
            key={card.title}
            title={card.title}
            value={card.value}
            icon={card.icon}
            accentColor={card.accentColor}
            loading={loading}
          />
        ))}
      </div>

      {/* ── Error Panel ── */}
      <ErrorPanel
        errors={errors}
        loading={loading}
        onResolve={handleResolve}
        onDelete={handleDelete}
        onClearAll={handleClearAll}
      />

      {/* ── Activity Feed ── */}
      <ActivityFeed
        activities={activity}
        loading={loading}
      />

      {/* ── Auto-refresh indicator ── */}
      {!loading && (
        <div className="text-center text-xs text-text-muted pb-2">
          Auto-refreshes every 60 seconds
          {summary?.lastUpdated && (
            <>
              {' · '}Last updated {new Date(summary.lastUpdated).toLocaleTimeString('en-ZA')}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default Dashboard
