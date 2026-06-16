import { useState, useRef, useEffect } from 'react'

export default function FloatingChatWidget({ apiBase, token }) {
  const [open, setOpen]       = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)
  const inputRef  = useRef(null)

  // Auto-scroll to the latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  // Focus input when the drawer opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: next }),
      })

      if (!res.ok) {
        let msg = 'Something went wrong. Please try again.'
        try {
          const data = await res.json()
          const detail = data.detail || {}
          if (detail.error_code === 'ai_service_limited') {
            msg = '⚠️ AI service is temporarily unavailable. Please try again later.'
          }
        } catch { /* keep default */ }
        setMessages([...next, { role: 'assistant', content: msg }])
        return
      }

      const data = await res.json()
      setMessages([...next, { role: 'assistant', content: data.reply }])
    } catch {
      setMessages([...next, {
        role: 'assistant',
        content: '❌ Network error. Please check your connection and try again.',
      }])
    } finally {
      setLoading(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* Chat drawer */}
      {open && (
        <div
          className="fixed bottom-24 right-4 sm:right-6 z-50 flex flex-col
                     w-[calc(100vw-2rem)] sm:w-[380px] h-[500px] max-h-[calc(100vh-8rem)]
                     glass rounded-2xl border border-white/10 shadow-2xl shadow-black/50
                     overflow-hidden animate-[fadeIn_0.15s_ease-out]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-sky-500
                              flex items-center justify-center text-sm">🤖</div>
              <div>
                <h3 className="text-sm font-semibold grad-text leading-tight">Lexify Assistant</h3>
                <p className="text-[10px] text-white/35 leading-tight">AI language tutor</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/40 hover:text-white/80 transition-colors p-1"
              aria-label="Close chat"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="text-3xl mb-3">💬</div>
                <p className="text-white/50 text-sm font-medium mb-1">Ask me anything about languages</p>
                <p className="text-white/30 text-xs leading-relaxed">
                  Word meanings, grammar, pronunciation, translations, example sentences…
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    m.role === 'user'
                      ? 'bg-gradient-to-br from-violet-600/80 to-sky-600/80 text-white rounded-br-md'
                      : 'glass border-white/8 text-white/85 rounded-bl-md'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="glass border-white/8 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-white/8 p-3 shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Type a message…"
                maxLength={1000}
                className="flex-1 resize-none bg-white/5 border border-white/10 rounded-xl
                           px-3 py-2 text-sm text-white/90 placeholder-white/30
                           focus:outline-none focus:border-violet-400/50 focus:bg-white/8
                           max-h-24 transition-colors"
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-sky-500
                           flex items-center justify-center text-white
                           disabled:opacity-30 disabled:cursor-not-allowed
                           hover:opacity-90 transition-opacity"
                aria-label="Send message"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating action button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-4 sm:right-6 z-50 w-14 h-14 rounded-full
                   bg-gradient-to-br from-violet-500 to-sky-500 shadow-lg shadow-violet-500/30
                   flex items-center justify-center text-white
                   hover:scale-105 active:scale-95 transition-transform"
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>
    </>
  )
}
