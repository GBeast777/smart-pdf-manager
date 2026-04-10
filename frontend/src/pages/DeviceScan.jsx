import React, { useState, useRef } from 'react'
import {
  Smartphone, Search, FileText, CheckCircle, AlertCircle,
  Loader2, Upload, FolderOpen, Check, X, Sparkles, Tag
} from 'lucide-react'
import axios from 'axios'
import { addDocument, addChunks, getAllDocuments } from '../lib/db'

const DeviceScanPage = () => {
  const [discoveredFiles, setDiscoveredFiles] = useState([]) // { file, name, size, selected, status, category }
  const [isScanning, setIsScanning] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState(null)
  const [successCount, setSuccessCount] = useState(0)
  const [existingNames, setExistingNames] = useState(new Set())

  const fileInputRef = useRef(null)

  const formatSize = (bytes) => {
    if (!bytes) return '0 B'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  // ─── Scan Device (via native file picker) ──────────────────────────

  const handleScanDevice = async () => {
    // First, load existing doc names to mark duplicates
    try {
      const existing = await getAllDocuments()
      setExistingNames(new Set(existing.map(d => d.fileName)))
    } catch (_) {}

    // Trigger the native file picker
    fileInputRef.current?.click()
  }

  const handleFilesSelected = (e) => {
    const selected = Array.from(e.target.files || [])
    const pdfs = selected.filter(f => f.name.toLowerCase().endsWith('.pdf'))

    if (pdfs.length === 0) {
      setError('No PDF files found in your selection.')
      return
    }

    const entries = pdfs.map(f => ({
      file: f,
      name: f.name,
      size: f.size,
      selected: true,
      status: existingNames.has(f.name) ? 'exists' : null,
      category: null,
    }))

    setDiscoveredFiles(prev => {
      const existingKeys = new Set(prev.map(e => `${e.name}|${e.size}`))
      const newFiles = entries.filter(e => !existingKeys.has(`${e.name}|${e.size}`))
      return [...prev, ...newFiles]
    })
    setError(null)
    setSuccessCount(0)
    e.target.value = ''
  }

  // ─── Selection ─────────────────────────────────────────────────────

  const toggleSelect = (idx) => {
    setDiscoveredFiles(prev => prev.map((f, i) => i === idx ? { ...f, selected: !f.selected } : f))
  }

  const selectAll = () => {
    setDiscoveredFiles(prev => prev.map(f => f.status !== 'exists' && f.status !== 'done' ? { ...f, selected: true } : f))
  }

  const deselectAll = () => {
    setDiscoveredFiles(prev => prev.map(f => ({ ...f, selected: false })))
  }

  const clearAll = () => {
    setDiscoveredFiles([])
    setError(null)
    setSuccessCount(0)
  }

  // ─── Bulk Import with AI Categorization ────────────────────────────

  const handleBulkImport = async () => {
    const toImport = discoveredFiles.filter(f => f.selected && f.status !== 'done' && f.status !== 'exists')
    if (toImport.length === 0) return

    setIsImporting(true)
    setError(null)
    setImportProgress({ done: 0, total: toImport.length })

    let completed = 0
    let failed = 0

    for (const entry of toImport) {
      const idx = discoveredFiles.findIndex(f => f.name === entry.name && f.size === entry.size)

      // Update status to processing
      setDiscoveredFiles(prev => prev.map((f, i) => i === idx ? { ...f, status: 'processing' } : f))

      try {
        // Send to backend for processing + AI categorization
        const formData = new FormData()
        formData.append('file', entry.file)

        const res = await axios.post(`http://${window.location.hostname}:8000/process`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })

        const { summary, category, chunks } = res.data

        // Store in IndexedDB
        const docId = await addDocument({
          fileName: entry.name,
          fileSize: entry.size,
          tags: category || 'Uncategorized',
          summary,
          pdfBlob: entry.file,
        })

        if (chunks && chunks.length > 0) {
          await addChunks(docId, chunks)
        }

        completed++
        setDiscoveredFiles(prev => prev.map((f, i) => i === idx ? { ...f, status: 'done', category: category || 'Uncategorized' } : f))
      } catch (err) {
        console.error(`Failed to import ${entry.name}:`, err)
        failed++
        setDiscoveredFiles(prev => prev.map((f, i) => i === idx ? { ...f, status: 'error' } : f))
      }

      setImportProgress({ done: completed + failed, total: toImport.length })
    }

    setIsImporting(false)
    setSuccessCount(completed)

    if (failed > 0) {
      setError(`${completed} imported successfully, ${failed} failed.`)
    }
  }

  // ─── Computed Values ───────────────────────────────────────────────

  const selectedCount = discoveredFiles.filter(f => f.selected && f.status !== 'done' && f.status !== 'exists').length
  const doneCount = discoveredFiles.filter(f => f.status === 'done').length
  const totalSize = discoveredFiles.reduce((sum, f) => sum + f.size, 0)
  const allDone = discoveredFiles.length > 0 && doneCount === discoveredFiles.filter(f => f.status !== 'exists').length

  // Category breakdown from imported files
  const categoryMap = {}
  discoveredFiles.filter(f => f.status === 'done' && f.category).forEach(f => {
    categoryMap[f.category] = (categoryMap[f.category] || 0) + 1
  })

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto py-6 animate-in fade-in duration-500">
      {/* Hidden Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        onChange={handleFilesSelected}
        className="hidden"
      />

      {/* Header */}
      <div className="mb-6 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Smartphone size={30} className="text-indigo-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Device Scan</h2>
        <p className="text-gray-500 text-sm max-w-md mx-auto">
          Select PDFs from your device, preview them, then bulk import with AI auto-categorization.
        </p>
      </div>

      {/* Scan Button (large, mobile-friendly) */}
      {discoveredFiles.length === 0 && (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-10 text-center hover:border-indigo-300 transition-all">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <Search size={36} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Scan Your Device</h3>
          <p className="text-sm text-gray-500 mb-6">Opens your device's file browser to select PDF files</p>
          <button
            onClick={handleScanDevice}
            className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-semibold text-base shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all inline-flex items-center"
          >
            <FolderOpen size={20} className="mr-2" />
            Browse Device for PDFs
          </button>
        </div>
      )}

      {/* Found on Device */}
      {discoveredFiles.length > 0 && (
        <div className="space-y-4">
          {/* Stats Bar */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-4">
                <div className="flex items-center text-sm">
                  <FileText size={16} className="text-indigo-500 mr-1.5" />
                  <span className="font-bold text-gray-900">{discoveredFiles.length}</span>
                  <span className="text-gray-500 ml-1">found</span>
                </div>
                <div className="text-xs text-gray-400">{formatSize(totalSize)} total</div>
                {doneCount > 0 && (
                  <div className="flex items-center text-xs text-emerald-600 font-semibold">
                    <CheckCircle size={13} className="mr-1" /> {doneCount} imported
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button onClick={handleScanDevice} className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-indigo-100 hover:text-indigo-700 text-gray-600 rounded-lg transition-colors font-medium">
                  + Add More
                </button>
                <button onClick={selectAll} className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors font-medium">
                  All
                </button>
                <button onClick={deselectAll} className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors font-medium">
                  None
                </button>
                <button onClick={clearAll} className="text-xs px-3 py-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium">
                  Clear
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            {isImporting && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Importing & categorizing...</span>
                  <span>{importProgress.done}/{importProgress.total}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}
                  />
                </div>
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

          {/* File List */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center">
              <Smartphone size={15} className="text-indigo-500 mr-2" />
              <h3 className="font-semibold text-sm text-gray-700">Found on Device</h3>
            </div>

            <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
              {discoveredFiles.map((entry, idx) => (
                <div
                  key={`${entry.name}-${entry.size}`}
                  className={`flex items-center px-4 py-3 transition-colors
                    ${entry.status === 'done' ? 'bg-emerald-50/30' : entry.status === 'exists' ? 'bg-gray-50 opacity-50' : entry.selected ? 'bg-indigo-50/30' : 'hover:bg-gray-50'}
                  `}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelect(idx)}
                    disabled={entry.status === 'done' || entry.status === 'exists' || isImporting}
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center mr-3 shrink-0 transition-all
                      ${entry.status === 'done'
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : entry.status === 'exists'
                          ? 'bg-gray-200 border-gray-200 text-gray-400'
                          : entry.selected
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-gray-300 hover:border-indigo-400'
                      }
                    `}
                  >
                    {(entry.selected || entry.status === 'done' || entry.status === 'exists') && <Check size={14} />}
                  </button>

                  {/* File icon */}
                  <div className={`p-1.5 rounded-lg mr-3 shrink-0 ${entry.status === 'processing' ? 'bg-indigo-100 text-indigo-600' : 'bg-red-50 text-red-400'}`}>
                    {entry.status === 'processing' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1 mr-2">
                    <p className="text-sm font-medium text-gray-800 truncate">{entry.name}</p>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="text-xs text-gray-400">{formatSize(entry.size)}</span>
                      {entry.category && (
                        <span className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full font-bold inline-flex items-center">
                          <Sparkles size={9} className="mr-1" />
                          {entry.category}
                        </span>
                      )}
                      {entry.status === 'exists' && (
                        <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">Already imported</span>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="shrink-0 text-xs font-medium w-20 text-right">
                    {!entry.status && entry.selected && <span className="text-indigo-500">Ready</span>}
                    {!entry.status && !entry.selected && <span className="text-gray-300">Skipped</span>}
                    {entry.status === 'processing' && <span className="text-indigo-600">Processing</span>}
                    {entry.status === 'done' && <span className="text-emerald-600 flex items-center justify-end"><CheckCircle size={12} className="mr-1" />Done</span>}
                    {entry.status === 'error' && <span className="text-red-500">Failed</span>}
                    {entry.status === 'exists' && <span className="text-gray-400">Exists</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bulk Import Button */}
          {!allDone && selectedCount > 0 && (
            <button
              onClick={handleBulkImport}
              disabled={isImporting}
              className={`w-full py-4 rounded-2xl text-white font-semibold flex items-center justify-center transition-all shadow-md text-base
                ${isImporting
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg active:scale-[0.99]'
                }
              `}
            >
              {isImporting ? (
                <><Loader2 size={20} className="animate-spin mr-2" /> Categorizing {importProgress.done + 1} of {importProgress.total}...</>
              ) : (
                <><Upload size={20} className="mr-2" /> Bulk Import {selectedCount} PDF{selectedCount !== 1 ? 's' : ''} with AI Categorization</>
              )}
            </button>
          )}

          {/* Category Breakdown (after import) */}
          {Object.keys(categoryMap).length > 0 && (
            <div className="bg-gradient-to-br from-purple-50 via-white to-indigo-50 rounded-2xl border border-purple-100 p-5 animate-in fade-in">
              <div className="flex items-center space-x-2 mb-4">
                <Sparkles size={16} className="text-purple-500" />
                <h4 className="text-sm font-bold text-purple-700 uppercase tracking-wider">AI Categorization Results</h4>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(categoryMap).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                  <div key={cat} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center space-x-3 shadow-sm">
                    <div className="p-2 bg-indigo-50 rounded-lg">
                      <Tag size={14} className="text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{cat}</p>
                      <p className="text-xs text-gray-400">{count} file{count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Done */}
          {allDone && discoveredFiles.filter(f => f.status !== 'exists').length > 0 && (
            <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 text-center animate-in fade-in">
              <CheckCircle size={32} className="text-emerald-500 mx-auto mb-3" />
              <p className="text-emerald-700 font-semibold text-lg">All {doneCount} PDFs imported & categorized!</p>
              <p className="text-emerald-600 text-sm mt-1">Documents are available on your Dashboard with AI-assigned categories.</p>
            </div>
          )}
        </div>
      )}

      <p className="text-center text-xs text-gray-400 mt-8">
        Files are scanned via your device's file browser. AI categorization is powered by Gemini.
      </p>
    </div>
  )
}

export default DeviceScanPage
