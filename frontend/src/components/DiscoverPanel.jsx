import { useState, useEffect, useCallback } from 'react'
import { useLang } from '../i18n/LangContext'

const LEVEL_COLOR = {
  A1: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
  A2: 'bg-teal-500/15 border-teal-500/40 text-teal-300',
  B1: 'bg-sky-500/15 border-sky-500/40 text-sky-300',
  B2: 'bg-violet-500/15 border-violet-500/40 text-violet-300',
  C1: 'bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-300',
  C2: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
}

export default function DiscoverPanel({ apiBase, token, onAdded }) {
  const { t } = useLang()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding]   = useState({})   // word -> 'loading' | 'done' | 'error'
  const headers = { Authorization: `Bearer ${token}` }

  const fetchSuggestions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/words/suggest`, { headers })
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setData({ level: '—', suggestions: [] })
    } finally {
      setLoading(false)
    }
  }, [apiBase, token])

  useEffect(() => { fetchSuggestions() }, [])

  const add = async (word) => {
    if (adding[word]) return
    setAdding(s => ({ ...s, [word]: 'loading' }))
    try {
      const res = await fetch(`${apiBase}/words`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ word }),
      })
      if (!res.ok) throw new Error()
      setAdding(s => ({ ...s, [word]: 'done' }))
      onAdded?.()
    } catch {
      setAdding(s => ({ ...s, [word]: 'error' }))
    }
  }

  return (
    <div className="mt-8 max-w-5xl mx-auto animate-fade-up">
      {/* Header with level badge */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold grad-text">{t.discoverTitle}</h2>
          <p className="text-white/40 text-sm mt-0.5">{t.discoverSubtitle}</p>
        </div>
        {data && data.level !== '—' && (
          <div className={`px-4 py-2 rounded-2xl border text-sm font-semibold ${LEVEL_COLOR[data.level] || 'border-white/10 text-white/50'}`}>
            {t.myLevel}: {data.level}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 skeleton rounded-2xl" />)}
        </div>
      ) : data.suggestions.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">🧭</div>
          <p className="text-white/40">{t.discoverEmpty}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.suggestions.map((s) => {
            const state = adding[s.word]
            return (
              <div key={s.word} className="glass rounded-2xl p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-bold text-white truncate">{s.word}</h3>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${LEVEL_COLOR[s.level] || ''}`}>
                    {s.level}
                  </span>
                </div>
                <p className="text-white/50 text-sm flex-1">{s.brief_meaning}</p>
                <button
                  onClick={() => add(s.word)}
                  disabled={state === 'loading' || state === 'done'}
                  className={`w-full py-2 rounded-xl text-sm font-medium transition-all ${
                    state === 'done'
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                      : state === 'error'
                      ? 'bg-red-500/15 border border-red-500/30 text-red-300'
                      : 'bg-gradient-to-r from-violet-500 to-sky-500 text-white hover:opacity-90 disabled:opacity-50'
                  }`}
                >
                  {state === 'loading' ? t.discoverAdding
                    : state === 'done' ? `✓ ${t.discoverAdded}`
                    : state === 'error' ? t.discoverAddError
                    : `+ ${t.discoverAdd}`}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {!loading && data.suggestions.length > 0 && (
        <div className="flex justify-center mt-6">
          <button onClick={fetchSuggestions}
            className="text-xs px-4 py-2 rounded-full glass border border-white/10 text-white/50 hover:text-white transition-all">
            🔄 {t.discoverRefresh}
          </button>
        </div>
      )}
    </div>
  )
}
