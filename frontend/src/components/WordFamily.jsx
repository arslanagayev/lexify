import { useState } from 'react'
import { useLang } from '../i18n/LangContext'

export default function WordFamily({ wordId, token, apiBase, ownedWords, onAddWord }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState({})

  const load = async () => {
    if (data || loading) return
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/words/${wordId}/family`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setData({ root: '', family: [], error: true })
    } finally {
      setLoading(false)
    }
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) load()
  }

  const handleAdd = async (word) => {
    setAdded(s => ({ ...s, [word]: 'loading' }))
    try {
      await onAddWord(word)
      setAdded(s => ({ ...s, [word]: 'done' }))
    } catch {
      setAdded(s => ({ ...s, [word]: 'done' }))
    }
  }

  return (
    <div onClick={e => e.stopPropagation()}>
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors"
      >
        <span>🌳 {t.wordFamily}</span>
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="mt-2">
          {loading && <p className="text-white/30 text-xs">{t.wordFamilyLoading}</p>}
          {data && !loading && (
            data.error || (!data.family?.length) ? (
              <p className="text-white/30 text-xs">{t.wordFamilyEmpty}</p>
            ) : (
              <>
                {data.root && (
                  <p className="text-white/45 text-xs mb-2"><span className="text-white/30">{t.wordFamilyRoot}:</span> {data.root}</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {data.family.map((fw) => {
                    const owned = ownedWords?.has(fw.toLowerCase())
                    const state = added[fw]
                    if (owned || state === 'done') {
                      return (
                        <span key={fw} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300/80">
                          {fw} ✓
                        </span>
                      )
                    }
                    return (
                      <button key={fw} onClick={() => handleAdd(fw)} disabled={state === 'loading'}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/15 text-white/55 hover:text-white hover:border-violet-400/40 transition-all disabled:opacity-50">
                        {state === 'loading' ? '…' : `+ ${fw}`}
                      </button>
                    )
                  })}
                </div>
              </>
            )
          )}
        </div>
      )}
    </div>
  )
}
