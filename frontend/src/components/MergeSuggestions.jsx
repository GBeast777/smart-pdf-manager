import React, { useState } from 'react'
import axios from 'axios'
import { FileUp, Link as LinkIcon, AlertCircle, Layers, FileText, HardDrive, Loader2 } from 'lucide-react'
import { getDocumentBlob, addDocument, addChunks } from '../lib/db'

const MergeSuggestions = ({ suggestions, onMergeComplete }) => {
  const [merging, setMerging] = useState(null)
  const [success, setSuccess] = useState(null)

  // Post-merge preview state
  const [preview, setPreview] = useState(null) // { idx, blob, pageCount, fileSize, name1, name2 }
  const [previewName, setPreviewName] = useState('Merged_Document.pdf')
  const [isSaving, setIsSaving] = useState(false)

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  // Step 1: Merge on backend, show preview
  const handleMerge = async (doc1Id, doc2Id, idx, name1, name2) => {
    setMerging(idx)
    try {
      const blob1 = await getDocumentBlob(doc1Id)
      const blob2 = await getDocumentBlob(doc2Id)

      if (!blob1 || !blob2) {
        alert("Could not read one of the PDFs from local storage.")
        setMerging(null)
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

      setPreview({ idx, blob: mergedBlob, pageCount: page_count, fileSize: file_size, name1, name2 })
      setPreviewName('Merged_Document.pdf')
    } catch (error) {
      console.error("Merge error", error)
      alert("Failed to merge. " + (error.response?.data?.detail || error.message))
    } finally {
      setMerging(null)
    }
  }

  // Step 2: Confirm & Save
  const handleConfirmSave = async () => {
    if (!preview || !previewName.trim()) {
      alert("Please enter a valid file name.")
      return
    }

    setIsSaving(true)
    try {
      let finalName = previewName.trim()
      if (!finalName.endsWith('.pdf')) finalName += '.pdf'

      const processForm = new FormData()
      processForm.append('file', preview.blob, finalName)

      const processRes = await axios.post(`http://${window.location.hostname}:8000/process`, processForm, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const { summary, category, chunks } = processRes.data

      const docId = await addDocument({
        fileName: finalName,
        fileSize: preview.blob.size,
        tags: 'Merged',
        summary: summary || `Merged from ${preview.name1} and ${preview.name2}`,
        pdfBlob: preview.blob,
      })

      if (chunks && chunks.length > 0) {
        await addChunks(docId, chunks)
      }

      setSuccess(preview.idx)
      setPreview(null)
      onMergeComplete && onMergeComplete()
    } catch (error) {
      console.error("Save error", error)
      alert("Failed to save: " + (error.response?.data?.detail || error.message))
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelPreview = () => {
    setPreview(null)
    setPreviewName('Merged_Document.pdf')
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suggestions.map((s, idx) => {
          const isSuccess = success === idx
          const isMerging_ = merging === idx

          return (
            <div key={idx} className={`bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 p-5 rounded-2xl flex flex-col justify-between transition-all ${isSuccess ? 'opacity-50 pointer-events-none' : ''}`}>
              <div>
                <div className="flex items-center text-indigo-600 mb-3 space-x-2 font-medium bg-indigo-100/50 w-fit px-3 py-1 rounded-full text-xs">
                  <AlertCircle size={14} />
                  <span>{(s.similarity * 100).toFixed(0)}% Match</span>
                </div>
                <p className="text-sm font-medium text-gray-800 bg-white px-3 py-2 rounded-lg border border-gray-100 mb-2 truncate" title={s.doc1.file_name}>{s.doc1.file_name}</p>
                <div className="flex justify-center -my-3 z-10 relative">
                  <div className="bg-indigo-100 text-indigo-500 p-1.5 rounded-full border-2 border-white">
                    <LinkIcon size={14} />
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-800 bg-white px-3 py-2 rounded-lg border border-gray-100 mt-2 truncate" title={s.doc2.file_name}>{s.doc2.file_name}</p>
              </div>

              <button
                onClick={() => handleMerge(s.doc1.id, s.doc2.id, idx, s.doc1.file_name, s.doc2.file_name)}
                disabled={isMerging_ || isSuccess}
                className={`mt-5 w-full py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center justify-center
                  ${isSuccess ? 'bg-green-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}
                `}
              >
                {isSuccess ? 'Merged Successfully' : isMerging_ ? (<><Loader2 size={14} className="animate-spin mr-2" /> Merging...</>) : 'Merge Documents'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Post-Merge Preview Modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-in zoom-in-95 duration-200">
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
                <span className="text-sm font-bold text-gray-900">{preview.pageCount} pages</span>
              </div>
              <div className="border-t border-gray-200"></div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center"><HardDrive size={15} className="mr-2 text-indigo-400" /> File Size</span>
                <span className="text-sm font-bold text-gray-900">{formatFileSize(preview.fileSize)}</span>
              </div>
            </div>

            {/* Rename Input */}
            <label className="block text-sm font-semibold text-gray-700 mb-2">Document Name</label>
            <input
              type="text"
              value={previewName}
              onChange={(e) => setPreviewName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-6 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              placeholder="e.g. Q3_Finance_Report.pdf"
            />

            {/* Action Buttons */}
            <div className="flex space-x-3 justify-end">
              <button
                onClick={handleCancelPreview}
                disabled={isSaving}
                className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={isSaving || !previewName.trim()}
                className="px-5 py-2.5 flex items-center bg-indigo-600 text-white font-semibold hover:bg-indigo-700 rounded-xl disabled:opacity-50 transition-colors shadow-sm"
              >
                {isSaving ? (<><Loader2 size={16} className="animate-spin mr-2" /> Saving...</>) : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default MergeSuggestions
