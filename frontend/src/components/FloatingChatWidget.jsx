import { useState, useRef, useEffect } from 'react'
import { useLang } from '../i18n/LangContext'

// Lightweight markdown renderer (bold, inline code, bullet/numbered lists).
// Avoids a heavy dependency while still rendering the tutor's formatting.
function renderInline(text, keyPrefix) {
  const parts = []
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`)/g
  let last = 0, m, i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[2] !== undefined) {
      parts.push(<strong key={`${keyPrefix}-b${i}`} className="text-white font-semibold">{m[2]}</strong>)
    } else if (m[3] !== undefined) {
      parts.push(<code key={`${keyPrefix}-c${i}`} className="bg-white/10 px-1 py-0.5 rounded text-[0.85em]">{m[3]}</code>)
    }
    last = m.index + m[0].length
    i++
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function Markdown({ content }) {
  const lines = content.split('\n')
  const blocks = []
  let list = null  // { ordered, items: [] }

  const flush = () => {
    if (list) {
      const Tag = list.ordered ? 'ol' : 'ul'
      blocks.push(
        <Tag key={`l${blocks.length}`} className={`my-1.5 pl-5 ${list.ordered ? 'list-decimal' : 'list-disc'} space-y-0.5`}>
          {list.items.map((it, j) => <li key={j}>{renderInline(it, `l${blocks.length}-${j}`)}</li>)}
        </Tag>
      )
      list = null
    }
  }

  lines.forEach((line, idx) => {
    const ul = line.match(/^\s*[-*]\s+(.+)$/)
    const ol = line.match(/^\s*\d+\.\s+(.+)$/)
    if (ul) {
      if (!list || list.ordered) { flush(); list = { ordered: false, items: [] } }
      list.items.push(ul[1])
    } else if (ol) {
      if (!list || !list.ordered) { flush(); list = { ordered: true, items: [] } }
      list.items.push(ol[1])
    } else {
      flush()
      if (line.trim()) {
        blocks.push(<p key={`p${idx}`} className="my-1">{renderInline(line, `p${idx}`)}</p>)
      }
    }
  })
  flush()
  return <>{blocks}</>
}

export default function FloatingChatWidget({ apiBase, token }) {
  const { lang, t } = useLang()
  const WELCOME = { role: 'assistant', content: t.chatWelcome }
  const [open, setOpen]       = useState(false)
  const [messages, setMessages] = useState([WELCOME])
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

  // When the site language changes: keep the history, append a localized
  // info notice, and let new replies use the new language.
  const langRef = useRef(lang)
  useEffect(() => {
    if (langRef.current !== lang) {
      langRef.current = lang
      setMessages(prev => [...prev, { role: 'info', content: t.chatLangChanged }])
    }
  }, [lang, t])

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
        body: JSON.stringify({ messages: next, lang }),
      })

      if (!res.ok) {
        let msg = t.chatErrGeneric
        try {
          const data = await res.json()
          const detail = data.detail || {}
          if (detail.error_code === 'ai_service_limited') msg = t.chatErrAI
        } catch { /* keep default */ }
        setMessages([...next, { role: 'assistant', content: msg }])
        return
      }

      const data = await res.json()
      setMessages([...next, { role: 'assistant', content: data.reply }])
    } catch {
      setMessages([...next, { role: 'assistant', content: t.chatErrNetwork }])
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
          className="fixed z-50 flex flex-col glass border border-white/10 shadow-2xl shadow-black/50 overflow-hidden
                     animate-[fadeIn_0.15s_ease-out]
                     inset-0 w-full h-full rounded-none
                     sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[380px] sm:h-[520px] sm:max-h-[calc(100vh-8rem)] sm:rounded-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-sky-500
                              flex items-center justify-center text-sm">🤖</div>
              <div>
                <h3 className="text-sm font-semibold grad-text leading-tight">Lexify AI Tutor 🎓</h3>
                <p className="text-[10px] text-white/35 leading-tight">{t.chatSubtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { langRef.current = lang; setMessages([WELCOME]) }}
                className="text-white/40 hover:text-white/80 transition-colors p-1"
                aria-label="Clear chat"
                title={t.chatClear}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
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
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m, i) => (
              m.role === 'info' ? (
                <div key={i} className="flex justify-center">
                  <span className="text-[11px] text-white/40 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-center">
                    {m.content}
                  </span>
                </div>
              ) : (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                      m.role === 'user'
                        ? 'bg-gradient-to-br from-violet-600/80 to-sky-600/80 text-white rounded-br-md whitespace-pre-wrap'
                        : 'glass border-white/8 text-white/85 rounded-bl-md chat-md'
                    }`}
                  >
                    {m.role === 'user' ? m.content : <Markdown content={m.content} />}
                  </div>
                </div>
              )
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
                placeholder={t.chatPlaceholder}
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
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 w-14 h-14 rounded-full
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
