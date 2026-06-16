import { useState, useMemo } from 'react'
import { useLang } from '../i18n/LangContext'

const TYPE_COLOR = {
  synonym:     { stroke: '#34d399', fill: 'rgba(52,211,153,0.18)', text: '#6ee7b7' },
  antonym:     { stroke: '#f87171', fill: 'rgba(248,113,113,0.18)', text: '#fca5a5' },
  collocation: { stroke: '#9ca3af', fill: 'rgba(156,163,175,0.15)', text: '#cbd5e1' },
}

function parseList(str) {
  return (str || '').split(',').map(s => s.trim()).filter(Boolean)
}

export default function WordMapModal({ word: initialWord, words, onClose }) {
  const { t } = useLang()
  const [center, setCenter] = useState(initialWord)

  const wordByText = useMemo(() => {
    const m = new Map()
    for (const w of words) m.set(w.word.toLowerCase(), w)
    return m
  }, [words])

  const nodes = useMemo(() => {
    const out = []
    const push = (list, type) => {
      for (const text of list) {
        out.push({ text, type, inList: wordByText.has(text.toLowerCase()) })
      }
    }
    push(parseList(center.synonyms), 'synonym')
    push(parseList(center.antonyms), 'antonym')
    push(parseList(center.collocations), 'collocation')
    return out
  }, [center, wordByText])

  const W = 500, H = 500, cx = W / 2, cy = H / 2, R = 175

  const positioned = nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1) - Math.PI / 2
    return { ...n, x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) }
  })

  const focus = (n) => {
    if (!n.inList) return
    const w = wordByText.get(n.text.toLowerCase())
    if (w && (w.synonyms || w.antonyms || w.collocations)) setCenter(w)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-3xl border border-white/10 shadow-2xl w-full max-w-xl p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold grad-text">🕸️ {t.wordMapTitle}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 p-1" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {nodes.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🕸️</div>
            <p className="text-white/40 text-sm">{t.wordMapEmpty}</p>
          </div>
        ) : (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
              {/* edges */}
              {positioned.map((n, i) => (
                <line key={`e${i}`} x1={cx} y1={cy} x2={n.x} y2={n.y}
                  stroke={TYPE_COLOR[n.type].stroke} strokeOpacity="0.35" strokeWidth="1.5" />
              ))}
              {/* outer nodes */}
              {positioned.map((n, i) => {
                const c = TYPE_COLOR[n.type]
                return (
                  <g key={`n${i}`} onClick={() => focus(n)}
                     style={{ cursor: n.inList ? 'pointer' : 'default' }}>
                    <circle cx={n.x} cy={n.y} r="9"
                      fill={n.inList ? c.stroke : c.fill}
                      stroke={c.stroke} strokeWidth="2" />
                    <text x={n.x} y={n.y - 14} textAnchor="middle"
                      fill={c.text} fontSize="13" fontWeight={n.inList ? 600 : 400}>
                      {n.text}
                    </text>
                  </g>
                )
              })}
              {/* center node */}
              <circle cx={cx} cy={cy} r="34" fill="url(#grad)" />
              <text x={cx} y={cy + 5} textAnchor="middle" fill="#fff" fontSize="16" fontWeight="700">
                {center.word}
              </text>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
              </defs>
            </svg>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-2 flex-wrap">
              <Legend color="#34d399" label={t.synonyms} />
              <Legend color="#f87171" label={t.antonyms} />
              <Legend color="#9ca3af" label={t.collocations} />
            </div>
            <p className="text-center text-white/25 text-xs mt-2">{t.wordMapHint}</p>
          </>
        )}
      </div>
    </div>
  )
}

function Legend({ color, label }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-white/40">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}
