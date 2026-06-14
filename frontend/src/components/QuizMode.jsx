import { useState, useCallback, useEffect } from 'react'
import { useLang } from '../i18n/LangContext'

const API = 'http://localhost:8000'

export default function QuizMode({ words, token }) {
  const { t } = useLang()
  const [question, setQuestion]   = useState(null)
  const [loading, setLoading]     = useState(false)
  const [selected, setSelected]   = useState(null) // index of clicked option
  const [score, setScore]         = useState({ correct: 0, total: 0 })
  const [finished, setFinished]   = useState(false)
  const [sessionLen] = useState(10)

  const wordsWithMeaning = words.filter(w => w.chinese_meaning)

  const fetchQuestion = useCallback(async () => {
    if (wordsWithMeaning.length < 2) return
    setLoading(true)
    setSelected(null)
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API}/quiz/question`, { headers })
      if (!res.ok) throw new Error('fetch failed')
      setQuestion(await res.json())
    } catch {
      // fallback: build question from local words state
      setQuestion(buildLocalQuestion(wordsWithMeaning))
    } finally {
      setLoading(false)
    }
  }, [wordsWithMeaning])

  useEffect(() => {
    if (!finished) fetchQuestion()
  }, [])

  const handleSelect = (idx) => {
    if (selected !== null) return
    setSelected(idx)
    const isCorrect = question.options[idx].correct
    setScore(s => ({
      correct: s.correct + (isCorrect ? 1 : 0),
      total: s.total + 1,
    }))
  }

  const handleNext = () => {
    if (score.total >= sessionLen) {
      setFinished(true)
    } else {
      fetchQuestion()
    }
  }

  const handleRestart = () => {
    setScore({ correct: 0, total: 0 })
    setFinished(false)
    setSelected(null)
    fetchQuestion()
  }

  if (wordsWithMeaning.length < 2) {
    return (
      <div className="mt-20 flex flex-col items-center gap-4 text-center">
        <div className="text-5xl">🎯</div>
        <p className="text-white/40 text-lg">{t.quizEmpty}</p>
      </div>
    )
  }

  if (finished) {
    const pct = Math.round((score.correct / score.total) * 100)
    const emoji = pct === 100 ? '🏆' : pct >= 70 ? '⭐' : '📚'
    const msg = pct === 100 ? t.quizPerfect : pct >= 70 ? t.quizGood : t.quizKeepPracticing
    return (
      <div className="mt-8 max-w-lg mx-auto text-center animate-fade-up">
        <div className="glass rounded-3xl p-10">
          <div className="text-6xl mb-4">{emoji}</div>
          <p className="text-4xl font-black grad-text mb-2">{t.quizScore(score.correct, score.total)}</p>
          <p className="text-white/50 text-lg mb-2">{t.quizResult(score.correct, score.total)}</p>
          <p className="text-white/30 text-sm mb-8">{msg}</p>
          <div className="w-full bg-white/8 rounded-full h-2 mb-8">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <button
            onClick={handleRestart}
            className="px-8 py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold hover:opacity-90 transition-opacity"
          >
            {t.quizRestart}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8 max-w-2xl mx-auto animate-fade-up">
      {/* Progress bar */}
      <div className="flex justify-between text-xs text-white/30 mb-2">
        <span>{t.quizScore(score.total, sessionLen)}</span>
        <span className="text-emerald-400/70">{score.correct > 0 && `✓ ${score.correct}`}</span>
      </div>
      <div className="h-1 bg-white/8 rounded-full overflow-hidden mb-8">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-500"
          style={{ width: `${(score.total / sessionLen) * 100}%` }}
        />
      </div>

      {loading || !question ? (
        <div className="glass rounded-3xl p-10 flex items-center justify-center h-80">
          <SpinIcon className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      ) : (
        <div className="glass rounded-3xl p-8">
          {/* Question */}
          <p className="text-[11px] uppercase tracking-widest text-white/25 mb-3">{t.quizTitle}</p>
          <p className="text-white/80 text-lg font-medium mb-8 leading-relaxed">
            {question.question}
          </p>

          {/* Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {question.options.map((opt, idx) => {
              let style = 'glass border-white/10 text-white/70 hover:border-violet-500/40 hover:bg-violet-500/5'
              if (selected !== null) {
                if (opt.correct) {
                  style = 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                } else if (idx === selected && !opt.correct) {
                  style = 'bg-red-500/20 border-red-500/50 text-red-300'
                } else {
                  style = 'border-white/5 text-white/30'
                }
              }
              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  disabled={selected !== null}
                  className={`w-full text-left px-5 py-4 rounded-2xl border text-sm font-medium transition-all duration-200 ${style}`}
                >
                  <span className="inline-flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs shrink-0">
                      {selected !== null && opt.correct ? '✓' : selected === idx && !opt.correct ? '✗' : String.fromCharCode(65 + idx)}
                    </span>
                    {opt.text}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Feedback + Next */}
          {selected !== null && (
            <div className="mt-6 flex items-center justify-between animate-fade-up">
              <p className={`font-semibold text-sm ${question.options[selected].correct ? 'text-emerald-400' : 'text-red-400'}`}>
                {question.options[selected].correct ? `✓ ${t.quizCorrect}` : `✗ ${t.quizWrong}`}
              </p>
              <button
                onClick={handleNext}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                {score.total >= sessionLen ? t.quizFinish : t.quizNext}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function buildLocalQuestion(words) {
  const correct = words[Math.floor(Math.random() * words.length)]
  const others = words.filter(w => w.id !== correct.id)
  const picks = others.sort(() => Math.random() - 0.5).slice(0, 3)
  const useReverse = Math.random() > 0.5 && others.length >= 3

  let options, question
  if (useReverse) {
    options = [{ text: correct.word, correct: true }, ...picks.map(w => ({ text: w.word, correct: false }))]
    question = `Hangi kelime "${correct.chinese_meaning}" anlamına gelir?`
  } else {
    options = [{ text: correct.chinese_meaning, correct: true }, ...picks.map(w => ({ text: w.chinese_meaning, correct: false }))]
    question = `"${correct.word}" ne anlama gelir?`
  }
  options.sort(() => Math.random() - 0.5)
  return { word_id: correct.id, word: correct.word, question_type: useReverse ? 'reverse' : 'meaning', question, options }
}

function SpinIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
