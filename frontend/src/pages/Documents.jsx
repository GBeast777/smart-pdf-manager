import React, { useEffect, useState } from 'react'
import DocumentCard from '../components/DocumentCard'
import { Filter, Trash2, ShieldAlert, Search, FileText, Layers, HardDrive, Loader2 } from 'lucide-react'
import axios from 'axios'
import {
  getAllDocuments,
  deleteDocument,
  deleteDocumentsByDateRange,
  updateDocument,
  renameCategory,
  getDocumentBlob,
  addDocument,
  addChunks,
} from '../lib/db'

const DocumentsPage = () => {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [tagFilter, setTagFilter] = useState('')
  const [tagsList, setTagsList] = useState([])
  const [searchQuery, setSearchQuery] = useState('')

  // Multiple Select / Merge states
  const [selectedDocs, setSelectedDocs] = useState([])
  const [isMerging, setIsMerging] = useState(false)
  // Post-merge preview modal state
  const [mergePreview, setMergePreview] = useState(null) // { blob, pageCount, fileSize }
  const [mergeFileName, setMergeFileName] = useState('Merged_Document.pdf')
  const [isSavingMerge, setIsSavingMerge] = useState(false)

  // Date deletion states
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchDocuments = async () => {
    setLoading(true)
    try {
      let docs = await getAllDocuments()

      // Extract unique tags (before filtering)
      const cats = [...new Set(docs.map(d => d.tags).filter(Boolean))]
      setTagsList(cats)

      if (tagFilter) {
        docs = docs.filter(d => d.tags === tagFilter)
      }

      setDocuments(docs)
    } catch (error) {
      console.error("Error fetching documents from IndexedDB", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [tagFilter])

  const handleDeleteByDate = async () => {
    if (!startDate || !endDate) {
      alert("Please select both start and end dates.")
      return
    }

    if (window.confirm(`Are you sure you want to delete all documents between ${startDate} and ${endDate}? This action cannot be undone.`)) {
      setIsDeleting(true)
      try {
        const count = await deleteDocumentsByDateRange(startDate, endDate)
        alert(`Successfully deleted ${count} documents.`)
        fetchDocuments()
      } catch (error) {
        console.error("Delete error", error)
        alert("Failed to delete documents.")
      } finally {
        setIsDeleting(false)
      }
    }
  }

  const handleDeleteSingle = async (id) => {
    if (window.confirm("Delete this document? This cannot be undone.")) {
      try {
        await deleteDocument(id)
        fetchDocuments()
      } catch (err) {
        alert("Failed to delete document.")
      }
    }
  }

  const handleRenameSingle = async (id, oldName) => {
    let baseName = oldName.replace(/\.pdf$/i, '')
    const newNameStr = window.prompt("Rename document to:", baseName)
    if (newNameStr === null || !newNameStr.trim()) return

    let newName = newNameStr.trim()
    if (!newName.endsWith('.pdf')) newName += '.pdf'

    try {
      await updateDocument(id, { fileName: newName })
      fetchDocuments()
    } catch (err) {
      alert("Failed to rename document.")
    }
  }

  const handleSelectDoc = (id) => {
    setSelectedDocs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // Step 1: Merge on backend and show preview modal
  const handleMergeTrigger = async () => {
    if (selectedDocs.length < 2) return

    setIsMerging(true)
    try {
      const blob1 = await getDocumentBlob(selectedDocs[0])
      const blob2 = await getDocumentBlob(selectedDocs[1])

      if (!blob1 || !blob2) {
        alert("Could not read one of the selected PDFs.")
        setIsMerging(false)
        return
      }

      const formData = new FormData()
      formData.append('file1', blob1, 'file1.pdf')
      formData.append('file2', blob2, 'file2.pdf')

      const res = await axios.post(`http://${window.location.hostname}:8000/merge`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      // Decode base64 PDF into a Blob (handles large files)
      const { pdf_base64, page_count, file_size } = res.data
      const dataUrl = `data:application/pdf;base64,${pdf_base64}`
      const blobRes = await fetch(dataUrl)
      const mergedBlob = await blobRes.blob()

      setMergePreview({ blob: mergedBlob, pageCount: page_count, fileSize: file_size })
      setMergeFileName('Merged_Document.pdf')
    } catch (err) {
      console.error("Merge error", err)
      alert("Merge failed: " + (err.response?.data?.detail || err.message))
    } finally {
      setIsMerging(false)
    }
  }

  // Step 2: Confirm & Save the merged document
  const handleMergeConfirmSave = async () => {
    if (!mergePreview || !mergeFileName.trim()) {
      alert("Please enter a valid file name.")
      return
    }

    setIsSavingMerge(true)
    try {
      let finalName = mergeFileName.trim()
      if (!finalName.endsWith('.pdf')) finalName += '.pdf'

      // Process the merged PDF for embeddings/categorization
      const processForm = new FormData()
      processForm.append('file', mergePreview.blob, finalName)

      const processRes = await axios.post(`http://${window.location.hostname}:8000/process`, processForm, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const { summary, category, chunks } = processRes.data

      const docId = await addDocument({
        fileName: finalName,
        fileSize: mergePreview.blob.size,
        tags: 'Merged',
        summary: summary || 'Merged from selected documents',
        pdfBlob: mergePreview.blob,
      })

      if (chunks && chunks.length > 0) {
        await addChunks(docId, chunks)
      }

      setMergePreview(null)
      setSelectedDocs([])
      setMergeFileName('Merged_Document.pdf')
      fetchDocuments()
    } catch (err) {
      console.error("Save error", err)
      alert("Failed to save merged document: " + (err.response?.data?.detail || err.message))
    } finally {
      setIsSavingMerge(false)
    }
  }

  const handleMergeCancelPreview = () => {
    setMergePreview(null)
    setMergeFileName('Merged_Document.pdf')
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  const handleRenameCategory = async (oldName) => {
    const newName = window.prompt(`Rename category '${oldName}' to:`)
    if (newName && newName.trim()) {
      try {
        await renameCategory(oldName, newName.trim())
        setTagFilter(prev => prev === oldName ? newName.trim() : prev)
        fetchDocuments()
      } catch (err) {
        alert("Failed to rename category.")
      }
    }
  }

  return (
    <div className="animate-in fade-in duration-500 w-full max-w-5xl mx-auto pb-4 md:pb-10">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">Document Library</h2>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Manage your locally stored documents.</p>
        </div>

        {/* Date Deletion Tool */}
        <div className="bg-red-50 border border-red-100 p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-end gap-3 shadow-sm w-full md:w-auto">
          <div>
            <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-red-800 mb-1 flex items-center"><ShieldAlert size={12} className="mr-1"/> Delete by Date</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs sm:text-sm border-gray-200 rounded-lg p-2 bg-white text-gray-700 shadow-sm focus:ring-red-500 focus:border-red-500 flex-1 min-w-0"
              />
              <span className="text-gray-400 font-medium text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs sm:text-sm border-gray-200 rounded-lg p-2 bg-white text-gray-700 shadow-sm focus:ring-red-500 focus:border-red-500 flex-1 min-w-0"
              />
            </div>
          </div>
          <button
            onClick={handleDeleteByDate}
            disabled={isDeleting || !startDate || !endDate}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg shadow disabled:opacity-50 transition-colors w-full sm:w-auto flex items-center justify-center"
          >
            {isDeleting ? 'Deleting...' : <Trash2 size={16} />}
          </button>
        </div>
      </header>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 sm:mb-8 justify-between">
        <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-100 shadow-sm overflow-x-auto hide-scrollbar">
          <Filter size={16} className="text-gray-400 mx-2 shrink-0" />
          <button
            onClick={() => setTagFilter('')}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${!tagFilter ? 'bg-darker text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            All
          </button>
          {tagsList.map(t => (
            <div key={t} className="flex items-center flex-nowrap bg-white border border-gray-100 rounded-lg overflow-hidden group">
              <button
                onClick={() => setTagFilter(t)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${tagFilter === t ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {t}
              </button>
              <button
                onClick={() => handleRenameCategory(t)}
                className="px-2 py-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 border-l border-gray-100 transition-colors"
                title="Rename Category"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
              </button>
            </div>
          ))}
        </div>

        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
            placeholder="Search files by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-white border border-gray-100 shadow-sm rounded-2xl w-full"></div>)}
        </div>
      ) : documents.filter(d => d.fileName.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 auto-rows-max">
          {documents
            .filter(d => d.fileName.toLowerCase().includes(searchQuery.toLowerCase()))
            .map(doc => (
            <DocumentCard key={doc.id} doc={doc} onDelete={handleDeleteSingle} onRename={handleRenameSingle} onSelect={handleSelectDoc} selected={selectedDocs.includes(doc.id)} />
          ))}
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-400">
            <Filter size={24} />
          </div>
          <h4 className="text-lg font-medium text-gray-900 mb-1">No documents found</h4>
          <p className="text-gray-500 text-sm">No files uploaded yet, or none match the selected filters.</p>
        </div>
      )}

      {/* Floating Merge Action */}
      {selectedDocs.length >= 2 && !mergePreview && (
        <div className="fixed bottom-20 md:bottom-10 left-1/2 transform -translate-x-1/2 bg-white px-4 sm:px-6 py-3 sm:py-4 rounded-full shadow-2xl border border-gray-200 flex items-center gap-3 sm:gap-6 z-40 animate-in slide-in-from-bottom-10 max-w-[95vw]">
          <span className="font-semibold text-gray-800 text-sm sm:text-base whitespace-nowrap"><span className="text-indigo-600">{selectedDocs.length}</span> selected</span>
          <button
            onClick={handleMergeTrigger}
            disabled={isMerging}
            className="px-4 sm:px-6 py-2.5 bg-indigo-600 text-white rounded-xl shadow hover:bg-indigo-700 transition disabled:opacity-60 flex items-center text-sm sm:text-base whitespace-nowrap"
          >
            {isMerging ? (<><Loader2 size={16} className="animate-spin mr-2" /> Merging...</>) : 'Merge PDFs'}
          </button>
        </div>
      )}

      {/* Post-Merge Preview Modal */}
      {mergePreview && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-center items-end sm:items-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-xl animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200 safe-bottom">
            {/* Header */}
            <div className="flex items-center space-x-3 mb-5">
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                <Layers size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Merge Complete</h3>
                <p className="text-gray-500 text-sm">Review details before saving</p>
              </div>
            </div>

            {/* Document Details */}
            <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-3 border border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center"><FileText size={15} className="mr-2 text-indigo-400" /> Total Pages</span>
                <span className="text-sm font-bold text-gray-900">{mergePreview.pageCount} pages</span>
              </div>
              <div className="border-t border-gray-200"></div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center"><HardDrive size={15} className="mr-2 text-indigo-400" /> File Size</span>
                <span className="text-sm font-bold text-gray-900">{formatFileSize(mergePreview.fileSize)}</span>
              </div>
            </div>

            {/* Rename Input */}
            <label className="block text-sm font-semibold text-gray-700 mb-2">Document Name</label>
            <input
              type="text"
              value={mergeFileName}
              onChange={(e) => setMergeFileName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-6 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              placeholder="e.g. Q3_Finance_Report.pdf"
            />

            {/* Action Buttons */}
            <div className="flex space-x-3 justify-end">
              <button
                onClick={handleMergeCancelPreview}
                disabled={isSavingMerge}
                className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMergeConfirmSave}
                disabled={isSavingMerge || !mergeFileName.trim()}
                className="px-5 py-2.5 flex items-center bg-indigo-600 text-white font-semibold hover:bg-indigo-700 rounded-xl disabled:opacity-50 transition-colors shadow-sm"
              >
                {isSavingMerge ? (<><Loader2 size={16} className="animate-spin mr-2" /> Saving...</>) : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DocumentsPage
