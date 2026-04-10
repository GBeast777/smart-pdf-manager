import React, { useEffect, useState } from 'react'
import DocumentCard from '../components/DocumentCard'
import MergeSuggestions from '../components/MergeSuggestions'
import { Link } from 'react-router-dom'
import { getAllDocuments, computeMergeSuggestions } from '../lib/db'

const Dashboard = () => {
  const [documents, setDocuments] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchData = async () => {
    try {
      const docs = await getAllDocuments()
      setDocuments(docs)

      if (docs.length >= 2) {
        const sug = await computeMergeSuggestions()
        setSuggestions(sug)
      }
    } catch (error) {
      console.error("Error fetching dashboard data from IndexedDB", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  return (
    <div className="animate-in fade-in duration-500 w-full">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Dashboard</h2>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Welcome back. Here's an overview of your intelligent workspace.</p>
        </div>
        <Link to="/upload" className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm inline-flex items-center grow-0 self-start">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
          Upload PDF
        </Link>
      </header>

      {loading ? (
        <div className="animate-pulse space-y-6">
          <div className="h-40 bg-gray-200 rounded-2xl w-full"></div>
          <div className="h-40 bg-gray-200 rounded-2xl w-full"></div>
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <h3 className="text-xl font-semibold text-gray-800">Recent Uploads</h3>
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  placeholder="Find document..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full sm:w-48 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                />
                <Link to="/documents" className="text-sm font-medium text-primary hover:text-blue-700 transition-colors shrink-0">View All</Link>
              </div>
            </div>
            {documents.filter(d => d.fileName.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {documents.filter(d => d.fileName.toLowerCase().includes(searchQuery.toLowerCase())).map(doc => (
                  <DocumentCard key={doc.id} doc={doc} />
                ))}
              </div>
            ) : (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-8 sm:p-10 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-400">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <h4 className="text-gray-900 font-medium text-lg mb-1">No documents yet</h4>
                <p className="text-gray-500 text-sm mb-4">Start by scanning a folder for PDFs to analyze.</p>
                <Link to="/upload" className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors">
                  Scan Folder
                </Link>
              </div>
            )}
          </section>

          {suggestions.length > 0 && (
            <section>
              <h3 className="text-xl font-semibold text-gray-800 mb-5">Smart Suggestions</h3>
              <MergeSuggestions suggestions={suggestions} onMergeComplete={fetchData} />
            </section>
          )}
        </div>
      )}
    </div>
  )
}

export default Dashboard
