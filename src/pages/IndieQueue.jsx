import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import Alert from '../components/Alert'
import Spinner from '../components/Spinner'
import Toast from '../components/Toast'
import {
  fetchIndieSubmissions,
  approveIndieSubmission,
  rejectIndieSubmission,
} from '../services/api'

/**
 * IndieQueue — Staff-facing review queue for indie author book submissions.
 *
 * Features:
 *   - Status tabs: All / Pending (default) / Approved / Rejected
 *   - Search by title or author name
 *   - Sort by newest / oldest submission date
 *   - Detail modal with full metadata + cover preview
 *   - Approve & Reject actions with audit trail
 *   - Toast notifications on success / error
 */

const STATUS_TABS = [
  { value: 'pending', label: 'Pending', color: 'amber' },
  { value: 'all', label: 'All' },
  { value: 'approved', label: 'Approved', color: 'green' },
  { value: 'rejected', label: 'Rejected', color: 'red' },
]

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPrice(value) {
  const num = Number(value)
  if (isNaN(num)) return '—'
  return `R ${num.toFixed(2)}`
}

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
  }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-lg border capitalize ${styles[status] || styles.pending}`}
    >
      {status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse-dot" />}
      {status === 'approved' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />}
      {status === 'rejected' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />}
      {status}
    </span>
  )
}

function IndieQueue() {
  const { user } = useAuth()

  // ─── List state ───
  const [submissions, setSubmissions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // ─── Filter/sort state ───
  const [activeTab, setActiveTab] = useState('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortOrder, setSortOrder] = useState('newest')

  // ─── Detail modal ───
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // ─── Share modal ───
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // ─── Rejection flow ───
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionError, setRejectionError] = useState('')

  // ─── Action state ───
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingAction, setProcessingAction] = useState(null) // 'approve' | 'reject'

  // ─── Toast ───
  const [toast, setToast] = useState(null)

  // ─── Status counts (for tab badges) ───
  const [statusCounts, setStatusCounts] = useState({ all: 0, pending: 0, approved: 0, rejected: 0 })

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch submissions whenever filter/sort changes
  const loadSubmissions = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const data = await fetchIndieSubmissions({
        status: activeTab === 'all' ? undefined : activeTab,
        search: debouncedSearch || undefined,
        sort: sortOrder,
      })
      const list = Array.isArray(data) ? data : []
      setSubmissions(list)
    } catch (err) {
      setLoadError(err?.message || 'Failed to load submissions.')
      setSubmissions([])
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, debouncedSearch, sortOrder])

  useEffect(() => {
    let active = true
    setTimeout(() => {
      if (active) loadSubmissions()
    }, 0)
    return () => { active = false }
  }, [loadSubmissions])

  // Fetch all statuses for tab counts (on mount + after actions)
  const loadCounts = useCallback(async () => {
    try {
      const all = await fetchIndieSubmissions()
      const list = Array.isArray(all) ? all : []
      setStatusCounts({
        all: list.length,
        pending: list.filter((s) => s.status === 'pending').length,
        approved: list.filter((s) => s.status === 'approved').length,
        rejected: list.filter((s) => s.status === 'rejected').length,
      })
    } catch {
      // silently ignore count errors
    }
  }, [])

  useEffect(() => {
    let active = true
    setTimeout(() => {
      if (active) loadCounts()
    }, 0)
    return () => { active = false }
  }, [loadCounts])

  // ─── Open detail modal ───
  const openModal = (submission) => {
    setSelectedSubmission(submission)
    setIsModalOpen(true)
    setShowRejectForm(false)
    setRejectionReason('')
    setRejectionError('')
    setProcessingAction(null)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedSubmission(null)
    setShowRejectForm(false)
    setRejectionReason('')
    setRejectionError('')
    setProcessingAction(null)
  }

  // ─── Approve action ───
  const handleApprove = async () => {
    if (!selectedSubmission) return
    setIsProcessing(true)
    setProcessingAction('approve')
    try {
      await approveIndieSubmission(selectedSubmission.id, {
        reviewedBy: user?.name || user?.email || 'Staff',
      })
      setToast({
        variant: 'success',
        message: `✅ "${selectedSubmission.title}" has been approved and synced to catalogue.`,
      })
      closeModal()
      await Promise.all([loadSubmissions(), loadCounts()])
    } catch (err) {
      setToast({
        variant: 'error',
        message: err?.message || 'Failed to approve submission.',
      })
    } finally {
      setIsProcessing(false)
      setProcessingAction(null)
    }
  }

  // ─── Reject action ───
  const handleReject = async () => {
    if (!selectedSubmission) return
    setRejectionError('')

    if (!rejectionReason.trim()) {
      setRejectionError('A rejection reason is required.')
      return
    }

    setIsProcessing(true)
    setProcessingAction('reject')
    try {
      await rejectIndieSubmission(selectedSubmission.id, {
        reviewedBy: user?.name || user?.email || 'Staff',
        rejectionReason: rejectionReason.trim(),
      })
      setToast({
        variant: 'success',
        message: `"${selectedSubmission.title}" has been rejected. The author will be notified.`,
      })
      closeModal()
      await Promise.all([loadSubmissions(), loadCounts()])
    } catch (err) {
      setToast({
        variant: 'error',
        message: err?.message || 'Failed to reject submission.',
      })
    } finally {
      setIsProcessing(false)
      setProcessingAction(null)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* ─── Toast ─── */}
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* ═══════════════════════════════════════════════
          Page Header
          ═══════════════════════════════════════════════ */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold text-primary-dark">Indie Submissions</h1>
          <p className="text-text-secondary mt-1">
            Review book submissions from independent authors. Approve titles for the catalogue or reject with feedback.
          </p>
        </div>
        <button
          onClick={() => setIsShareModalOpen(true)}
          className="shrink-0 self-start md:self-center inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-primary hover:bg-primary-dark shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 10.742l5.136-2.568m-5.136 5.136l5.136 2.568M19 19a3 3 0 11-6 0 3 3 0 016 0zm-6-7a3 3 0 11-6 0 3 3 0 016 0zm6-7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Share Submission Form
        </button>
      </div>

      {/* ─── KPI Strip ─── */}
      <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{statusCounts.pending}</p>
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mt-1">Pending</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
          <p className="text-2xl font-bold text-emerald-700">{statusCounts.approved}</p>
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mt-1">Approved</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-center">
          <p className="text-2xl font-bold text-red-700">{statusCounts.rejected}</p>
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mt-1">Rejected</p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          Filter / Control Bar
          ═══════════════════════════════════════════════ */}
      <div className="space-y-4">
        {/* Status tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.value
            const count = statusCounts[tab.value] ?? 0
            return (
              <button
                key={tab.value}
                id={`tab-${tab.value}`}
                onClick={() => setActiveTab(tab.value)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-white text-text-secondary border border-border hover:bg-surface hover:text-primary'
                }`}
              >
                {tab.label}
                <span
                  className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-xs font-bold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-surface text-text-muted'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search + Sort row */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search bar */}
          <div className="flex-1 relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              id="indie-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or author…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-white text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all duration-200 shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <select
            id="indie-sort"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all duration-200 shadow-sm cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          Data Area
          ═══════════════════════════════════════════════ */}

      {/* Loading */}
      {isLoading && <Spinner size="lg" label="Loading submissions…" className="py-12" />}

      {/* Error */}
      {!!loadError && (
        <Alert variant="error" message={loadError} onDismiss={() => setLoadError('')} />
      )}

      {/* Empty state */}
      {!isLoading && !loadError && submissions.length === 0 && (
        <div className="text-center py-14 border border-border bg-white rounded-2xl">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-3xl">
            📝
          </div>
          <p className="mt-4 text-lg font-semibold text-primary-dark">
            {debouncedSearch
              ? `No submissions matching "${debouncedSearch}"`
              : activeTab === 'all'
                ? 'No submissions yet'
                : `No ${activeTab} submissions`}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {debouncedSearch
              ? 'Try a different search term.'
              : 'Submissions from indie authors will appear here.'}
          </p>
        </div>
      )}

      {/* ── Desktop Table ── */}
      {!isLoading && submissions.length > 0 && (
        <div className="hidden md:block">
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-surface">
                <tr className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  <th className="px-5 py-3.5">Submission Date</th>
                  <th className="px-5 py-3.5">Title</th>
                  <th className="px-5 py-3.5">Author</th>
                  <th className="px-5 py-3.5">Suggested Price</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub, idx) => (
                  <tr
                    key={sub.id}
                    className={`${idx > 0 ? 'border-t border-border' : ''} hover:bg-accent/5 transition-colors duration-150 cursor-pointer group`}
                    onClick={() => openModal(sub)}
                  >
                    <td className="px-5 py-4 align-middle">
                      <p className="text-sm text-text-primary">{formatDate(sub.submissionDate)}</p>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <p className="text-sm font-bold text-primary-dark truncate max-w-56 group-hover:text-accent-dark transition-colors">
                        {sub.title}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <p className="text-sm text-text-secondary">{sub.authorName}</p>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <p className="text-sm font-semibold text-text-primary">{formatPrice(sub.suggestedPrice)}</p>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="px-5 py-4 align-middle text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); openModal(sub) }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-primary/20 text-primary bg-primary/5 hover:bg-primary/15 transition-all duration-200 cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Mobile Cards ── */}
      {!isLoading && submissions.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {submissions.map((sub) => (
            <button
              key={sub.id}
              onClick={() => openModal(sub)}
              className="w-full text-left rounded-2xl border border-border bg-white shadow-sm p-4 space-y-3 hover:shadow-md transition-shadow duration-200 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-primary-dark truncate">{sub.title}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{sub.authorName}</p>
                </div>
                <StatusBadge status={sub.status} />
              </div>
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>{formatDate(sub.submissionDate)}</span>
                <span className="font-semibold text-text-primary">{formatPrice(sub.suggestedPrice)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Results count */}
      {!isLoading && submissions.length > 0 && (
        <p className="text-center text-xs text-text-muted">
          Showing {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
          {debouncedSearch && ` matching "${debouncedSearch}"`}
        </p>
      )}

      {/* ═══════════════════════════════════════════════
          Detail Modal
          ═══════════════════════════════════════════════ */}
      {isModalOpen && selectedSubmission && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 modal-backdrop-enter"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto modal-content-enter"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-primary-dark truncate pr-4">
                Submission Details
              </h2>
              <button
                onClick={closeModal}
                className="shrink-0 p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-6 space-y-6">
              {/* Title + Status */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-xl font-bold text-primary-dark">{selectedSubmission.title}</h3>
                  <p className="text-sm text-text-secondary mt-1">by {selectedSubmission.authorName}</p>
                </div>
                <StatusBadge status={selectedSubmission.status} />
              </div>

              {/* Cover image + metadata grid */}
              <div className="flex flex-col sm:flex-row gap-6">
                {/* Cover preview */}
                <div className="shrink-0 w-32 h-44 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-border overflow-hidden flex items-center justify-center">
                  {selectedSubmission.coverImageUrl ? (
                    <img
                      src={selectedSubmission.coverImageUrl}
                      alt={`Cover of ${selectedSubmission.title}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center">
                      <span className="text-4xl">📖</span>
                      <p className="text-xs text-text-muted mt-2">No cover</p>
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Author Email</p>
                    <a
                      href={`mailto:${selectedSubmission.authorEmail}`}
                      className="text-sm text-primary hover:text-primary-light transition-colors"
                    >
                      {selectedSubmission.authorEmail}
                    </a>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Submitted</p>
                    <p className="text-sm text-text-primary">{formatDateTime(selectedSubmission.submissionDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Page Count</p>
                    <p className="text-sm text-text-primary">{selectedSubmission.pageCount || '—'} pages</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Suggested Price</p>
                    <p className="text-sm font-bold text-accent-dark">{formatPrice(selectedSubmission.suggestedPrice)}</p>
                  </div>
                </div>
              </div>

              {/* Synopsis */}
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Synopsis</p>
                <div className="bg-surface rounded-xl p-4 border border-border">
                  <p className="text-sm text-text-primary leading-relaxed">
                    {selectedSubmission.synopsis || 'No synopsis provided.'}
                  </p>
                </div>
              </div>

              {/* Audit info (for non-pending) */}
              {selectedSubmission.status !== 'pending' && (
                <div className="bg-surface rounded-xl p-4 border border-border space-y-2">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Review Decision</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-text-secondary">
                      <span className="font-semibold text-text-primary">{selectedSubmission.reviewedBy || '—'}</span>
                      {' '}on {formatDateTime(selectedSubmission.reviewedAt)}
                    </span>
                  </div>
                  {selectedSubmission.rejectionReason && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-xs font-semibold text-error uppercase tracking-wider mb-1">Rejection Reason</p>
                      <p className="text-sm text-text-primary leading-relaxed">{selectedSubmission.rejectionReason}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Action Buttons (pending only) ─── */}
              {selectedSubmission.status === 'pending' && !showRejectForm && (
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    id="btn-approve"
                    onClick={handleApprove}
                    disabled={isProcessing}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isProcessing && processingAction === 'approve' ? (
                      <>
                        <Spinner size="sm" />
                        Processing…
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Approve &amp; Add to Catalogue
                      </>
                    )}
                  </button>
                  <button
                    id="btn-reject"
                    onClick={() => setShowRejectForm(true)}
                    disabled={isProcessing}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Reject
                  </button>
                </div>
              )}

              {/* ─── Rejection Form ─── */}
              {selectedSubmission.status === 'pending' && showRejectForm && (
                <div className="override-form-enter space-y-4 pt-2">
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-bold text-red-800">
                      Rejection Reason <span className="text-red-500">*</span>
                    </p>
                    <p className="text-xs text-red-600">
                      This reason will be shared with the author via email.
                    </p>
                    <textarea
                      id="rejection-reason"
                      value={rejectionReason}
                      onChange={(e) => { setRejectionReason(e.target.value); setRejectionError('') }}
                      rows={4}
                      placeholder="Explain why this submission is being rejected…"
                      className="w-full px-3 py-2.5 rounded-xl border border-red-200 bg-white text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all duration-200 resize-none"
                    />
                    {rejectionError && (
                      <p className="text-xs font-semibold text-red-600">{rejectionError}</p>
                    )}
                    <div className="flex gap-3">
                      <button
                        id="btn-confirm-reject"
                        onClick={handleReject}
                        disabled={isProcessing}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 shadow-md transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isProcessing && processingAction === 'reject' ? (
                          <>
                            <Spinner size="sm" />
                            Processing…
                          </>
                        ) : (
                          'Confirm Rejection'
                        )}
                      </button>
                      <button
                        onClick={() => { setShowRejectForm(false); setRejectionReason(''); setRejectionError('') }}
                        disabled={isProcessing}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold border-2 border-border text-text-secondary hover:bg-surface transition-all duration-200 cursor-pointer disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          Share Submission Form Modal
          ═══════════════════════════════════════════════ */}
      {isShareModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 modal-backdrop-enter"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setIsShareModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden modal-content-enter"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="bg-primary text-white px-6 py-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">Share Submission Form</h2>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 text-center space-y-6">
              <p className="text-sm text-text-secondary leading-relaxed">
                Provide this link or QR code to self-published authors so they can submit their books directly to your review queue.
              </p>

              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center p-4 bg-surface rounded-2xl border border-border inline-block mx-auto">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                    window.location.origin + '/submit'
                  )}`}
                  alt="QR Code for Submission Form"
                  className="w-40 h-40 object-contain shadow-sm bg-white p-2 rounded-lg"
                />
                <span className="text-[10px] text-text-muted mt-2 font-mono uppercase tracking-wider">
                  Scan to Submit
                </span>
              </div>

              {/* Link Input + Copy Button */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-left text-text-muted uppercase tracking-wider">
                  Submission Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={window.location.origin + '/submit'}
                    className="flex-1 bg-surface border border-border rounded-xl px-3 py-2 text-sm text-text-primary font-mono focus:outline-none"
                    onClick={(e) => e.target.select()}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.origin + '/submit')
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm cursor-pointer whitespace-nowrap ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-primary text-white hover:bg-primary-dark'
                    }`}
                  >
                    {copied ? 'Copied! ✓' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="bg-surface px-6 py-4 border-t border-border flex justify-end">
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="px-5 py-2.5 bg-white border border-border text-text-secondary rounded-xl text-sm font-semibold hover:bg-surface transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default IndieQueue
