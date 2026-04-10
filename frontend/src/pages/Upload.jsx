import React, { useState, useRef, useCallback } from 'react'
import {
  FolderSearch, File, CheckCircle, AlertCircle, Loader2,
  FolderOpen, X, Upload as UploadIcon, FilePlus, FolderPlus,
  Smartphone, Search, Sparkles, Tag, Check
} from 'lucide-react'
import axios from 'axios'
import { addDocument, addChunks, getAllDocuments } from '../lib/db'

const UploadPage = () => {
  // Shared file state — used by both desktop & mobile views
  const [files, setFiles] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [error, setError] = useState(null)

  // Desktop-only states
  const [isDragging, setIsDragging] = useState(false)

  // Mobile-only states
  const [mobileSelected, setMobileSelected] = useState({}) // { idx: boolean }

  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)
  const mobileScanRef = useRef(null)

  // ─── Helpers ────────────────────────────────────────────────────────

  const formatSize = (bytes) => {
    if (!bytes) return '0 B'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  const dedupeFiles = (existing, incoming) => {
    const keyOf = (e) => `${e.relativePath || e.file.name}|${e.file.size}`
    const existingKeys = new Set(existing.map(keyOf))
    return [...existing, ...incoming.filter(e => !existingKeys.has(keyOf(e)))]
  }

  const extractFolderTag = (relativePath) => {
    const parts = relativePath.split('/')
    return parts.length > 1 ? parts[0] : null
  }

  // ─── Desktop: File / Folder Input Handlers ─────────────────────────

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files || [])
    const pdfs = selected.filter(f => f.name.toLowerCase().endsWith('.pdf'))
    if (pdfs.length === 0) { setError('No PDF files found.'); return }

    const entries = pdfs.map(f => ({
      file: f,
      relativePath: f.name,
      folderTag: null,
    }))
    setFiles(prev => dedupeFiles(prev, entries))
    setError(null)
    e.target.value = ''
  }

  const handleFolderSelect = (e) => {
    const selected = Array.from(e.target.files || [])
    const pdfs = selected.filter(f => f.name.toLowerCase().endsWith('.pdf'))
    if (pdfs.length === 0) { setError('No PDF files found in folder.'); return }

    const entries = pdfs.map(f => {
      const relPath = f.webkitRelativePath || f.name
      return { file: f, relativePath: relPath, folderTag: extractFolderTag(relPath) }
    })
    setFiles(prev => dedupeFiles(prev, entries))
    setError(null)
    e.target.value = ''
  }

  // ─── Desktop: Drag & Drop ──────────────────────────────────────────

  const scanDirectoryEntry = (dirEntry, path = '') => {
    return new Promise((resolve) => {
      const reader = dirEntry.createReader()
      const allEntries = []
      const readBatch = () => {
        reader.readEntries((entries) => {
          if (entries.length === 0) { resolve(allEntries); return }
          allEntries.push(...entries)
          readBatch()
        })
      }
      readBatch()
    }).then(async (entries) => {
      const results = []
      for (const entry of entries) {
        const entryPath = path ? `${path}/${entry.name}` : entry.name
        if (entry.isFile && entry.name.toLowerCase().endsWith('.pdf')) {
          const file = await new Promise((res) => entry.file(res))
          results.push({ file, relativePath: entryPath, folderTag: extractFolderTag(entryPath) || (path ? path.split('/')[0] : null) })
        } else if (entry.isDirectory) {
          results.push(...(await scanDirectoryEntry(entry, entryPath)))
        }
      }
      return results
    })
  }

  const handleDragOver = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }, [])
  const handleDragLeave = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false) }, [])
  const handleDrop = useCallback(async (e) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false); setError(null)
    const items = [...e.dataTransfer.items]
    const discovered = []
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.() || item.getAsEntry?.()
      if (entry) {
        if (entry.isFile && entry.name.toLowerCase().endsWith('.pdf')) {
          const file = await new Promise((res) => entry.file(res))
          discovered.push({ file, relativePath: file.name, folderTag: null })
        } else if (entry.isDirectory) {
          discovered.push(...(await scanDirectoryEntry(entry, entry.name)))
        }
      }
    }
    if (discovered.length === 0) { setError('No PDF files found in dropped items.'); return }
    setFiles(prev => dedupeFiles(prev, discovered))
  }, [])

  // ─── Mobile: One-Click Scan ────────────────────────────────────────

  const handleMobileScan = () => {
    mobileScanRef.current?.click()
  }

  const handleMobileFilesSelected = (e) => {
    const selected = Array.from(e.target.files || [])
    const pdfs = selected.filter(f => f.name.toLowerCase().endsWith('.pdf'))
    if (pdfs.length === 0) { setError('No PDF files found.'); return }

    const entries = pdfs.map(f => ({ file: f, relativePath: f.name, folderTag: null }))
    setFiles(prev => dedupeFiles(prev, entries))

    // Auto-select all new files for mobile
    setMobileSelected(prev => {
      const updated = { ...prev }
      entries.forEach((_, i) => { updated[files.length + i] = true })
      return updated
    })

    setError(null)
    e.target.value = ''
  }

  const toggleMobileSelect = (idx) => {
    setMobileSelected(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  // ─── Shared: File Actions ─────────────────────────────────────────

  const handleRemoveFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setMobileSelected(prev => {
      const updated = {}
      Object.entries(prev).forEach(([k, v]) => {
        const idx = parseInt(k)
        if (idx < index) updated[idx] = v
        else if (idx > index) updated[idx - 1] = v
      })
      return updated
    })
  }

  const handleClearAll = () => {
    setFiles([])
    setUploadProgress({})
    setMobileSelected({})
    setError(null)
  }

  // ─── Shared: Upload / Import ───────────────────────────────────────

  const handleUploadAll = async () => {
    if (!files || files.length === 0) return
    setIsProcessing(true)
    setError(null)

    let successCount = 0, failCount = 0

    for (const entry of files) {
      const key = entry.relativePath || entry.file.name
      if (uploadProgress[key] === 'done') continue

      setUploadProgress(prev => ({ ...prev, [key]: 'processing' }))
      try {
        const formData = new FormData()
        formData.append('file', entry.file)

        const res = await axios.post(`http://${window.location.hostname}:8000/process`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })

        const { summary, category, chunks } = res.data
        const tag = entry.folderTag || category

        const docId = await addDocument({
          fileName: entry.file.name,
          fileSize: entry.file.size,
          tags: tag,
          summary,
          pdfBlob: entry.file,
        })

        if (chunks && chunks.length > 0) await addChunks(docId, chunks)

        setUploadProgress(prev => ({ ...prev, [key]: 'done' }))
        successCount++
      } catch (err) {
        console.error(`Failed: ${entry.file.name}:`, err)
        setUploadProgress(prev => ({ ...prev, [key]: 'error' }))
        failCount++
      }
    }

    setIsProcessing(false)
    if (failCount > 0) setError(`${successCount} uploaded, ${failCount} failed.`)
  }

  const allDone = files.length > 0 && Object.values(uploadProgress).filter(s => s === 'done').length === files.length
  const doneCount = Object.values(uploadProgress).filter(s => s === 'done').length
  const totalSize = files.reduce((sum, e) => sum + e.file.size, 0)

  // Category breakdown from processed files
  const categoryMap = {}
  files.forEach((entry) => {
    const key = entry.relativePath || entry.file.name
    if (uploadProgress[key] === 'done' && entry.folderTag) {
      categoryMap[entry.folderTag] = (categoryMap[entry.folderTag] || 0) + 1
    }
  })

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto py-6 animate-in fade-in duration-500">
      {/* Hidden Inputs */}
      <input ref={fileInputRef} type="file" accept=".pdf" multiple onChange={handleFileSelect} className="hidden" />
      <input ref={folderInputRef} type="file" webkitdirectory="" directory="" multiple onChange={handleFolderSelect} className="hidden" />
      <input ref={mobileScanRef} type="file" accept=".pdf,application/pdf" multiple onChange={handleMobileFilesSelected} className="hidden" />

      {/* ═══════════ DESKTOP VIEW (md+) ═══════════ */}
      <div className="hidden md:block">
        {/* Header */}
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Add Documents</h2>
          <p className="text-gray-500">Drop files & folders, pick individual PDFs, or scan an entire directory.</p>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all bg-white relative overflow-hidden
            ${isDragging
              ? 'border-indigo-500 bg-indigo-50/40 scale-[1.01] shadow-lg'
              : files.length > 0
                ? 'border-emerald-300 bg-emerald-50/20'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }
          `}
        >
          <div className="relative z-10 flex flex-col items-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 transition-all duration-300
              ${isDragging ? 'bg-indigo-100 text-indigo-600 scale-110' : files.length > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'}
            `}>
              {isDragging ? <UploadIcon size={36} className="animate-bounce" /> : files.length > 0 ? <FolderOpen size={36} /> : <FolderSearch size={36} />}
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {isDragging ? 'Drop here — files & folders welcome!' : files.length > 0 ? `${files.length} PDF${files.length !== 1 ? 's' : ''} ready` : 'Drag & drop PDFs or folders here'}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {isDragging ? 'All PDF files will be detected automatically' : files.length > 0 ? `${formatSize(totalSize)} total • Ready to upload` : 'Or use the buttons below to browse'}
            </p>

            {!isDragging && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing}
                  className="px-5 py-3 rounded-xl font-semibold text-sm shadow-sm transition-all inline-flex items-center bg-white border-2 border-gray-200 text-gray-700 hover:border-indigo-400 hover:text-indigo-600 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                  <FilePlus size={18} className="mr-2" /> Select Files
                </button>
                <button onClick={() => folderInputRef.current?.click()} disabled={isProcessing}
                  className="px-5 py-3 rounded-xl font-semibold text-sm shadow-sm transition-all inline-flex items-center bg-primary text-white hover:bg-blue-600 hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed">
                  <FolderPlus size={18} className="mr-2" /> Select Folder
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════ MOBILE VIEW (<md) ═══════════ */}
      <div className="md:hidden">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Smartphone size={30} className="text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Add Documents</h2>
          <p className="text-gray-500 text-sm">Scan your device for PDF files</p>
        </div>

        {/* One-Click Scan Button */}
        {files.length === 0 && (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <Search size={36} className="text-indigo-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">One-Click Scan</h3>
            <p className="text-sm text-gray-500 mb-6">Tap to open your device storage and select all your PDFs at once</p>
            <button
              onClick={handleMobileScan}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-semibold text-base shadow-lg hover:shadow-xl active:scale-[0.98] transition-all inline-flex items-center justify-center"
            >
              <FolderOpen size={22} className="mr-2" />
              Scan Device for PDFs
            </button>
          </div>
        )}

        {/* Mobile Scan Again button — shown when files exist */}
        {files.length > 0 && !allDone && (
          <div className="mb-4 flex justify-center">
            <button onClick={handleMobileScan} disabled={isProcessing}
              className="px-5 py-2.5 bg-gray-100 hover:bg-indigo-100 text-gray-700 hover:text-indigo-700 rounded-xl text-sm font-medium transition-colors inline-flex items-center disabled:opacity-50">
              <Search size={15} className="mr-1.5" /> Scan More
            </button>
          </div>
        )}
      </div>

      {/* ═══════════ SHARED: Error ═══════════ */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl flex items-center text-sm font-medium border border-red-100">
          <AlertCircle size={18} className="mr-2 shrink-0" />
          {error}
        </div>
      )}

      {/* ═══════════ SHARED: File List ═══════════ */}
      {files.length > 0 && (
        <div className="mt-6 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-gray-700">
              {/* Mobile: "Found on Device", Desktop: "Detected PDFs" */}
              <span className="hidden md:inline">Detected PDFs</span>
              <span className="md:hidden">Found on Device</span>
              {isProcessing && ` — ${doneCount}/${files.length} processed`}
            </h4>
            {!isProcessing && !allDone && (
              <button onClick={handleClearAll} className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center">
                <X size={14} className="mr-1" /> Clear All
              </button>
            )}
          </div>

          {/* Progress Bar */}
          {isProcessing && (
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(doneCount / files.length) * 100}%` }} />
            </div>
          )}

          {/* File Items */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm max-h-80 overflow-y-auto divide-y divide-gray-50">
            {files.map((entry, idx) => {
              const key = entry.relativePath || entry.file.name
              const status = uploadProgress[key]
              return (
                <div key={`${key}-${idx}`} className={`flex items-center text-sm py-2.5 px-3 transition-colors
                  ${status === 'done' ? 'bg-emerald-50/30' : 'hover:bg-gray-50/70'}
                `}>
                  {/* Mobile checkbox (hidden on desktop) */}
                  <button
                    onClick={() => toggleMobileSelect(idx)}
                    className={`md:hidden w-5 h-5 rounded border-2 flex items-center justify-center mr-2.5 shrink-0 transition-all
                      ${status === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' : mobileSelected[idx] ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300'}
                    `}
                    disabled={isProcessing || status === 'done'}
                  >
                    {(mobileSelected[idx] || status === 'done') && <Check size={12} />}
                  </button>

                  {/* File icon */}
                  <span className="shrink-0 mr-2">
                    {status === 'processing' ? <Loader2 size={14} className="text-indigo-500 animate-spin" /> : <File size={14} className="text-red-400" />}
                  </span>

                  {/* Name */}
                  <span className="truncate text-gray-700 flex-1 min-w-0 mr-2" title={key}>{entry.file.name}</span>

                  {/* Folder tag */}
                  {entry.folderTag && (
                    <span className="hidden sm:inline text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-bold mr-2 shrink-0 uppercase tracking-wider">
                      {entry.folderTag}
                    </span>
                  )}

                  {/* Size */}
                  <span className="text-xs text-gray-400 w-14 text-right shrink-0 mr-2">{formatSize(entry.file.size)}</span>

                  {/* Status */}
                  <span className="font-medium text-xs w-20 text-right shrink-0">
                    {!status && <span className="text-gray-400">Ready</span>}
                    {status === 'processing' && <span className="text-indigo-600">Processing</span>}
                    {status === 'done' && <span className="text-emerald-600 flex items-center justify-end"><CheckCircle size={12} className="mr-1" />Done</span>}
                    {status === 'error' && <span className="text-red-500 flex items-center justify-end"><AlertCircle size={12} className="mr-1" />Failed</span>}
                  </span>

                  {/* Remove (desktop only) */}
                  {!isProcessing && !status && (
                    <button onClick={() => handleRemoveFile(idx)} className="hidden md:block text-gray-300 hover:text-red-400 transition-colors ml-1 shrink-0">
                      <X size={14} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Upload / Bulk Import Button */}
          {!allDone && (
            <button
              onClick={handleUploadAll}
              disabled={isProcessing}
              className={`w-full py-4 rounded-xl text-white font-semibold flex items-center justify-center transition-all shadow-sm text-sm md:text-base
                ${isProcessing ? 'bg-indigo-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 hover:shadow-md active:scale-[0.99]'}
              `}
            >
              <UploadIcon size={18} className="mr-2" />
              {/* Mobile: "Bulk Import", Desktop: "Upload All" */}
              {isProcessing
                ? `Processing ${doneCount + 1} of ${files.length}...`
                : <>
                    <span className="hidden md:inline">Upload All {files.length} PDF{files.length !== 1 ? 's' : ''}</span>
                    <span className="md:hidden">Bulk Import {files.length} PDF{files.length !== 1 ? 's' : ''} with AI</span>
                  </>
              }
            </button>
          )}

          {/* Success */}
          {allDone && (
            <div className="p-5 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
              <CheckCircle size={28} className="text-emerald-500 mx-auto mb-2" />
              <p className="text-emerald-700 font-semibold">All {files.length} documents processed & saved!</p>
              <p className="text-emerald-600 text-sm mt-1">Data stored locally — visible on Dashboard immediately.</p>
            </div>
          )}
        </div>
      )}

      {/* Footer note — differs per view */}
      <p className="text-center text-xs text-gray-400 mt-8">
        <span className="hidden md:inline">PDFs are processed by the backend, then stored locally in your browser. Folder names are preserved as category tags.</span>
        <span className="md:hidden">Files are imported from your device storage. AI categorization is powered by Gemini.</span>
      </p>
    </div>
  )
}

export default UploadPage
