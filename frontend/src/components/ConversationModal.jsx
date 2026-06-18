import { useState, useRef, useEffect } from 'react'
import { useLang } from '../i18n/LangContext'

export default function ConversationModal({ word, wordId, token, apiBase, onClose }) {
  const { t } = useLang()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading])

  const post = async (history) => {
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/words/${wordId}/conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: history }),
      })
      if (!res.ok) throw new Error()
      const d = await res.json()
      setMessages([...history, { role: 'assistant', content: d.reply }])
    } catch {
      setMessages([...history, { role: 'assistant', content: t.convError }])
    } finally {
      setLoading(false)
    }
  }

  // Open with the AI scenario
  useEffect(() => { post([]) }, [])  // eslint-disable-line

  const send = () => {
    const text = input.trim()
    if (!text || loading) return
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    post(next)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-3xl border border-white/10 shadow-2xl w-full max-w-md h-[560px] max-h-[88vh] flex flex-col p-0 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/8 shrink-0">
          <div>
            <h2 className="text-sm font-semibold grad-text leading-tight">{t.convTitle}</h2>
            <p className="text-[11px] text-white/35">{word}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 p-1" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                m.role === 'user'
                  ? 'bg-gradient-to-br from-violet-600/80 to-sky-600/80 text-white rounded-br-md'
                  : 'glass border-white/8 text-white/85 rounded-bl-md'
              }`}>{
                m.role === 'user'
                  ? m.content
                  : (m.content || '').split(/\*\*(.*?)\*\*/g).map((p, j) =>
                      j % 2 === 1 ? <strong key={j} className="font-bold text-violet-200">{p}</strong> : <span key={j}>{p}</span>
                    )
              }</div>
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

        <div className="border-t border-white/8 p-3 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              rows={1}
              placeholder={t.convPlaceholder}
              maxLength={500}
              className="flex-1 resize-none bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/90 placeholder-white/30 focus:outline-none focus:border-violet-400/50 max-h-24"
            />
            <button onClick={send} disabled={!input.trim() || loading}
              className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center text-white disabled:opacity-30 hover:opacity-90 transition-opacity">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
