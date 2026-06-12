import { useState } from 'react'
import { createIndieSubmission } from '../services/api'
import Spinner from '../components/Spinner'

function SubmitIndie() {
  const [formData, setFormData] = useState({
    title: '',
    authorName: '',
    authorEmail: '',
    synopsis: '',
    pageCount: '',
    suggestedPrice: '',
    coverImageUrl: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.title.trim() || !formData.authorName.trim() || !formData.authorEmail.trim()) {
      setError('Title, Author Name, and Author Email are required.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      await createIndieSubmission(formData)
      setIsSuccess(true)
    } catch (err) {
      setError(err.message || 'An error occurred while submitting your book.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-border p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-primary-dark">Submission Received!</h2>
          <p className="text-text-secondary leading-relaxed pb-4 border-b border-border">
            Thank you for submitting your book to BridgeBooks. Our team will review your submission and get back to you via email shortly.
          </p>
          <button
            onClick={() => {
              setFormData({ title: '', authorName: '', authorEmail: '', synopsis: '', pageCount: '', suggestedPrice: '', coverImageUrl: '' })
              setIsSuccess(false)
            }}
            className="text-primary hover:text-primary-dark font-semibold text-sm transition-colors"
          >
            Submit another book
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-border">
        
        {/* Header */}
        <div className="bg-primary px-8 py-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white relative z-10 tracking-tight">BridgeBooks Indie Submissions</h1>
          <p className="text-primary-100 mt-3 text-lg max-w-lg mx-auto relative z-10">
            Self-published author? Submit your book below for consideration in our catalogue.
          </p>
        </div>

        {/* Form */}
        <div className="p-8 sm:p-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold flex items-start gap-3">
                <svg className="w-5 h-5 shrink-0 mt-0.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="title" className="block text-sm font-bold text-primary-dark mb-1">
                  Book Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  id="title"
                  required
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-shadow text-text-primary placeholder:text-gray-400 shadow-sm"
                  placeholder="e.g. The Winds of Change"
                />
              </div>

              <div>
                <label htmlFor="authorName" className="block text-sm font-bold text-primary-dark mb-1">
                  Author Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="authorName"
                  id="authorName"
                  required
                  value={formData.authorName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-shadow text-text-primary placeholder:text-gray-400 shadow-sm"
                  placeholder="Your full name or pen name"
                />
              </div>

              <div>
                <label htmlFor="authorEmail" className="block text-sm font-bold text-primary-dark mb-1">
                  Author Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="authorEmail"
                  id="authorEmail"
                  required
                  value={formData.authorEmail}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-shadow text-text-primary placeholder:text-gray-400 shadow-sm"
                  placeholder="you@example.com"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="synopsis" className="block text-sm font-bold text-primary-dark mb-1">
                  Synopsis / Blurb
                </label>
                <textarea
                  name="synopsis"
                  id="synopsis"
                  rows={4}
                  value={formData.synopsis}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-shadow text-text-primary placeholder:text-gray-400 shadow-sm resize-none"
                  placeholder="What is your book about? Provide a compelling summary..."
                />
              </div>

              <div>
                <label htmlFor="pageCount" className="block text-sm font-bold text-primary-dark mb-1">
                  Page Count <span className="text-text-muted font-normal ml-1">(Optional)</span>
                </label>
                <input
                  type="number"
                  name="pageCount"
                  id="pageCount"
                  min="1"
                  value={formData.pageCount}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-shadow text-text-primary placeholder:text-gray-400 shadow-sm"
                  placeholder="e.g. 350"
                />
              </div>

              <div>
                <label htmlFor="suggestedPrice" className="block text-sm font-bold text-primary-dark mb-1">
                  Suggested Retail Price (ZAR) <span className="text-text-muted font-normal ml-1">(Optional)</span>
                </label>
                <input
                  type="number"
                  name="suggestedPrice"
                  id="suggestedPrice"
                  step="0.01"
                  min="0"
                  value={formData.suggestedPrice}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-shadow text-text-primary placeholder:text-gray-400 shadow-sm"
                  placeholder="e.g. 299.99"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="coverImageUrl" className="block text-sm font-bold text-primary-dark mb-1">
                  Cover Image URL <span className="text-text-muted font-normal ml-1">(Optional)</span>
                </label>
                <input
                  type="url"
                  name="coverImageUrl"
                  id="coverImageUrl"
                  value={formData.coverImageUrl}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-shadow text-text-primary placeholder:text-gray-400 shadow-sm"
                  placeholder="https://example.com/cover.jpg"
                />
                <p className="mt-2 text-xs text-text-muted">
                  Provide a direct link to your book's cover image if you have one.
                </p>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto sm:min-w-[200px] flex justify-center items-center gap-2 py-3.5 px-8 border border-transparent rounded-xl shadow-lg text-base font-bold text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed mx-auto"
              >
                {isSubmitting ? (
                  <>
                    <Spinner size="sm" className="text-white" /> Submitting...
                  </>
                ) : (
                  'Submit Book for Review'
                )}
              </button>
            </div>
          </form>
        </div>
        
      </div>
    </div>
  )
}

export default SubmitIndie
