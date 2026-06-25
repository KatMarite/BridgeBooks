import { useEffect, useState, useCallback, useRef } from 'react'
import { getSyncLogs, triggerShopifySync, uploadOnixFile } from '../services/api'

function SyncStatus() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [limit, setLimit] = useState(50)
  const [sourceFilter, setSourceFilter] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef(null)
  const [toast, setToast] = useState(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getSyncLogs({ limit, source: sourceFilter })
      setLogs(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [limit, sourceFilter])

  useEffect(() => {
    let active = true
    setTimeout(() => {
      if (active) fetchLogs()
    }, 0)
    // Poll every 10 seconds to keep dashboard fresh
    const interval = setInterval(() => {
      if (active) fetchLogs()
    }, 10000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [fetchLogs])

  const handleManualSync = async () => {
    setIsSyncing(true)
    try {
      await triggerShopifySync()
      showToast('Shopify sync started in the background!')
      setTimeout(fetchLogs, 2000) // Initial quick refresh
    } catch (err) {
      showToast('Failed to start sync: ' + err.message, true)
    } finally {
      setTimeout(() => setIsSyncing(false), 5000) // Prevent hammering
    }
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      await uploadOnixFile(file)
      showToast('ONIX file uploaded! Processing started in the background.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      setTimeout(fetchLogs, 2000)
    } catch (err) {
      showToast('Upload failed: ' + err.message, true)
    } finally {
      setIsUploading(false)
    }
  }

  const showToast = (message, isError = false) => {
    setToast({ message, isError })
    setTimeout(() => setToast(null), 4000)
  }

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Success</span>
      case 'error':
        return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">Error</span>
      case 'in_progress':
        return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium animate-pulse">In Progress</span>
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">{status}</span>
    }
  }

  const renderSourceBadge = (source) => {
    if (source === 'shopify_sync') {
      return <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-semibold uppercase tracking-wider">Shopify</span>
    }
    if (source.includes('ftp') || source.includes('booksite') || source.includes('protea')) {
      return <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-semibold uppercase tracking-wider">Ingestion</span>
    }
    return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-semibold uppercase tracking-wider">{source}</span>
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded shadow-lg text-white font-medium transition-all ${toast.isError ? 'bg-red-500' : 'bg-green-600'}`}>
          {toast.message}
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary-dark">Sync Telemetry</h1>
          <p className="text-text-secondary mt-1">
            Real-time logs for FTP ingestion, Enrichment, and Shopify synchronisation.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input 
            type="file" 
            accept=".xml" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={`px-5 py-2.5 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 ${
              isUploading 
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                : 'bg-white border border-border text-primary hover:bg-gray-50'
            }`}
          >
            {isUploading ? (
              <>
                <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
                Uploading...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Upload ONIX
              </>
            )}
          </button>
          
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className={`px-5 py-2.5 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 ${
              isSyncing 
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                : 'bg-primary text-white hover:bg-primary-dark'
            }`}
          >
            {isSyncing ? (
              <>
                <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
                Syncing...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Shopify Sync
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-border flex gap-4 items-center">
        <div>
          <label className="text-sm font-medium text-text-secondary mr-2">Filter Source:</label>
          <select 
            value={sourceFilter} 
            onChange={(e) => setSourceFilter(e.target.value)}
            className="border-gray-300 rounded-md text-sm focus:ring-primary focus:border-primary p-2"
          >
            <option value="">All Sources</option>
            <option value="shopify_sync">Shopify Sync</option>
            <option value="booksite_api">Booksite (API)</option>
            <option value="jonathan_ball_ftp">Jonathan Ball (FTP)</option>
            <option value="protea_ftp">Protea (FTP)</option>
            <option value="google_books_enrich">Google Books Enrichment</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-text-secondary mr-2">Limit:</label>
          <select 
            value={limit} 
            onChange={(e) => setLimit(Number(e.target.value))}
            className="border-gray-300 rounded-md text-sm focus:ring-primary focus:border-primary p-2"
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Data Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="p-12 text-center text-text-secondary">Loading telemetry...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-500">Error loading logs: {error}</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-text-secondary">No sync events found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background-alt text-text-secondary text-sm">
                  <th className="p-4 font-medium border-b border-border">Status</th>
                  <th className="p-4 font-medium border-b border-border">Source</th>
                  <th className="p-4 font-medium border-b border-border">Started</th>
                  <th className="p-4 font-medium border-b border-border">Duration</th>
                  <th className="p-4 font-medium border-b border-border">Metrics</th>
                  <th className="p-4 font-medium border-b border-border">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => {
                  const started = new Date(log.started_at)
                  const finished = log.finished_at ? new Date(log.finished_at) : null
                  const durationStr = finished 
                    ? ((finished - started) / 1000).toFixed(1) + 's' 
                    : '-'

                  const hasError = log.status === 'error'

                  return (
                    <tr key={log.id} className={`hover:bg-gray-50 transition-colors ${hasError ? 'bg-red-50/30' : ''}`}>
                      <td className="p-4 align-top">
                        {renderStatusBadge(log.status)}
                      </td>
                      <td className="p-4 align-top">
                        {renderSourceBadge(log.source)}
                        <div className="text-xs text-text-muted mt-1 font-mono">{log.filename}</div>
                      </td>
                      <td className="p-4 align-top text-sm text-text-primary whitespace-nowrap">
                        {started.toLocaleDateString()} <br/>
                        <span className="text-text-muted">{started.toLocaleTimeString()}</span>
                      </td>
                      <td className="p-4 align-top text-sm font-mono text-text-secondary">
                        {durationStr}
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex gap-4 text-sm">
                          <div className="text-center">
                            <div className="text-text-muted text-xs uppercase">Processed</div>
                            <div className="font-medium">{log.processed_records}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-text-muted text-xs uppercase">Updated</div>
                            <div className="font-medium text-green-600">{log.updated_records}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-text-muted text-xs uppercase">Errors</div>
                            <div className={`font-medium ${log.error_records > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                              {log.error_records}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 align-top text-sm">
                        {log.error_details ? (
                          <div className="bg-red-50 text-red-800 p-2 rounded border border-red-100 text-xs font-mono break-all max-w-xs max-h-24 overflow-y-auto">
                            {log.error_details}
                          </div>
                        ) : (
                          <span className="text-text-muted italic">No errors</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default SyncStatus
