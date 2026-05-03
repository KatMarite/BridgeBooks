/**
 * SyncStatus — Placeholder page for monitoring book data sync.
 *
 * This page will eventually show the status of data synchronisation
 * between BridgeBooks and external catalogue systems.
 */

function SyncStatus() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-primary-dark">Sync Status</h1>
        <p className="text-text-secondary mt-1">
          Monitor real-time data synchronisation with external catalogues.
        </p>
      </div>

      {/* Placeholder Content */}
      <div className="bg-white rounded-2xl border border-border p-12 shadow-sm text-center space-y-4">
        <span className="text-5xl">🔄</span>
        <h2 className="text-xl font-semibold text-primary-dark">
          Coming Soon
        </h2>
        <p className="text-text-secondary max-w-md mx-auto">
          Sync Status will show live connection health, last sync timestamps,
          and any errors that occurred during catalogue imports.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-text-muted pt-2">
          <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" />
          All systems operational
        </div>
      </div>
    </div>
  )
}

export default SyncStatus
