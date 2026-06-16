import { useState, useRef } from 'react'
import { useLang } from '../i18n/LangContext'

const CSV_TEMPLATE = 'word,notes\nresilient,important adj\nambiguous,\nephemeral,short-lived\n'

export default function ImportWordsModal({ apiBase, token, onClose, onComplete }) {
  const { t } = useLang()
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const upload = async (file) => {
    if (!file) return
    setUploading(true); setResult(null); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${apiBase}/words/import-file`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (!res.ok) {
        let msg = t.importFileError
        try { const d = await res.json(); if (typeof d.detail === 'string') msg = d.detail } catch { /* default */ }
        setError(msg)
        return
      }
      const data = await res.json()
      setResult(data)
      onComplete?.()
    } catch {
      setError(t.importFileError)
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    upload(e.dataTransfer.files?.[0])
  }

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'lexify-import-template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
         onClick={onClose}>
      <div className="glass rounded-3xl border border-white/10 shadow-2xl w-full max-w-md p-6"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold grad-text">{t.importWordsTitle}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 p-1" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!result ? (
          <>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                dragging ? 'border-violet-400/60 bg-violet-500/10' : 'border-white/15 hover:border-white/30'
              }`}
            >
              {uploading ? (
                <p className="text-white/60 text-sm">{t.importUploading}</p>
              ) : (
                <>
                  <div className="text-3xl mb-2">📥</div>
                  <p className="text-white/70 text-sm font-medium">{t.importDropHere}</p>
                  <p className="text-white/30 text-xs mt-1">CSV or Excel (.xlsx) · max 50</p>
                </>
              )}
              <input ref={inputRef} type="file" accept=".csv,.xlsx,.xlsm" className="hidden"
                     onChange={e => upload(e.target.files?.[0])} />
            </div>

            {error && <p className="text-red-400/80 text-xs mt-3 text-center">{error}</p>}

            <div className="mt-5 rounded-xl bg-white/5 border border-white/8 p-3">
              <p className="text-[11px] uppercase tracking-widest text-white/30 mb-1.5">{t.importFormat}</p>
              <pre className="text-xs text-white/50 font-mono leading-relaxed whitespace-pre-wrap">word,notes{'\n'}resilient,important adj{'\n'}ambiguous,</pre>
            </div>

            <button onClick={downloadTemplate}
              className="mt-3 text-xs text-violet-400 hover:text-violet-300 transition-colors">
              ↓ {t.importTemplate}
            </button>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-white/80 text-sm">{t.importResult(result.imported, result.skipped)}</p>
            {result.errors?.length > 0 && (
              <div className="mt-3 text-left max-h-32 overflow-y-auto rounded-xl bg-red-500/5 border border-red-500/15 p-3">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-red-400/70 text-xs">⚠ {e}</p>
                ))}
              </div>
            )}
            <button onClick={onClose}
              className="mt-5 w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-sky-500 text-white text-sm font-medium">
              {t.importDone}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
