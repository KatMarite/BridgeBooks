import SupplierMatrix from './SupplierMatrix'

function BookResultsTable({ books }) {
  return (
    <div className="hidden md:block">
      <div className="table-scroll-mobile overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-surface">
            <tr className="text-xs font-semibold text-text-muted">
              <th className="px-4 py-3">Book</th>
              <th className="px-4 py-3">ISBN</th>
              <th className="px-4 py-3">Publication date</th>
              <th className="px-4 py-3">Suppliers</th>
            </tr>
          </thead>
          <tbody>
            {(books || []).map((book, idx) => {
              const cover = book?.coverImageUrl || book?.cover || ''
              const rowBorder = idx === 0 ? '' : 'border-t border-border'

              return (
                <tr key={book?.id || book?.isbn || idx} className={rowBorder}>
                  <td className="px-4 py-4 align-top">
                    <div className="flex gap-3">
                      <div className="w-12 h-16 rounded-xl bg-surface border border-border overflow-hidden shrink-0">
                        {cover ? (
                          <img
                            src={cover}
                            alt={`Cover of ${book?.title || 'book'}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-muted">
                            📘
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-primary-dark truncate">
                          {book?.title || 'Untitled'}
                        </p>
                        <p className="text-sm text-text-secondary truncate">{book?.author || '—'}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <p className="text-sm font-medium text-text-primary">{book?.isbn || '—'}</p>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <p className="text-sm font-medium text-text-primary">
                      {book?.publicationDate || '—'}
                    </p>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <SupplierMatrix suppliers={book?.suppliers} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default BookResultsTable

