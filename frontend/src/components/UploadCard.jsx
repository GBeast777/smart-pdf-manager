import React, { useCallback, useState } from 'react'
import { UploadCloud, CheckCircle, FileText, X } from 'lucide-react'
import axios from 'axios'

const UploadCard = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  // Drag & drop handlers
  const onDragOver = useCallback((e) => {
    e.preventDefault()
    setDragging(true)
  }, [])
  const onDragLeave = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
  }, [])
  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile.type === 'application/pdf') {
        setFile(droppedFile)
      } else {
        alert("Only PDF files are supported.")
      }
    }
  }, [])

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile)
      } else {
        alert("Only PDF files are supported.")
      }
    }
  }

  const handleUpload = async () => {
    if (!file) return
    
    setUploading(true)
    setProgress(10)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await axios.post(`http://${window.location.hostname}:8000/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setProgress(percentCompleted)
        }
      })
      setProgress(100)
      setTimeout(() => {
        onUploadSuccess && onUploadSuccess(res.data.document)
        setFile(null)
        setUploading(false)
        setProgress(0)
      }, 800)
    } catch (error) {
      console.error(error)
      alert("Failed to upload document. Is the backend running?")
      setUploading(false)
      setProgress(0)
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <div 
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-3xl p-8 md:p-12 text-center transition-all ${dragging ? 'border-primary bg-blue-50/50 scale-[1.02]' : 'border-gray-300 bg-white hover:border-blue-300'}`}
      >
        {!file ? (
          <div className="flex flex-col items-center justify-center space-y-5">
            <div className={`p-5 rounded-full ${dragging ? 'bg-primary text-white shadow-lg' : 'bg-blue-50 text-primary'}`}>
              <UploadCloud size={36} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-800">Select or Drag & Drop File</p>
              <p className="text-sm text-gray-500 mt-2 font-medium">Supported format: PDF</p>
            </div>
            <label className="mt-6 px-10 py-3.5 bg-primary text-white font-semibold rounded-xl hover:bg-blue-600 cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all text-sm block">
              Browse Files
              <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
            </label>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="p-4 bg-green-50 text-green-500 rounded-full animate-in zoom-in duration-300">
              <CheckCircle size={36} />
            </div>
            
            <div className="w-full bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-4 truncate">
                <FileText className="text-primary shrink-0" size={28} />
                <div className="text-left truncate">
                  <p className="font-semibold text-gray-900 text-sm truncate max-w-[200px] md:max-w-xs" title={file.name}>{file.name}</p>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              {!uploading && (
                <button onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500 transition-colors p-2 bg-white rounded-full shadow-sm hover:shadow">
                  <X size={16} />
                </button>
              )}
            </div>
            
            <button 
              onClick={handleUpload} 
              disabled={uploading}
              className={`w-full py-4 rounded-xl font-bold text-sm shadow-sm transition-all
                ${uploading 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-darker text-white hover:bg-black hover:shadow-lg focus:ring-4 focus:ring-gray-200'
                }`}
            >
              {uploading ? "Analyzing Document..." : "Upload & Analyze"}
            </button>
            
            {uploading && (
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-gradient-to-r from-blue-400 to-primary rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default UploadCard
