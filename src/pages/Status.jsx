import { useState, useEffect } from 'react';
import { fetchSystemSyncLogs } from '../services/api';

const SUPPLIERS = ['Booksite', 'Jonathan Ball', 'Protea', 'Indie Authors'];

function Status() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchSystemSyncLogs();
        setLogs(Array.isArray(data) ? data : Object.values(data));
      } catch (err) {
        console.error("API failed, using mock data for demonstration", err);
        // Fallback mock data to show the UI since Developer 2's backend endpoint might not be ready
        setLogs([
          { supplier: 'Booksite', lastSyncTime: new Date().toISOString(), rowsProcessed: 1200, errorsFlagged: 0, status: 'success' },
          { supplier: 'Jonathan Ball', lastSyncTime: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), rowsProcessed: 800, errorsFlagged: 5, status: 'success' }, // stale
          { supplier: 'Protea', lastSyncTime: new Date().toISOString(), rowsProcessed: 0, errorsFlagged: 12, status: 'failed' }, // failed
          { supplier: 'Indie Authors', lastSyncTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), rowsProcessed: 15, errorsFlagged: 0, status: 'success' }
        ]);
        // Show a gentle notice above
        setError("Could not connect to live backend endpoint. Displaying mock data for demonstration.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getSupplierLog = (supplierName) => {
    return logs.find(log => log.supplier?.toLowerCase() === supplierName.toLowerCase()) || null;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-primary-dark">System Status</h1>
        <p className="text-text-secondary mt-1">
          Monitor ingestion logs and data synchronisation status across all primary suppliers.
        </p>
      </div>

      {error && (
        <div className="bg-warning-light/50 text-warning-dark p-4 rounded-lg border border-warning flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-text-muted">Loading status...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {SUPPLIERS.map(supplier => {
            const log = getSupplierLog(supplier);
            
            let isStale = false;
            let isFailed = false;
            let lastSync = null;
            let rows = 0;
            let errors = 0;

            if (log) {
              lastSync = log.lastSyncTime ? new Date(log.lastSyncTime) : null;
              if (lastSync) {
                const hoursSinceSync = (new Date() - lastSync) / (1000 * 60 * 60);
                if (hoursSinceSync > 24) isStale = true;
              }
              if (log.status === 'failed') isFailed = true;
              rows = log.rowsProcessed || 0;
              errors = log.errorsFlagged || 0;
            }

            const hasAlert = isStale || isFailed;

            return (
              <div 
                key={supplier} 
                className={`p-6 rounded-2xl border shadow-sm flex flex-col gap-4 transition-colors ${
                  hasAlert 
                    ? 'bg-error-light/10 border-error' 
                    : 'bg-white border-border'
                }`}
              >
                <div className="flex justify-between items-start border-b border-border/50 pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-primary-dark flex items-center gap-2">
                      {supplier}
                      {hasAlert && (
                        <span className="text-error text-2xl leading-none" title={isStale ? "Data is stale (>24h)" : "Sync failed"}>
                          ⚠️
                        </span>
                      )}
                    </h3>
                  </div>
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                    hasAlert 
                      ? 'bg-error text-white' 
                      : log 
                        ? 'bg-success/10 text-success-dark' 
                        : 'bg-gray-100 text-gray-500'
                  }`}>
                    {hasAlert ? (isStale ? 'Stale Data' : 'Sync Failed') : log ? 'Healthy' : 'No Data'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-text-muted mb-1">Last Sync</p>
                    <p className={`font-medium ${isStale ? 'text-error' : 'text-text-primary'}`}>
                      {lastSync ? lastSync.toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      }) : 'Never'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-text-muted mb-1">Rows Processed</p>
                    <p className="font-medium text-text-primary">{rows.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-text-muted mb-1">Errors Flagged</p>
                    <p className={`font-medium ${errors > 0 ? 'text-error' : 'text-text-primary'}`}>
                      {errors.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Status;
