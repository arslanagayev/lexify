import { useState } from 'react'
import { useLang } from '../i18n/LangContext'
import { speak } from '../utils/speech'

export default function StoryGeneratorModal({ words, token, apiBase, onClose }) {
  const { t } = useLang()
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [story, setStory] = useState(null)
  const [usedWords, setUsedWords] = useState([])
  const [error, setError] = useState(null)
  const [speaking, setSpeaking] = useState(false)

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 10) next.add(id)
      return next
    })
  }

  const generate = async () => {
    if (selected.size < 2 || loading) return
    setLoading(true); setError(null); setStory(null)
    try {
      const res = await fetch(`${apiBase}/story/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ word_ids: [...selected] }),
      })
      if (!res.ok) throw new Error()
      const d = await res.json()
      setStory(d.story)
      setUsedWords(d.words || [])
    } catch {
      setError(t.storyError)
    } finally {
      setLoading(false)
    }
  }

  const readAloud = () => {
    if (!story) return
    setSpeaking(true)
    speak(story, 'en-US', { onEnd: () => setSpeaking(false), onError: () => setSpeaking(false) })
  }

  // Render story with target words bolded
  const renderStory = () => {
    if (!story) return null
    if (!usedWords.length) return story
    const re = new RegExp(`\\b(${usedWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi')
    const parts = story.split(re)
    return parts.map((p, i) =>
      usedWords.some(w => w.toLowerCase() === p.toLowerCase())
        ? <strong key={i} className="text-violet-300">{p}</strong>
        : <span key={i}>{p}</span>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-3xl border border-white/10 shadow-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold grad-text">📖 {t.storyTitle}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 p-1" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {story ? (
          <>
            <p className="text-white/80 text-[15px] leading-relaxed mb-4">{renderStory()}</p>
            <div className="flex gap-2">
              <button onClick={readAloud} disabled={speaking}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-sky-500 text-white text-sm font-medium disabled:opacity-60">
                {speaking ? `🔊 ${t.storyReading}` : `🔊 ${t.storyReadAloud}`}
              </button>
              <button onClick={() => { setStory(null); setSelected(new Set()) }}
                className="flex-1 py-2.5 rounded-xl glass border border-white/10 text-white/70 text-sm font-medium hover:text-white transition-all">
                {t.storyAgain}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-white/45 text-sm mb-3">{t.storyDesc(selected.size)}</p>
            <div className="flex flex-wrap gap-2 mb-4 max-h-72 overflow-y-auto">
              {words.map(w => {
                const on = selected.has(w.id)
                return (
                  <button key={w.id} onClick={() => toggle(w.id)}
                    className={`text-sm px-3 py-1.5 rounded-full border transition-all ${
                      on ? 'bg-violet-500/25 border-violet-500/45 text-violet-200'
                         : 'border-white/10 text-white/55 hover:text-white/80'
                    }`}>
                    {on ? '✓ ' : ''}{w.word}
                  </button>
                )
              })}
            </div>
            {error && <p className="text-red-400/80 text-xs mb-3">{error}</p>}
            <button onClick={generate} disabled={selected.size < 2 || loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-sky-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-40">
              {loading ? t.storyGenerating : t.storyGenerate}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
