import { useState, useEffect } from 'react'
import { useLang } from '../i18n/LangContext'

export default function ShareCard({ apiBase, token, onClose }) {
  const { t } = useLang()
  const [svg, setSvg] = useState(null)

  useEffect(() => {
    fetch(`${apiBase}/share/progress-card`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setSvg(d.svg))
      .catch(() => setSvg(''))
  }, [apiBase, token])

  const toPng = (cb) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 600; canvas.height = 315
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob(cb, 'image/png')
    }
    img.onerror = () => { URL.revokeObjectURL(url); cb(null) }
    img.src = url
  }

  const download = () => {
    toPng(blob => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'lexify-progress.png'
      a.click()
      URL.revokeObjectURL(a.href)
    })
  }

  const share = () => {
    toPng(async blob => {
      if (!blob) return
      const file = new File([blob], 'lexify-progress.png', { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], text: 'My Lexify progress! 📚' }) } catch { /* cancelled */ }
      } else {
        download()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-3xl border border-white/10 shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold grad-text">{t.shareTitle}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 p-1" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {svg === null ? (
          <div className="h-48 skeleton rounded-2xl" />
        ) : svg === '' ? (
          <p className="text-white/40 text-sm text-center py-12">{t.shareError}</p>
        ) : (
          <>
            <div className="rounded-2xl overflow-hidden border border-white/10" dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="flex gap-2 mt-4">
              <button onClick={download}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-sky-500 text-white text-sm font-medium hover:opacity-90 transition-opacity">
                ⬇ {t.shareDownload}
              </button>
              <button onClick={share}
                className="flex-1 py-2.5 rounded-xl glass border border-white/10 text-white/70 text-sm font-medium hover:text-white transition-all">
                🔗 {t.shareButton}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
