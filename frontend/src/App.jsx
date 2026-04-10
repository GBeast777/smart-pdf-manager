import React from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Home, FolderSearch, FileText, Layers, Smartphone } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import UploadPage from './pages/Upload'
import SearchPage from './pages/Search'
import DocumentsPage from './pages/Documents'
import MergePage from './pages/Merge'
import DeviceScanPage from './pages/DeviceScan'

import FloatingChatbot from './components/FloatingChatbot'

const Navbar = () => {
  const location = useLocation()

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/upload', label: 'Add', icon: FolderSearch },
    { path: '/documents', label: 'Docs', icon: FileText },
    { path: '/merge', label: 'Merge', icon: Layers },
    { path: '/scan', label: 'Scan', icon: Smartphone },
  ]

  return (
    <nav className="
      fixed bottom-0 left-0 w-full bg-white border-t border-gray-200
      shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50 safe-bottom
      md:sticky md:top-0 md:bg-darker md:text-white md:border-b md:border-t-0
      md:h-screen md:w-56 lg:w-64 md:shrink-0 md:shadow-none
      transition-colors
    ">
      {/* ─── Mobile Bottom Bar ─── */}
      <div className="md:hidden flex justify-around items-center h-16 px-1">
        {navItems.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={`flex flex-col items-center justify-center flex-1 py-2 rounded-xl transition-all tap-highlight
              ${location.pathname === path ? 'text-primary' : 'text-gray-400 active:text-gray-600'}
            `}
          >
            <Icon size={20} strokeWidth={location.pathname === path ? 2.5 : 1.8} />
            <span className={`text-[10px] mt-0.5 leading-tight ${location.pathname === path ? 'font-bold' : 'font-medium'}`}>{label}</span>
          </Link>
        ))}
      </div>

      {/* ─── Desktop Sidebar ─── */}
      <div className="hidden md:flex flex-col h-full items-start px-4 lg:px-6 pt-8 font-sans">
        <h1 className="text-xl lg:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400 mb-10 w-full text-center">
          AI PDF Manager
        </h1>
        <div className="w-full space-y-2">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center space-x-3 w-full px-4 py-3 rounded-xl transition-all
                ${location.pathname === path ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
              `}
            >
              <Icon size={20} />
              <span className="text-sm">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col md:flex-row min-h-screen bg-light">
        <Navbar />
        <main className="flex-1 pb-20 md:pb-0 px-4 py-5 md:p-6 lg:p-8 overflow-y-auto w-full max-w-5xl mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/merge" element={<MergePage />} />
            <Route path="/scan" element={<DeviceScanPage />} />
          </Routes>
          <FloatingChatbot />
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
