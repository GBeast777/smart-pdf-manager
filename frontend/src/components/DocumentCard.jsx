import React, { useState, useCallback } from 'react'
import { Calendar, Trash2, FileText, Edit2 } from 'lucide-react'
import { getDocumentBlob } from '../lib/db'

const DocumentCard = ({ doc, onDelete, onRename, onSelect, selected }) => {
  const [blobUrl, setBlobUrl] = useState(null)

  const handleViewPdf = useCallback(async (e) => {
    e.preventDefault()
    try {
      const blob = await getDocumentBlob(doc.id)
      if (blob) {
        const url = URL.createObjectURL(blob)
        setBlobUrl(url)
        window.open(url, '_blank')
      } else {
        alert('PDF blob not found in local storage.')
      }
    } catch (err) {
      console.error('Error opening PDF:', err)
      alert('Could not open PDF.')
    }
  }, [doc.id])

  return (
    <div className={`bg-white border text-left p-4 rounded-2xl shadow-sm hover:shadow-md transition-all group relative tap-highlight
      ${selected ? 'border-primary ring-2 ring-primary bg-primary/5' : 'border-gray-100'}
    `}>
      <div className="flex items-start gap-3">
        {/* Checkbox — 44px touch target */}
        {onSelect && (
          <label className="flex items-center justify-center w-11 h-11 shrink-0 cursor-pointer -ml-1">
            <input
              type="checkbox"
              checked={selected || false}
              onChange={() => onSelect(doc.id)}
              className="w-5 h-5 text-primary rounded focus:ring-primary cursor-pointer min-h-auto min-w-auto"
            />
          </label>
        )}

        {/* PDF icon — 44px touch target */}
        <a
          href="#"
          onClick={handleViewPdf}
          className="p-2.5 bg-red-50 text-red-500 rounded-xl shrink-0 hover:bg-red-100 transition-colors cursor-pointer flex items-center justify-center"
        >
          <FileText size={20} />
        </a>

        {/* Text content */}
        <div className="min-w-0 flex-1">
          <a
            href="#"
            onClick={handleViewPdf}
            className="font-semibold text-gray-800 truncate block hover:text-primary transition-colors cursor-pointer text-sm sm:text-base"
            title={doc.fileName}
          >
            {doc.fileName}
          </a>
          <div className="flex flex-wrap items-center mt-1 text-xs text-gray-500 gap-x-2 gap-y-1">
            <span className="flex items-center whitespace-nowrap">
              <Calendar size={11} className="mr-1" />
              {new Date(doc.uploadDate).toLocaleDateString()}
            </span>
            {doc.fileSize && (
              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium text-[11px] whitespace-nowrap">
                {(doc.fileSize / 1024 / 1024).toFixed(2)} MB
              </span>
            )}
            {doc.tags && (
              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium text-[11px] whitespace-nowrap">
                {doc.tags}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons — 44px touch targets */}
        <div className="flex items-center gap-1 shrink-0">
          {onRename && (
            <button
              onClick={() => onRename(doc.id, doc.fileName)}
              className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Rename"
            >
              <Edit2 size={16} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(doc.id)}
              className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Summary — truncated on mobile */}
      {doc.summary && (
        <p className="mt-3 text-sm text-gray-600 line-clamp-2 leading-relaxed">{doc.summary}</p>
      )}
    </div>
  )
}

export default DocumentCard
