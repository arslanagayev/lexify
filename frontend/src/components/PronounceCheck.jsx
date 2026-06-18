import { useState, useRef } from 'react'
import { useLang } from '../i18n/LangContext'
import { speak } from '../utils/speech'
import { TTS_LOCALE } from '../utils/languages'

const SR = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null

// Keep letters from ANY script (Latin, Cyrillic, Han, …) so pronunciation
// checking works for every course target language, not just English.
function normalize(s) {
  try {
    return (s || '').toLowerCase().trim().replace(/[^\p{L}\s]/gu, '').replace(/\s+/g, ' ')
  } catch {
    return (s || '').toLowerCase().trim().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ')
  }
}

function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

export default function PronounceCheck({ word, wordId, token, apiBase, compact, targetLang = 'en' }) {
  const { t } = useLang()
  const targetLocale = TTS_LOCALE[targetLang] || 'en-US'
  const [listening, setListening] = useState(false)
  const [result, setResult] = useState(null) // {type:'ok'|'close'|'bad', heard}
  const recRef = useRef(null)

  const supported = !!SR

  const report = async (success) => {
    if (!wordId || !token || !apiBase) return
    try {
      await fetch(`${apiBase}/words/${wordId}/pronunciation-attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ success }),
      })
    } catch { /* non-critical */ }
  }

  const start = () => {
    if (!supported || listening) return
    setResult(null)
    const rec = new SR()
    recRef.current = rec
    rec.lang = targetLocale
    rec.interimResults = false
    rec.maxAlternatives = 3
    rec.onresult = (e) => {
      const heard = e.results[0][0].transcript
      const target = normalize(word)
      const said = normalize(heard)
      const dist = levenshtein(target, said)
      if (said === target || dist === 0) {
        setResult({ type: 'ok', heard })
        report(true)
      } else if (dist <= 2) {
        setResult({ type: 'close', heard })
      } else {
        setResult({ type: 'bad', heard })
        speak(word, targetLocale)
      }
    }
    rec.onerror = () => { setResult({ type: 'bad', heard: '' }); setListening(false) }
    rec.onend = () => setListening(false)
    try { rec.start(); setListening(true) } catch { setListening(false) }
  }

  if (!supported) {
    return (
      <button
        disabled
        title={t.pronChrome}
        className="p-1.5 rounded-lg text-white/15 cursor-not-allowed"
      >
        <MicIcon className="w-3.5 h-3.5" />
      </button>
    )
  }

  const msg = result && (
    result.type === 'ok' ? <span className="text-emerald-400">{t.pronPerfect}</span>
    : result.type === 'close' ? <span className="text-amber-400">{t.pronClose(result.heard)}</span>
    : <span className="text-red-400">{result.heard ? t.pronWrong(result.heard) : t.pronError}</span>
  )

  if (compact) {
    // Icon-only button (for card action row); shows result as title tooltip
    return (
      <button
        onClick={start}
        title={t.pronCheck}
        className={`p-1.5 rounded-lg transition-all ${
          listening ? 'text-rose-400 animate-pulse'
          : result?.type === 'ok' ? 'text-emerald-400'
          : 'text-white/20 hover:text-rose-300 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100'
        }`}
      >
        <MicIcon className="w-3.5 h-3.5" />
      </button>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={start}
        disabled={listening}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
          listening
            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse'
            : 'glass border-white/10 text-white/60 hover:text-white'
        }`}
      >
        <MicIcon className="w-4 h-4" />
        {listening ? t.pronListening : t.pronCheck}
      </button>
      {msg && <p className="text-xs text-center">{msg}</p>}
    </div>
  )
}

function MicIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  )
}
