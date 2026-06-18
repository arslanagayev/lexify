import { useState } from 'react'
import { useLang } from '../i18n/LangContext'

export default function ImportListModal({ apiBase, token, onClose, onImported }) {
  const { t } = useLang()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const doImport = async () => {
    const c = code.trim()
    if (!c || loading) return
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch(`${apiBase}/lists/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: c }),
      })
      if (!res.ok) {
        let msg = t.importListInvalid
        if (res.status === 400) msg = t.importListOwn
        try { const d = await res.json(); if (typeof d.detail === 'string') {
          if (d.detail.includes('own')) msg = t.importListOwn
          else if (d.detail.toLowerCase().includes('invalid') || res.status === 404) msg = t.importListInvalid
        } } catch { /* default */ }
        setError(msg)
        return
      }
      const d = await res.json()
      setResult(d)
      onImported?.()
    } catch {
      setError(t.importListInvalid)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-3xl border border-white/10 shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold grad-text">{t.importListTitle}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 p-1" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {result ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-white/80 text-sm">{t.importResult(result.imported, result.skipped)}</p>
            <button onClick={onClose}
              className="mt-5 w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-sky-500 text-white text-sm font-medium">
              {t.importDone}
            </button>
          </div>
        ) : (
          <>
            <p className="text-white/45 text-sm mb-4">{t.importListDesc}</p>
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doImport()}
              placeholder={t.importListPlaceholder}
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/90 placeholder-white/30 focus:outline-none focus:border-violet-400/50"
            />
            {error && <p className="text-red-400/80 text-xs mt-2">{error}</p>}
            <button
              onClick={doImport}
              disabled={!code.trim() || loading}
              className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-sky-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {loading ? t.importListLoading : t.importListAction}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
