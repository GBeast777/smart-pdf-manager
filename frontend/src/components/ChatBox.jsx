import React, { useState, useRef, useEffect } from 'react'
import { Send, FileText, User, Bot, Loader2 } from 'lucide-react'
import axios from 'axios'

const ChatBox = () => {
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState([
    { role: 'ai', content: "Hi there! I'm your AI PDF Assistant. I've read all your documents. What would you like to know?" },
  ])
  const [searching, setSearching] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return

    const userMsg = query
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setQuery('')
    setSearching(true)

    try {
      const res = await axios.post(`http://${window.location.hostname}:8000/search`, { query: userMsg })
      const results = res.data.results
      
      let aiContent = "I couldn't find any relevant information in your documents."
      if (results && results.length > 0) {
        aiContent = "Here are the most relevant sections I found:"
      }

      setMessages(prev => [...prev, { role: 'ai', content: aiContent, results: results || [] }])
    } catch (error) {
      console.error(error)
      setMessages(prev => [...prev, { role: 'ai', content: "An error occurred while searching. Please try again or verify the backend is running." }])
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50/50 rounded-2xl relative">
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex space-x-3 max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
              
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1
                ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-primary text-white shadow-md'}
              `}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={18} />}
              </div>
              
              <div className="space-y-3 flex-1">
                <div className={`px-5 py-3.5 rounded-2xl shadow-sm text-sm leading-relaxed
                  ${msg.role === 'user' ? 'bg-indigo-600 text-white border-0 shadow-indigo-100 rounded-tr-none' : 'bg-white border-none shadow-md text-gray-800 rounded-tl-none border border-gray-100/50'}
                `}>
                  {msg.content}
                </div>
                
                {/* Search Results / Evidence Cards */}
                {msg.results && msg.results.length > 0 && (
                  <div className="space-y-2.5 mt-4 animate-in fade-in duration-500 max-w-lg">
                    {msg.results.map((r, i) => (
                      <div key={i} className="bg-white border border-indigo-50 rounded-2xl p-4 text-sm flex space-x-3 shadow-[0_2px_8px_rgb(0,0,0,0.04)] hover:shadow-md transition-shadow cursor-pointer">
                        <div className="mt-0.5 text-indigo-500 shrink-0 bg-indigo-50 p-2 rounded-xl">
                          <FileText size={18} />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 mb-1.5 flex items-center justify-between">
                            {r.document_name}
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 ml-2">
                              {r.tags || 'Match'} ({(r.score * 100).toFixed(0)}%)
                            </span>
                          </p>
                          <p className="text-gray-600 italic text-[13px] leading-relaxed line-clamp-3 bg-gray-50 p-3 rounded-xl border border-gray-100">"{r.chunk_text}"</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
            </div>
          </div>
        ))}
        {searching && (
          <div className="flex justify-start">
            <div className="flex space-x-3 items-center">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0 shadow-md">
                <Loader2 size={16} className="animate-spin" />
              </div>
              <div className="px-4 py-3 bg-white shadow-md rounded-2xl rounded-tl-none text-gray-500 text-sm flex space-x-1">
                <span className="animate-bounce delay-75">•</span>
                <span className="animate-bounce delay-150">•</span>
                <span className="animate-bounce delay-300">•</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      <div className="p-4 bg-white border-t border-gray-100 rounded-b-2xl absolute bottom-0 w-full left-0 z-10">
        <form onSubmit={handleSearch} className="relative flex items-center w-full">
          <input
            type="text"
            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-full focus:ring-primary focus:border-primary block p-4 pr-14 shadow-inner"
            placeholder="Search documents using natural language..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={searching}
          />
          <button 
            type="submit" 
            disabled={!query.trim() || searching}
            className="absolute right-2 text-white bg-primary disabled:bg-indigo-300 disabled:cursor-not-allowed hover:bg-blue-600 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-full text-sm p-2.5 text-center inline-flex items-center transition-colors items-center justify-center"
          >
            <Send size={18} className="translate-x-[1px]" />
          </button>
        </form>
      </div>
    </div>
  )
}

export default ChatBox
