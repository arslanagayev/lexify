import { useLang } from '../i18n/LangContext'
import { speak, rateForLevel } from '../utils/speech'
import { useState } from 'react'
import { TTS_LOCALE } from '../utils/languages'
import { topicLabel, posLabel } from '../i18n/courseI18n'

export default function DailyWord({ words, targetLang = 'en', baseLang = 'zh', level }) {
  const { t, lang } = useLang()
  const [speaking, setSpeaking] = useState(null)
  const targetLocale = TTS_LOCALE[targetLang] || 'en-US'
  const baseLocale   = TTS_LOCALE[baseLang]   || 'en-US'

  if (!words || words.length === 0) return null

  // Deterministic: day number since Unix epoch mod word count
  const dayNum = Math.floor(Date.now() / 86400000)
  const word = words[dayNum % words.length]

  const handleSpeak = (text, locale, key) => {
    speak(text, locale, {
      onStart: () => setSpeaking(key),
      onEnd:   () => setSpeaking(null),
      onError: () => setSpeaking(null),
    }, rateForLevel(level))
  }

  const posStyle = {
    noun: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    verb: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    adjective: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    adverb: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  }[word.part_of_speech] || 'bg-white/10 text-white/40 border-white/15'

  return (
    <div className="mt-8 mb-1 animate-fade-up">
      <div className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-900/30 via-violet-800/10 to-cyan-900/20 p-6 sm:p-8">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-cyan-500/5 pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-start gap-6">
          {/* Left: label */}
          <div className="shrink-0">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-500/15 border border-violet-500/25">
              <span className="text-base">✨</span>
              <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">{t.dailyWord}</span>
            </div>
            <p className="text-white/25 text-xs mt-1.5 ml-1">{t.dailyWordSub}</p>
          </div>

          {/* Right: word content */}
          <div className="flex-1 min-w-0">
            {/* Word + POS + speak button */}
            <div className="flex items-start gap-3 flex-wrap">
              <h2 className="text-3xl sm:text-4xl font-black grad-text leading-none">{word.word}</h2>
              {word.part_of_speech && (
                <span className={`mt-1 text-xs px-2.5 py-1 rounded-full border font-medium ${posStyle}`}>
                  {posLabel(lang, word.part_of_speech)}
                </span>
              )}
              <SpeakBtn
                active={speaking === 'word'}
                onClick={() => handleSpeak(word.word, targetLocale, 'word')}
                label={targetLocale}
              />
            </div>

            {word.phonetic && (
              <p className="font-mono text-white/35 text-base mt-1">{word.phonetic}</p>
            )}

            {/* Meaning + speak button */}
            {word.chinese_meaning && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <p className="text-white/70 font-semibold text-xl leading-snug">
                  {word.chinese_meaning}
                  {word.chinese_pinyin && (
                    <span className="font-normal text-white/35 text-sm ml-2">{word.chinese_pinyin}</span>
                  )}
                </p>
                <SpeakBtn
                  active={speaking === 'meaning'}
                  onClick={() => handleSpeak(word.chinese_meaning, baseLocale, 'meaning')}
                  label={baseLocale}
                />
              </div>
            )}

            {/* Example sentence + speak button */}
            {word.example_sentence && (
              <div className="flex items-start justify-between gap-2 mt-2">
                <p className="text-white/40 text-sm italic leading-relaxed">"{word.example_sentence}"</p>
                <SpeakBtn
                  active={speaking === 'example'}
                  onClick={() => handleSpeak(word.example_sentence, targetLocale, 'example')}
                  label={targetLocale}
                  className="shrink-0 mt-0.5"
                />
              </div>
            )}

            {/* Example translation + speak button */}
            {word.chinese_translation && (
              <div className="flex items-start justify-between gap-2 mt-1">
                <p className="text-white/30 text-sm leading-relaxed">{word.chinese_translation}</p>
                <SpeakBtn
                  active={speaking === 'translation'}
                  onClick={() => handleSpeak(word.chinese_translation, baseLocale, 'translation')}
                  label={baseLocale}
                  className="shrink-0 mt-0.5"
                />
              </div>
            )}

            {word.tags && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {word.tags.split(',').map(tag => tag.trim()).filter(Boolean).map((tag, i) => (
                  <span key={i} className="text-[11px] px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300/70">
                    {topicLabel(lang, tag)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SpeakBtn({ active, onClick, label, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border transition-all duration-200 ${className}
        ${active
          ? 'bg-violet-500/25 border-violet-400/40 text-violet-300'
          : 'border-white/10 text-white/30 hover:bg-white/10 hover:text-white/50'}`}
    >
      {active ? <SoundWave /> : <SpeakerIcon className="w-3 h-3" />}
      {label}
    </button>
  )
}

function SoundWave() {
  return (
    <span className="flex items-end gap-px h-3">
      {[8,12,10,6].map((h,i) => (
        <span key={i} className="sound-bar inline-block w-0.5 rounded-full bg-violet-300" style={{ height:`${h}px` }} />
      ))}
    </span>
  )
}

function SpeakerIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
    </svg>
  )
}
