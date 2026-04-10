import React, { useState, useRef, useEffect } from 'react'
import { MessageSquare, X, Send, Bot, User, FileText, Trash2 } from 'lucide-react'
import axios from 'axios'
import { searchChunksLocally, addChatMessage, getChatHistory, clearChatHistory } from '../lib/db'

const FloatingChatbot = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const messagesEndRef = useRef(null)

  const WELCOME_MSG = {
    role: 'ai',
    content: "Hi! I'm your AI PDF Assistant. I use RAG to find answers directly from your locally stored documents using Gemini. What do you want to know?"
  }

  // Load chat history from IndexedDB on first open
  useEffect(() => {
    if (isOpen && !historyLoaded) {
      ;(async () => {
        try {
          const history = await getChatHistory()
          if (history.length > 0) {
            setMessages(history.map(h => ({
              role: h.role,
              content: h.content,
              evidence: h.evidence,
            })))
          } else {
            setMessages([WELCOME_MSG])
          }
        } catch (err) {
          console.error('Failed to load chat history:', err)
          setMessages([WELCOME_MSG])
        }
        setHistoryLoaded(true)
      })()
    }
  }, [isOpen, historyLoaded])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  const handleClearHistory = async () => {
    if (window.confirm('Clear all chat history?')) {
      await clearChatHistory()
      setMessages([WELCOME_MSG])
    }
  }

  const handleSend = async () => {
    if (!query.trim() || loading) return

    const userMsg = query
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setQuery('')
    setLoading(true)

    try {
      // 1. Get query embedding from backend
      const embedRes = await axios.post(`http://${window.location.hostname}:8000/embed-query`, { text: userMsg })
      const queryEmbedding = embedRes.data.embedding

      // 2. Local cosine similarity search in IndexedDB
      const localResults = await searchChunksLocally(queryEmbedding, 5)

      // 3. Build context chunks for the backend
      const contextChunks = localResults.map(r =>
        `Source: ${r.documentName}\nText: ${r.chunkText}`
      )

      // 4. Send to Gemini via backend
      const chatRes = await axios.post(`http://${window.location.hostname}:8000/chat`, {
        query: userMsg,
        context_chunks: contextChunks,
      })

      const aiResponse = {
        role: 'ai',
        content: chatRes.data.answer,
        evidence: localResults.map(r => ({
          document_name: r.documentName,
          chunk_text: r.chunkText,
          score: r.score,
          tags: r.tags,
        })),
      }

      setMessages(prev => [...prev, aiResponse])

      // 5. Persist to IndexedDB
      await addChatMessage({ role: 'user', content: userMsg })
      await addChatMessage(aiResponse)

    } catch (error) {
      const errMsg = {
        role: 'ai',
        content: error.response?.data?.detail || "Sorry, an error occurred. Make sure your Gemini API key is configured!",
      }
      setMessages(prev => [...prev, errMsg])
      await addChatMessage({ role: 'user', content: userMsg })
      await addChatMessage(errMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 md:bottom-8 right-6 z-50 p-4 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 hover:scale-105 transition-all focus:outline-none focus:ring-4 focus:ring-indigo-300"
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-36 md:bottom-24 right-4 md:right-8 z-50 w-[90%] md:w-[450px] h-[600px] max-h-[75vh] bg-gray-50 border border-gray-200 shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-indigo-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot size={20} />
              <h3 className="font-semibold">AI Assistant</h3>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={handleClearHistory} className="text-indigo-200 hover:text-white transition-colors" title="Clear chat history">
                <Trash2 size={16} />
              </button>
              <button onClick={() => setIsOpen(false)} className="text-indigo-200 hover:text-white">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[85%] space-x-2 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>

                  <div className={`mt-1 shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'}`}>
                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>

                  <div className="flex flex-col">
                    <div className={`p-3.5 rounded-2xl text-[14px] leading-relaxed shadow-sm
                      ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'}
                    `}>
                      {msg.content}
                    </div>

                    {msg.evidence && msg.evidence.length > 0 && (
                      <div className="mt-2 space-y-2">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Sources:</span>
                        {msg.evidence.map((ev, i) => (
                          <div key={i} className="bg-white border border-indigo-50 p-2.5 rounded-xl shadow-sm text-xs">
                            <div className="flex items-center justify-between text-indigo-600 font-semibold mb-1 w-full">
                              <div className="flex items-center min-w-0">
                                <FileText size={14} className="mr-1.5 shrink-0" />
                                <span className="truncate">{ev.document_name}</span>
                              </div>
                              <span className="ml-2 shrink-0 bg-indigo-50 text-indigo-700 text-[10px] px-2 py-0.5 rounded font-bold">
                                {(ev.score * 100).toFixed(0)}% Match
                              </span>
                            </div>
                            <p className="text-gray-500 italic line-clamp-2">"{ev.chunk_text}"</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 p-4 rounded-2xl rounded-tl-none shadow-sm flex space-x-2 items-center">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-gray-100">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-400 transition-all"
            >
              <input
                type="text"
                placeholder="Ask about your documents..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-2 py-1.5 outline-none"
              />
              <button
                type="submit"
                disabled={!query.trim() || loading}
                className="p-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50 disabled:bg-gray-400 hover:bg-indigo-700 transition-colors"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default FloatingChatbot
