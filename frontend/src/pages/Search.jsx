import React from 'react'
import ChatBox from '../components/ChatBox'
import { Sparkles } from 'lucide-react'

const SearchPage = () => {
  return (
    <div className="animate-in fade-in duration-500 h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] flex flex-col w-full max-w-5xl mx-auto">
      <header className="mb-6 flex-shrink-0 text-center md:text-left">
        <div className="inline-flex md:hidden items-center justify-center space-x-1.5 px-3 py-1 bg-blue-50 text-primary font-semibold text-xs rounded-full mb-3">
          <Sparkles size={12} />
          <span>Semantic Search</span>
        </div>
        <div className="flex items-center justify-center md:justify-start space-x-3">
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">Ask Document</h2>
          <div className="hidden md:flex items-center space-x-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-xs rounded-full shadow-sm">
            <Sparkles size={12} className="text-indigo-500" />
            <span>AI Powered</span>
          </div>
        </div>
        <p className="text-gray-500 mt-2">Chat with your uploaded documents using natural language. We'll find the exact text chunks.</p>
      </header>

      <div className="flex-1 overflow-hidden bg-white border border-gray-100 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col mb-4 md:mb-0 relative">
        <ChatBox />
      </div>
    </div>
  )
}

export default SearchPage
