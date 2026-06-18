import { useState } from 'react'
import { useLang } from '../i18n/LangContext'

export default function MnemonicTip({ wordId, token, apiBase }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [tip, setTip] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (tip || loading) return
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/words/${wordId}/mnemonic`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const d = await res.json()
      setTip(d.mnemonic || t.mnemonicEmpty)
    } catch {
      setTip(t.mnemonicError)
    } finally {
      setLoading(false)
    }
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) load()
  }

  return (
    <div onClick={e => e.stopPropagation()}>
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-white/30 hover:text-amber-300/80 transition-colors"
      >
        <span>💡 {t.mnemonicTip}</span>
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="mt-2">
          {loading
            ? <p className="text-white/30 text-xs">{t.mnemonicLoading}</p>
            : <p className="text-white/55 text-sm leading-relaxed">
                {(tip || '').split(/\*\*(.*?)\*\*/g).map((p, i) =>
                  i % 2 === 1
                    ? <strong key={i} className="font-bold text-violet-300">{p}</strong>
                    : <span key={i}>{p}</span>
                )}
              </p>}
        </div>
      )}
    </div>
  )
}
