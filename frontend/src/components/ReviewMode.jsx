import { useState, useEffect, useCallback, useRef } from 'react'
import { useLang } from '../i18n/LangContext'
import { speak } from '../utils/speech'
import PronounceCheck from './PronounceCheck'
import ErrorBoundary from './ErrorBoundary'

export default function ReviewMode({ words, onReview, token, apiBase }) {
  const { t } = useLang()
  const [index, setIndex]           = useState(0)
  const [flipped, setFlipped]       = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [speaking, setSpeaking]     = useState(null)
  const [autoPlay, setAutoPlay]     = useState(false)
  const [includeMastered, setIncludeMastered] = useState(false)
  const [practiceMode, setPracticeMode]       = useState(false)
  const [practiceSentence, setPracticeSentence] = useState('')
  const [practiceResult, setPracticeResult]   = useState(null)
  const [practiceLoading, setPracticeLoading] = useState(false)
  const [autoStep, setAutoStep]     = useState('')  // current step label
  const cancelRef = useRef(false)   // signals running sequence to abort
  const timerRef  = useRef(null)

  // Exclude mastered words by default; user can opt to include them
  const queue = [...words]
    .filter(w => includeMastered || w.mastery_status !== 'mastered')
    // Overdue-first sort
    .sort((a, b) => {
      const aD = a.next_review ? new Date(a.next_review) : new Date(0)
      const bD = b.next_review ? new Date(b.next_review) : new Date(0)
      return aD - bD
    })
  const current = queue[index % Math.max(queue.length, 1)]

  const goTo = useCallback(next => {
    setFlipped(false)
    setTimeout(() => setIndex(next), 130)
  }, [])

  const goNext = useCallback(
    () => goTo((index + 1) % Math.max(queue.length, 1)),
    [goTo, index, queue.length]
  )
  const goPrev = useCallback(
    () => goTo((index - 1 + queue.length) % Math.max(queue.length, 1)),
    [goTo, index, queue.length]
  )

  const handleReview = useCallback(async (known) => {
    if (!current || submitting) return
    setSubmitting(true)
    try { await onReview(current.id, known); goNext() }
    finally { setSubmitting(false) }
  }, [current, onReview, goNext, submitting])

  // SM-2 grading: quality 0-5 (Again=1, Hard=3, Good=4, Easy=5)
  const grade = useCallback(async (quality) => {
    if (!current || submitting) return
    setSubmitting(true)
    try { await onReview(current.id, quality >= 3, quality); goNext() }
    finally { setSubmitting(false) }
  }, [current, onReview, goNext, submitting])

  const submitPractice = useCallback(async () => {
    if (!current || practiceLoading || !practiceSentence.trim()) return
    setPracticeLoading(true)
    setPracticeResult(null)
    try {
      const res = await fetch(`${apiBase}/words/${current.id}/practice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sentence: practiceSentence.trim() }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPracticeResult(data)
      if (data.score >= 7) onReview(current.id, true)  // count as known
    } catch {
      setPracticeResult({ error: true })
    } finally {
      setPracticeLoading(false)
    }
  }, [current, practiceLoading, practiceSentence, apiBase, token, onReview])

  const nextPractice = useCallback(() => {
    setPracticeResult(null)
    setPracticeSentence('')
    goNext()
  }, [goNext])

  // ── Auto-play sequence ──────────────────────────────────────
  const stopAutoPlay = useCallback(() => {
    cancelRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    window.speechSynthesis?.cancel()
    setSpeaking(null)
    setAutoStep('')
    setAutoPlay(false)
  }, [])

  const toggleAutoPlay = useCallback(() => {
    if (autoPlay) {
      stopAutoPlay()
    } else {
      cancelRef.current = false
      setAutoPlay(true)
    }
  }, [autoPlay, stopAutoPlay])

  // Helpers for the async sequence
  const delay = useCallback((ms) => new Promise(res => {
    timerRef.current = setTimeout(res, ms)
  }), [])

  const speakAsync = useCallback((text, lang, key) => new Promise(res => {
    setSpeaking(key)
    speak(text, lang, {
      onEnd:   () => { setSpeaking(null); res() },
      onError: () => { setSpeaking(null); res() },
    })
  }), [])

  useEffect(() => {
    if (!autoPlay || !current) return

    cancelRef.current = false
    setFlipped(false)

    const run = async () => {
      // Brief pause for card-flip animation to settle
      await delay(400)
      if (cancelRef.current) return

      // Step 1: Read the English word
      setAutoStep('🔊 en-US')
      await speakAsync(current.word, 'en-US', 'word')
      if (cancelRef.current) return

      // Step 2: Wait 2 s before flipping
      setAutoStep('⏳ 2s…')
      await delay(2000)
      if (cancelRef.current) return

      // Step 3: Flip card
      setAutoStep('↩ flip')
      setFlipped(true)
      await delay(350)
      if (cancelRef.current) return

      // Step 4: Read Chinese meaning
      if (current.chinese_meaning) {
        setAutoStep('🔊 zh-CN')
        await speakAsync(current.chinese_meaning, 'zh-CN', 'zh')
        if (cancelRef.current) return
      }

      // Step 5: Wait 3 s then advance
      setAutoStep('⏳ 3s…')
      await delay(3000)
      if (cancelRef.current) return

      setAutoStep('')
      goNext()
    }

    run()

    return () => {
      cancelRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
      window.speechSynthesis?.cancel()
      setSpeaking(null)
      setAutoStep('')
    }
  }, [autoPlay, index]) // re-fires on every card advance while autoPlay is on

  // ── Keyboard shortcuts ──────────────────────────────────────
  useEffect(() => {
    const onKey = e => {
      if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return
      if (e.key === 'ArrowRight' || e.key === 'l') { stopAutoPlay(); goNext() }
      else if (e.key === 'ArrowLeft' || e.key === 'h') { stopAutoPlay(); goPrev() }
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (autoPlay) stopAutoPlay()
        else setFlipped(f => !f)
      }
      else if (e.key === '1') grade(1)
      else if (e.key === '2') grade(3)
      else if (e.key === '3') grade(4)
      else if (e.key === '4') grade(5)
      else if (e.key === 'a' || e.key === 'A') toggleAutoPlay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev, grade, autoPlay, stopAutoPlay, toggleAutoPlay])

  // ── Manual speak helper ─────────────────────────────────────
  const handleSpeak = (text, lang, key) => {
    speak(text, lang, {
      onStart: () => setSpeaking(key),
      onEnd:   () => setSpeaking(null),
      onError: () => setSpeaking(null),
    })
  }

  const hasMastered = words.some(w => w.mastery_status === 'mastered')
  const masteredToggle = hasMastered && (
    <label className="flex items-center justify-center gap-2 mt-4 text-xs text-white/40 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={includeMastered}
        onChange={e => { setIncludeMastered(e.target.checked); setIndex(0) }}
        className="accent-emerald-500 w-3.5 h-3.5"
      />
      {t.includeMastered}
    </label>
  )

  if (!current) return (
    <div className="mt-20 text-center">
      <p className="text-white/30">{t.emptyReview}</p>
      {masteredToggle}
    </div>
  )

  const knownTotal  = words.reduce((s, w) => s + (w.known_count || 0), 0)
  const reviewTotal = words.reduce((s, w) => s + (w.review_count || 0), 0)
  const knownRate   = reviewTotal > 0 ? Math.round((knownTotal / reviewTotal) * 100) : 0
  const intervalLabel = t.intervalLabel(current.interval_days || 1)

  return (
    <div className="mt-8 max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex justify-between text-xs text-white/30 mb-2">
        <span>{index + 1} / {queue.length}</span>
        <span>{t.accuracy(knownRate)}</span>
      </div>
      {masteredToggle && <div className="mb-3">{masteredToggle}</div>}
      <div className="h-1 bg-white/8 rounded-full overflow-hidden mb-6">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-500"
          style={{ width: `${((index + 1) / queue.length) * 100}%` }}
        />
      </div>

      {/* Auto-play status bar */}
      {autoPlay && (
        <div className="flex items-center justify-between mb-3 px-1 animate-fade-up">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-xs text-violet-300/80">{t.autoPlaying}</span>
            {autoStep && (
              <span className="text-xs text-white/30 font-mono">{autoStep}</span>
            )}
          </div>
          <button
            onClick={stopAutoPlay}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs border border-red-500/30 text-red-400/80 hover:bg-red-500/10 transition-all"
          >
            <StopIcon className="w-3 h-3" /> Stop
          </button>
        </div>
      )}

      {/* Flip card */}
      <div
        className="flip-card select-none"
        style={{ height: '500px' }}
        onClick={() => { if (!autoPlay) setFlipped(f => !f) }}
      >
        <div className={`flip-card-inner ${flipped ? 'is-flipped' : ''}`}>

          {/* Front */}
          <div className={`flip-face glass flex flex-col items-center justify-center text-center p-10 transition-colors ${!autoPlay ? 'cursor-pointer hover:bg-white/[0.06]' : ''}`}>
            <div className="flex items-center gap-2 mb-5">
              {current.part_of_speech && (
                <span className="text-xs bg-violet-500/20 text-violet-300 border border-violet-500/30 px-3 py-1 rounded-full">
                  {current.part_of_speech}
                </span>
              )}
              <span className="text-xs bg-white/5 text-white/20 border border-white/10 px-2 py-1 rounded-full">
                {intervalLabel}
              </span>
            </div>
            <h2 className="text-5xl sm:text-6xl font-black grad-text mb-3 leading-none">{current.word}</h2>
            {current.phonetic && (
              <p className="font-mono text-white/35 text-xl mt-1">{current.phonetic}</p>
            )}
            <button
              onClick={e => { e.stopPropagation(); handleSpeak(current.word, 'en-US', 'word') }}
              className={`mt-6 flex items-center gap-2 px-4 py-2 rounded-xl text-sm border transition-all
                ${speaking === 'word'
                  ? 'bg-violet-500/20 border-violet-400/40 text-violet-300'
                  : 'glass border-white/10 text-white/30 hover:text-white/60'}`}
            >
              <SpeakerIcon className="w-4 h-4" />
              {t.pronounce}
            </button>
            {!autoPlay && (
              <p className="mt-8 text-white/15 text-sm flex items-center gap-1.5">
                <FlipIcon className="w-3.5 h-3.5" />{t.flipToSee}
              </p>
            )}
          </div>

          {/* Back */}
          <div className="flip-face flip-face-back glass flex flex-col justify-center p-6 sm:p-8 overflow-y-auto bg-gradient-to-br from-violet-900/20 to-cyan-900/20">
            <p className="text-[10px] uppercase tracking-widest text-white/25 mb-1">{t.meaning}</p>
            <p className="text-white font-bold text-2xl sm:text-3xl leading-snug">{current.chinese_meaning}</p>
            {current.chinese_pinyin && (
              <p className="text-white/35 text-base font-mono mt-1 mb-4 tracking-wide">{current.chinese_pinyin}</p>
            )}

            {current.example_sentence && (
              <div className="bg-white/5 rounded-2xl p-4 mb-3 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-widest text-white/25">{t.example}</p>
                  <SpeakMini active={speaking === 'en'}
                    onClick={e => { e.stopPropagation(); handleSpeak(current.example_sentence, 'en-US', 'en') }}
                    label="en-US" />
                </div>
                <p className="text-white/60 text-sm italic leading-relaxed">"{current.example_sentence}"</p>

                {current.chinese_translation && (
                  <div className="flex items-start justify-between gap-2 mt-3 pt-2.5 border-t border-white/5">
                    <p className="text-white/35 text-sm leading-relaxed">{current.chinese_translation}</p>
                    <SpeakMini active={speaking === 'zh'}
                      onClick={e => { e.stopPropagation(); handleSpeak(current.chinese_translation, 'zh-CN', 'zh') }}
                      label="zh-CN" />
                  </div>
                )}
              </div>
            )}

            {(current.synonyms || current.antonyms || current.collocations) && (
              <div className="flex flex-col gap-1.5 mt-1" onClick={e => e.stopPropagation()}>
                {current.synonyms && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-widest text-white/25 w-20 shrink-0">{t.synonyms}</span>
                    {current.synonyms.split(',').map(s => s.trim()).filter(Boolean).map((s, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300/70">{s}</span>
                    ))}
                  </div>
                )}
                {current.antonyms && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-widest text-white/25 w-20 shrink-0">{t.antonyms}</span>
                    {current.antonyms.split(',').map(s => s.trim()).filter(Boolean).map((s, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300/70">{s}</span>
                    ))}
                  </div>
                )}
                {current.collocations && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-widest text-white/25 w-20 shrink-0">{t.collocations}</span>
                    {current.collocations.split(',').map(s => s.trim()).filter(Boolean).map((s, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300/70">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pronunciation check */}
      {!practiceMode && (
        <div className="flex justify-center mt-4">
          <ErrorBoundary silent>
            <PronounceCheck word={current.word} wordId={current.id} token={token} apiBase={apiBase} />
          </ErrorBoundary>
        </div>
      )}

      {/* Practice Mode toggle */}
      <div className="flex justify-center mt-4">
        <button
          onClick={() => { setPracticeMode(v => !v); setPracticeResult(null); setPracticeSentence('') }}
          className={`text-xs px-4 py-2 rounded-full border transition-all flex items-center gap-1.5 ${
            practiceMode
              ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
              : 'glass border-white/10 text-white/40 hover:text-white/70'
          }`}
        >
          ✍️ {t.practiceMode}
        </button>
      </div>

      {/* Practice panel */}
      {practiceMode && (
        <div className="mt-5">
          <textarea
            value={practiceSentence}
            onChange={e => setPracticeSentence(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder={t.practicePrompt(current.word)}
            className="w-full resize-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/90 placeholder-white/30 focus:outline-none focus:border-violet-400/50"
          />
          <button
            onClick={submitPractice}
            disabled={practiceLoading || !practiceSentence.trim()}
            className="mt-2 w-full py-3 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-500 to-sky-500 text-white disabled:opacity-30 transition-opacity"
          >
            {practiceLoading ? t.practiceChecking : t.practiceSubmit}
          </button>

          {practiceResult?.error && (
            <p className="text-center text-red-400/70 text-xs mt-3">{t.practiceError}</p>
          )}
          {practiceResult && !practiceResult.error && (
            <div className={`mt-3 rounded-xl p-4 border ${
              practiceResult.score >= 7 ? 'bg-emerald-500/10 border-emerald-500/30'
              : practiceResult.score >= 4 ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-semibold ${
                  practiceResult.score >= 7 ? 'text-emerald-300'
                  : practiceResult.score >= 4 ? 'text-amber-300' : 'text-red-300'
                }`}>
                  {practiceResult.score >= 7 ? '✓ ' : ''}{t.practiceScore(practiceResult.score)}
                </span>
              </div>
              <p className="text-white/75 text-sm leading-relaxed">{practiceResult.feedback}</p>
              {practiceResult.better_version && (
                <p className="text-white/50 text-xs mt-2 italic">💡 {practiceResult.better_version}</p>
              )}
              <button onClick={nextPractice}
                className="mt-3 w-full py-2.5 rounded-xl text-sm glass border border-white/10 text-white/60 hover:text-white transition-all">
                {t.next} →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      {!practiceMode && (
      <div className="mt-6 space-y-3">

        {/* SM-2 grade buttons */}
        <div className="grid grid-cols-4 gap-2">
          <button onClick={() => grade(1)} disabled={submitting}
            className="py-3 rounded-xl text-sm font-medium border transition-all
                       bg-red-500/10 border-red-500/25 text-red-300 hover:bg-red-500/20 disabled:opacity-40
                       flex flex-col items-center">
            {t.gradeAgain}<span className="text-[10px] text-white/25 mt-0.5">1</span>
          </button>
          <button onClick={() => grade(3)} disabled={submitting}
            className="py-3 rounded-xl text-sm font-medium border transition-all
                       bg-amber-500/10 border-amber-500/25 text-amber-300 hover:bg-amber-500/20 disabled:opacity-40
                       flex flex-col items-center">
            {t.gradeHard}<span className="text-[10px] text-white/25 mt-0.5">2</span>
          </button>
          <button onClick={() => grade(4)} disabled={submitting}
            className="py-3 rounded-xl text-sm font-medium border transition-all
                       bg-emerald-500/10 border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40
                       flex flex-col items-center">
            {t.gradeGood}<span className="text-[10px] text-white/25 mt-0.5">3</span>
          </button>
          <button onClick={() => grade(5)} disabled={submitting}
            className="py-3 rounded-xl text-sm font-medium border transition-all
                       bg-sky-500/10 border-sky-500/25 text-sky-300 hover:bg-sky-500/20 disabled:opacity-40
                       flex flex-col items-center">
            {t.gradeEasy}<span className="text-[10px] text-white/25 mt-0.5">4</span>
          </button>
        </div>

        {/* Nav row: Prev + Auto + Next */}
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => { stopAutoPlay(); goPrev() }}
            className="glass rounded-xl px-4 py-2.5 text-xs text-white/50 hover:text-white hover:bg-white/8 transition-all flex items-center gap-1.5">
            <ArrowLeftIcon className="w-3.5 h-3.5" />{t.prev}
          </button>
          <button
            onClick={toggleAutoPlay}
            title="Auto-play (A)"
            className={`px-3 py-2.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5
              ${autoPlay
                ? 'bg-violet-500/25 border-violet-400/40 text-violet-300'
                : 'glass border-white/10 text-white/30 hover:text-white/60'}`}
          >
            {autoPlay ? <PauseIcon className="w-3.5 h-3.5" /> : <PlayIcon className="w-3.5 h-3.5" />}
            <span className="text-xs">{t.autoPlay}</span>
          </button>
          <button onClick={() => { stopAutoPlay(); goNext() }}
            className="glass rounded-xl px-4 py-2.5 text-xs text-white/50 hover:text-white hover:bg-white/8 transition-all flex items-center gap-1.5">
            {t.next}<ArrowRightIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      )}

      {!practiceMode && (
      <p className="text-center text-white/15 text-xs mt-4">
        {t.gradeHint}
      </p>
      )}
    </div>
  )
}

function SpeakMini({ active, onClick, label }) {
  return (
    <button onClick={onClick}
      className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono border transition-all
        ${active ? 'bg-violet-500/25 border-violet-400/40 text-violet-300' : 'border-white/10 text-white/25 hover:text-white/50'}`}>
      <SpeakerIcon className="w-3 h-3" />{label}
    </button>
  )
}

/* ── Icons ────────────────────────────────────────────────── */
function SpeakerIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
    </svg>
  )
}
function PlayIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
    </svg>
  )
}
function PauseIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
    </svg>
  )
}
function StopIcon({ className }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  )
}
function FlipIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  )
}
function ArrowLeftIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  )
}
function ArrowRightIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  )
}
function CheckIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-9" />
    </svg>
  )
}
function XIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
function SpinIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
