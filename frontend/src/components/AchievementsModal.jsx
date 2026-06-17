import { useState, useEffect } from 'react'
import { useLang } from '../i18n/LangContext'

export default function AchievementsModal({ apiBase, token, onClose }) {
  const { t } = useLang()
  const [items, setItems] = useState(null)

  useEffect(() => {
    fetch(`${apiBase}/achievements`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setItems(d.achievements || []))
      .catch(() => setItems([]))
  }, [apiBase, token])

  const unlockedCount = items ? items.filter(a => a.unlocked).length : 0

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-3xl border border-white/10 shadow-2xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold grad-text">🏆 {t.achievementsTitle}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 p-1" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {items && (
          <p className="text-white/40 text-sm mb-5">{unlockedCount} / {items.length}</p>
        )}

        {!items ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 skeleton rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map(a => (
              <div key={a.id}
                className={`rounded-2xl p-4 border text-center transition-all ${
                  a.unlocked
                    ? 'glass border-violet-500/30 bg-violet-500/5'
                    : 'border-white/8 bg-white/[0.02] opacity-50'
                }`}>
                <div className={`text-3xl mb-1.5 ${a.unlocked ? '' : 'grayscale'}`}>
                  {a.unlocked ? a.icon : '🔒'}
                </div>
                <p className={`text-sm font-semibold ${a.unlocked ? 'text-white' : 'text-white/40'}`}>{a.name}</p>
                <p className="text-[11px] text-white/35 mt-0.5 leading-snug">{a.description}</p>
                {a.unlocked && a.unlocked_at && (
                  <p className="text-[10px] text-violet-300/60 mt-1.5">
                    {new Date(a.unlocked_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
