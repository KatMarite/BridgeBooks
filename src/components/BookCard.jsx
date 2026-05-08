import SupplierMatrix from './SupplierMatrix'

function BookCard({ book }) {
  const cover = book?.coverImageUrl || book?.cover || ''

  return (
    <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
      <div className="flex gap-4">
        <div className="w-16 h-24 rounded-xl bg-surface border border-border overflow-hidden shrink-0">
          {cover ? (
            <img
              src={cover}
              alt={`Cover of ${book?.title || 'book'}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-muted text-xl">
              📘
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-primary-dark leading-tight truncate">
            {book?.title || 'Untitled'}
          </h3>
          <p className="text-sm text-text-secondary truncate">{book?.author || '—'}</p>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-text-muted">ISBN</p>
              <p className="text-sm font-medium text-text-primary truncate">{book?.isbn || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Publication date</p>
              <p className="text-sm font-medium text-text-primary truncate">
                {book?.publicationDate || '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <SupplierMatrix suppliers={book?.suppliers} density="cozy" />
      </div>
    </div>
  )
}

export default BookCard

