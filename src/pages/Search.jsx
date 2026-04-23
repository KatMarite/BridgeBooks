import { useState } from 'react'
import SearchBar from '../components/SearchBar'

const sampleBooks = [
  { id: 1, title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', year: 1925, genre: 'Fiction', available: true },
  { id: 2, title: 'To Kill a Mockingbird', author: 'Harper Lee', year: 1960, genre: 'Fiction', available: false },
  { id: 3, title: '1984', author: 'George Orwell', year: 1949, genre: 'Dystopian', available: true },
  { id: 4, title: 'Pride and Prejudice', author: 'Jane Austen', year: 1813, genre: 'Romance', available: true },
  { id: 5, title: 'The Catcher in the Rye', author: 'J.D. Salinger', year: 1951, genre: 'Fiction', available: false },
  { id: 6, title: 'Brave New World', author: 'Aldous Huxley', year: 1932, genre: 'Dystopian', available: true },
]

function Search() {
  const [results, setResults] = useState(sampleBooks)
  const [searched, setSearched] = useState(false)

  const handleSearch = (query) => {
    setSearched(true)
    if (!query) {
      setResults(sampleBooks)
      return
    }
    const q = query.toLowerCase()
    setResults(
      sampleBooks.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          b.genre.toLowerCase().includes(q)
      )
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-primary-dark">Search Books</h1>
        <p className="text-text-secondary max-w-md mx-auto">
          Find any book in the BridgeBooks catalogue by title, author, or genre.
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex justify-center">
        <SearchBar onSearch={handleSearch} placeholder="Search by title, author, or genre…" />
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {results.map((book) => (
          <div
            key={book.id}
            className="bg-white rounded-2xl border border-border p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                {book.genre}
              </span>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  book.available
                    ? 'bg-success/10 text-success'
                    : 'bg-error/10 text-error'
                }`}
              >
                {book.available ? 'Available' : 'Checked Out'}
              </span>
            </div>
            <h3 className="text-lg font-bold text-primary-dark mb-1 leading-tight">
              {book.title}
            </h3>
            <p className="text-sm text-text-secondary">{book.author}</p>
            <p className="text-xs text-text-muted mt-1">Published {book.year}</p>
          </div>
        ))}
      </div>

      {searched && results.length === 0 && (
        <div className="text-center py-12">
          <p className="text-xl text-text-muted">No books found matching your search.</p>
        </div>
      )}
    </div>
  )
}

export default Search
