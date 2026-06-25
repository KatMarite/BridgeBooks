import { useState, useEffect } from 'react'
import { fetchBookById } from '../services/api'
import SupplierMatrix from './SupplierMatrix'

function BookDetailModal({ isbn, onClose }) {
  const [book, setBook] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    const loadBook = async () => {
      try {
        setIsLoading(true)
        setError('')
        const data = await fetchBookById(isbn)
        if (mounted) {
          setBook(data)
        }
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load book details')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    loadBook()
    
    // Prevent background scrolling when modal is open
    document.body.style.overflow = 'hidden'
    return () => {
      mounted = false
      document.body.style.overflow = ''
    }
  }, [isbn])

  if (!isbn) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div 
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-surface shrink-0">
          <h2 className="text-xl font-bold text-primary-dark">Book Details</h2>
          <button 
            onClick={onClose}
            className="p-2 text-text-secondary hover:text-primary-dark hover:bg-black/5 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-text-muted">
              <svg className="animate-spin w-8 h-8 mb-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <p>Loading details...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-red-500">
              <svg className="w-12 h-12 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <p className="font-medium text-center">{error}</p>
            </div>
          ) : book ? (
            <div className="flex flex-col md:flex-row gap-8">
              {/* Left Column: Image */}
              <div className="w-full md:w-1/3 shrink-0">
                <div className="bg-surface border border-border rounded-xl overflow-hidden aspect-[2/3] relative">
                  {book.coverImageUrl ? (
                    <img 
                      src={book.coverImageUrl} 
                      alt={book.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted bg-surface">
                      <span className="text-4xl mb-2">📘</span>
                      <span className="text-sm">No Cover</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Info */}
              <div className="flex-1 space-y-6">
                <div>
                  <h1 className="text-3xl font-black text-primary-dark tracking-tight leading-tight mb-2">
                    {book.title || 'Untitled'}
                  </h1>
                  <p className="text-lg text-text-secondary font-medium">
                    {book.author || 'Unknown Author'}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-surface rounded-xl border border-border">
                  <div>
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">ISBN-13</p>
                    <p className="font-medium text-primary-dark">{book.isbn}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Published</p>
                    <p className="font-medium text-primary-dark">{book.publicationDate || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Pages</p>
                    <p className="font-medium text-primary-dark">{book.pageCount || '—'}</p>
                  </div>
                </div>

                {book.description && (
                  <div>
                    <h3 className="text-lg font-bold text-primary-dark mb-2">Synopsis</h3>
                    <div className="prose prose-sm text-text-secondary max-w-none">
                      {book.description}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-bold text-primary-dark mb-3">Supplier Availability</h3>
                  <div className="bg-surface rounded-xl border border-border overflow-hidden">
                    <SupplierMatrix suppliers={book.suppliers} />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      
      {/* Click outside overlay to close */}
      <div className="absolute inset-0 z-[-1]" onClick={onClose} />
    </div>
  )
}

export default BookDetailModal
