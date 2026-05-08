const SUPPLIERS = [
  { key: 'booksite', label: 'Booksite' },
  { key: 'jonathanBall', label: 'Jonathan Ball' },
  { key: 'protea', label: 'Protea' },
]

const currency = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' })

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '—'
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isFinite(num)) return currency.format(num)
  return String(value)
}

function StockBadge({ inStock, qty }) {
  const quantity = Number.isFinite(Number(qty)) ? Number(qty) : null
  const isInStock = !!inStock && (quantity === null || quantity > 0)

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
        isInStock ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
      }`}
    >
      {isInStock ? 'In stock' : 'Out of stock'}
      {isInStock && quantity !== null ? `(${quantity})` : null}
    </span>
  )
}

function SupplierMatrix({ suppliers, density = 'compact' }) {
  const isCozy = density === 'cozy'
  const data = suppliers && typeof suppliers === 'object' ? suppliers : {}

  return (
    <div className={`w-full ${isCozy ? 'space-y-3' : 'space-y-2'}`}>
      {SUPPLIERS.map((s) => {
        const entry = data[s.key] || data[s.label] || null
        const price = entry?.price ?? entry?.unitPrice ?? entry?.sellingPrice
        const inStock = entry?.inStock ?? entry?.available ?? entry?.isAvailable
        const qty = entry?.qty ?? entry?.quantity ?? entry?.stock

        return (
          <div key={s.key} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary-dark truncate">{s.label}</p>
              <p className="text-xs text-text-muted">Price: {formatPrice(price)}</p>
            </div>
            <StockBadge inStock={inStock} qty={qty} />
          </div>
        )
      })}
    </div>
  )
}

export default SupplierMatrix

