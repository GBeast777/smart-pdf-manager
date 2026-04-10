import React, { useEffect, useState, useCallback } from 'react'
import { Layers, GripVertical, Trash2, FileText, Loader2, CheckCircle, AlertCircle, HardDrive, Plus, Sparkles, Lightbulb, ArrowRight } from 'lucide-react'
import axios from 'axios'
import { getAllDocuments, getDocumentBlob, addDocument, addChunks } from '../lib/db'

const MergePage = () => {
  const [availableDocs, setAvailableDocs] = useState([])
  const [selectedDocs, setSelectedDocs] = useState([]) // ordered list of { id, fileName, fileSize }
  const [loading, setLoading] = useState(true)
  const [isMerging, setIsMerging] = useState(false)
  const [mergeResult, setMergeResult] = useState(null) // { blob, pageCount, fileSize }
  const [mergeFileName, setMergeFileName] = useState('Merged_Document.pdf')
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [dragIdx, setDragIdx] = useState(null)

  // AI Smart Suggestion states
  const [suggestions, setSuggestions] = useState(null) // { groups: [...] }
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [suggestionError, setSuggestionError] = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        const docs = await getAllDocuments()
        setAvailableDocs(docs)
      } catch (err) {
        console.error('Failed to load documents:', err)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const formatSize = (bytes) => {
    if (!bytes) return '0 B'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  // ─── Selection ─────────────────────────────────────────────────────

  const addDoc = (doc) => {
    if (selectedDocs.find(d => d.id === doc.id)) return
    setSelectedDocs(prev => [...prev, { id: doc.id, fileName: doc.fileName, fileSize: doc.fileSize }])
    setMergeResult(null)
    setSaved(false)
    setError(null)
  }

  const removeDoc = (id) => {
    setSelectedDocs(prev => prev.filter(d => d.id !== id))
    setMergeResult(null)
    setSaved(false)
  }

  const clearSelection = () => {
    setSelectedDocs([])
    setMergeResult(null)
    setSaved(false)
    setError(null)
  }

  // ─── Drag Reorder ──────────────────────────────────────────────────

  const handleDragStart = (idx) => {
    setDragIdx(idx)
  }

  const handleDragOver = (e, idx) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return

    setSelectedDocs(prev => {
      const updated = [...prev]
      const [moved] = updated.splice(dragIdx, 1)
      updated.splice(idx, 0, moved)
      return updated
    })
    setDragIdx(idx)
    setMergeResult(null)
    setSaved(false)
  }

  const handleDragEnd = () => {
    setDragIdx(null)
  }

  const moveUp = (idx) => {
    if (idx === 0) return
    setSelectedDocs(prev => {
      const updated = [...prev]
      ;[updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]]
      return updated
    })
    setMergeResult(null)
    setSaved(false)
  }

  const moveDown = (idx) => {
    if (idx === selectedDocs.length - 1) return
    setSelectedDocs(prev => {
      const updated = [...prev]
      ;[updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]]
      return updated
    })
    setMergeResult(null)
    setSaved(false)
  }

  // ─── Merge ─────────────────────────────────────────────────────────

  const handleMerge = async () => {
    if (selectedDocs.length < 2) return

    setIsMerging(true)
    setError(null)
    setMergeResult(null)
    setSaved(false)

    try {
      // Sequential pairwise merge: merge first two, then merge result with next, etc.
      let currentBlob = await getDocumentBlob(selectedDocs[0].id)
      let totalPages = 0
      let totalSize = 0

      for (let i = 1; i < selectedDocs.length; i++) {
        const nextBlob = await getDocumentBlob(selectedDocs[i].id)

        if (!currentBlob || !nextBlob) {
          setError('Could not read one of the selected PDFs from local storage.')
          setIsMerging(false)
          return
        }

        const formData = new FormData()
        formData.append('file1', currentBlob, 'current.pdf')
        formData.append('file2', nextBlob, 'next.pdf')

        const res = await axios.post(`http://${window.location.hostname}:8000/merge`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })

        const { pdf_base64, page_count, file_size } = res.data
        const dataUrl = `data:application/pdf;base64,${pdf_base64}`
        const blobRes = await fetch(dataUrl)
        currentBlob = await blobRes.blob()
        totalPages = page_count
        totalSize = file_size
      }

      setMergeResult({ blob: currentBlob, pageCount: totalPages, fileSize: totalSize })
      setMergeFileName('Merged_Document.pdf')
    } catch (err) {
      console.error('Merge error:', err)
      setError('Merge failed: ' + (err.response?.data?.detail || err.message))
    } finally {
      setIsMerging(false)
    }
  }

  const handleSave = async () => {
    if (!mergeResult) return

    setIsSaving(true)
    setError(null)

    try {
      let finalName = mergeFileName.trim()
      if (!finalName) { setError('Please enter a file name.'); setIsSaving(false); return }
      if (!finalName.endsWith('.pdf')) finalName += '.pdf'

      // Process for embeddings
      const processForm = new FormData()
      processForm.append('file', mergeResult.blob, finalName)

      const processRes = await axios.post(`http://${window.location.hostname}:8000/process`, processForm, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const { summary, chunks } = processRes.data

      const docId = await addDocument({
        fileName: finalName,
        fileSize: mergeResult.blob.size,
        tags: 'Merged',
        summary: summary || 'Merged from multiple documents',
        pdfBlob: mergeResult.blob,
      })

      if (chunks && chunks.length > 0) {
        await addChunks(docId, chunks)
      }

      setSaved(true)
    } catch (err) {
      console.error('Save error:', err)
      setError('Failed to save: ' + (err.response?.data?.detail || err.message))
    } finally {
      setIsSaving(false)
    }
  }

  // ─── AI Smart Suggestions ──────────────────────────────────────────

  const handleSmartSuggest = async () => {
    if (availableDocs.length < 2) {
      setSuggestionError('Need at least 2 documents for AI suggestions.')
      return
    }

    setIsSuggesting(true)
    setSuggestionError(null)
    setSuggestions(null)

    try {
      const docsPayload = availableDocs.map(d => ({
        id: d.id,
        fileName: d.fileName,
        summary: d.summary || null,
        tags: d.tags || null,
      }))

      const res = await axios.post(`http://${window.location.hostname}:8000/suggest-smart-merge`, {
        documents: docsPayload,
      })

      if (res.data.groups && res.data.groups.length > 0) {
        setSuggestions(res.data)
      } else {
        setSuggestionError('Gemini could not find any clear merge groups.')
      }
    } catch (err) {
      console.error('Smart suggest error:', err)
      setSuggestionError(err.response?.data?.detail || 'Failed to get AI suggestions.')
    } finally {
      setIsSuggesting(false)
    }
  }

  const applySuggestion = (group) => {
    // Resolve doc IDs into full metadata in the AI-suggested order
    const ordered = group.doc_ids
      .map(id => availableDocs.find(d => d.id === id))
      .filter(Boolean)
      .map(d => ({ id: d.id, fileName: d.fileName, fileSize: d.fileSize }))

    setSelectedDocs(ordered)
    setMergeResult(null)
    setSaved(false)
    setError(null)
  }

  // ─── Render ────────────────────────────────────────────────────────

  const availableFiltered = availableDocs.filter(d => !selectedDocs.find(s => s.id === d.id))

  return (
    <div className="max-w-5xl mx-auto py-4 md:py-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Merge PDFs</h2>
          <p className="text-gray-500 text-sm sm:text-base">Select, reorder, and combine multiple PDFs into a single document.</p>
        </div>
        <button
          onClick={handleSmartSuggest}
          disabled={isSuggesting || availableDocs.length < 2}
          className={`w-full sm:w-auto px-5 py-3 rounded-xl font-semibold text-sm shadow-sm transition-all inline-flex items-center justify-center shrink-0
            ${isSuggesting
              ? 'bg-purple-100 text-purple-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 hover:shadow-md hover:-translate-y-0.5'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {isSuggesting ? (
            <><Loader2 size={16} className="animate-spin mr-2" /> Analyzing...</>
          ) : (
            <><Sparkles size={16} className="mr-2" /> Suggest Merge</>
          )}
        </button>
      </div>

      {/* AI Suggestion Error */}
      {suggestionError && (
        <div className="mb-5 p-4 bg-amber-50 text-amber-700 rounded-xl flex items-center text-sm font-medium border border-amber-100">
          <AlertCircle size={18} className="mr-2 shrink-0" />
          {suggestionError}
        </div>
      )}

      {/* AI Suggestion Cards */}
      {suggestions && suggestions.groups.length > 0 && (
        <div className="mb-6 animate-in slide-in-from-top-3 duration-300">
          <div className="flex items-center space-x-2 mb-3">
            <Sparkles size={16} className="text-purple-500" />
            <h3 className="text-sm font-bold text-purple-700 uppercase tracking-wider">AI Smart Suggestions</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {suggestions.groups.map((group, gIdx) => (
              <div key={gIdx} className="bg-gradient-to-br from-purple-50 via-white to-indigo-50 border border-purple-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                {/* Group Label */}
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-gray-900 text-sm">{group.label}</h4>
                  <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-bold uppercase tracking-wider">
                    {group.doc_ids.length} files
                  </span>
                </div>

                {/* AI Reasoning Tip */}
                <div className="flex items-start space-x-2 mb-4 bg-white/70 border border-purple-100/50 rounded-xl p-3">
                  <Lightbulb size={14} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-gray-600 leading-relaxed">
                    <span className="font-semibold text-purple-600">AI Tip: </span>
                    {group.reasoning}
                  </p>
                </div>

                {/* Ordered File List */}
                <div className="space-y-1.5 mb-4">
                  {group.doc_ids.map((docId, dIdx) => {
                    const doc = availableDocs.find(d => d.id === docId)
                    if (!doc) return null
                    return (
                      <div key={docId} className="flex items-center text-xs">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold mr-2 shrink-0">
                          {dIdx + 1}
                        </span>
                        <span className="text-gray-700 truncate" title={doc.fileName}>{doc.fileName}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Apply Button */}
                <button
                  onClick={() => applySuggestion(group)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors flex items-center justify-center shadow-sm"
                >
                  Apply Suggestion <ArrowRight size={14} className="ml-1.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col md:grid md:grid-cols-5 gap-5 md:gap-6">
        {/* ─── Left: Available Documents ───────────────────────── */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-semibold text-gray-800 text-sm">Available Documents</h3>
              <p className="text-xs text-gray-400 mt-0.5">Click to add to merge queue</p>
            </div>

            {loading ? (
              <div className="p-8 flex justify-center">
                <Loader2 size={24} className="animate-spin text-gray-400" />
              </div>
            ) : availableFiltered.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                {availableDocs.length === 0
                  ? 'No documents uploaded yet.'
                  : 'All documents are in the merge queue.'}
              </div>
            ) : (
              <div className="max-h-[280px] sm:max-h-[500px] overflow-y-auto divide-y divide-gray-50">
                {availableFiltered.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => addDoc(doc)}
                    className="w-full flex items-center px-4 sm:px-5 py-3 text-left hover:bg-indigo-50/50 transition-colors group tap-highlight"
                  >
                    <div className="p-2 bg-red-50 text-red-400 rounded-lg mr-3 shrink-0 group-hover:bg-indigo-100 group-hover:text-indigo-500 transition-colors">
                      <FileText size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{doc.fileName}</p>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="text-xs text-gray-400">{formatSize(doc.fileSize)}</span>
                        {doc.tags && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded font-medium">{doc.tags}</span>}
                      </div>
                    </div>
                    <Plus size={16} className="text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Right: Merge Queue & Actions ─────────────────────── */}
        <div className="md:col-span-3 flex flex-col space-y-4 sm:space-y-5">
          {/* Queue */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-800 text-sm">Merge Queue</h3>
                <p className="text-xs text-gray-400 mt-0.5">Drag to reorder • Documents merge top-to-bottom</p>
              </div>
              {selectedDocs.length > 0 && !saved && (
                <button onClick={clearSelection} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Clear all</button>
              )}
            </div>

            {selectedDocs.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Layers size={28} className="text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium mb-1">No documents selected</p>
                <p className="text-xs text-gray-400">Click documents on the left to add them here</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {selectedDocs.map((doc, idx) => (
                  <div
                    key={doc.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center px-4 py-3 transition-all group
                      ${dragIdx === idx ? 'bg-indigo-50 shadow-inner' : 'hover:bg-gray-50'}
                    `}
                  >
                    {/* Drag Handle */}
                    <div className="cursor-grab active:cursor-grabbing mr-3 text-gray-300 hover:text-gray-500 shrink-0 touch-none">
                      <GripVertical size={18} />
                    </div>

                    {/* Order Number */}
                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold mr-3 shrink-0">
                      {idx + 1}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{doc.fileName}</p>
                      <span className="text-xs text-gray-400">{formatSize(doc.fileSize)}</span>
                    </div>

                    {/* Reorder & Remove */}
                    <div className="flex items-center space-x-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => moveUp(idx)} disabled={idx === 0}
                        className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Move up">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 15l-6-6-6 6"/></svg>
                      </button>
                      <button onClick={() => moveDown(idx)} disabled={idx === selectedDocs.length - 1}
                        className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Move down">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
                      </button>
                      <button onClick={() => removeDoc(doc.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Remove">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-center text-sm font-medium border border-red-100">
              <AlertCircle size={18} className="mr-2 shrink-0" />
              {error}
            </div>
          )}

          {/* Merge Button */}
          {selectedDocs.length >= 2 && !mergeResult && !saved && (
            <button
              onClick={handleMerge}
              disabled={isMerging}
              className={`w-full py-4 rounded-xl text-white font-semibold flex items-center justify-center transition-all shadow-sm
                ${isMerging ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-md'}
              `}
            >
              {isMerging ? (
                <><Loader2 size={18} className="animate-spin mr-2" /> Merging {selectedDocs.length} PDFs...</>
              ) : (
                <><Layers size={18} className="mr-2" /> Merge {selectedDocs.length} PDFs</>
              )}
            </button>
          )}

          {selectedDocs.length === 1 && !mergeResult && (
            <div className="text-center text-sm text-gray-400 py-2">Select at least 2 documents to merge</div>
          )}

          {/* Post-Merge Preview */}
          {mergeResult && !saved && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 animate-in slide-in-from-bottom-3">
              <div className="flex items-center space-x-3 mb-5">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                  <CheckCircle size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Merge Complete</h3>
                  <p className="text-gray-500 text-sm">Review and save your merged document</p>
                </div>
              </div>

              {/* Details */}
              <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-3 border border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 flex items-center"><FileText size={15} className="mr-2 text-indigo-400" /> Total Pages</span>
                  <span className="text-sm font-bold text-gray-900">{mergeResult.pageCount} pages</span>
                </div>
                <div className="border-t border-gray-200"></div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 flex items-center"><HardDrive size={15} className="mr-2 text-indigo-400" /> File Size</span>
                  <span className="text-sm font-bold text-gray-900">{formatSize(mergeResult.fileSize)}</span>
                </div>
                <div className="border-t border-gray-200"></div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 flex items-center"><Layers size={15} className="mr-2 text-indigo-400" /> Source Files</span>
                  <span className="text-sm font-bold text-gray-900">{selectedDocs.length} documents</span>
                </div>
              </div>

              {/* Rename */}
              <label className="block text-sm font-semibold text-gray-700 mb-2">Document Name</label>
              <input
                type="text"
                value={mergeFileName}
                onChange={(e) => setMergeFileName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                placeholder="e.g. Combined_Report.pdf"
              />

              <div className="flex space-x-3">
                <button
                  onClick={() => setMergeResult(null)}
                  disabled={isSaving}
                  className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors border border-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !mergeFileName.trim()}
                  className="flex-1 py-3 flex items-center justify-center bg-indigo-600 text-white font-semibold hover:bg-indigo-700 rounded-xl disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isSaving ? <><Loader2 size={16} className="animate-spin mr-2" /> Saving...</> : 'Confirm & Save'}
                </button>
              </div>
            </div>
          )}

          {/* Saved Success */}
          {saved && (
            <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 text-center animate-in fade-in">
              <CheckCircle size={32} className="text-emerald-500 mx-auto mb-3" />
              <p className="text-emerald-700 font-semibold text-lg">Merged document saved!</p>
              <p className="text-emerald-600 text-sm mt-1 mb-4">Available on your Dashboard and Document Library.</p>
              <button
                onClick={() => {
                  setSelectedDocs([])
                  setMergeResult(null)
                  setSaved(false)
                  setMergeFileName('Merged_Document.pdf')
                  // Refresh available docs
                  getAllDocuments().then(setAvailableDocs)
                }}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
              >
                Merge More
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MergePage
