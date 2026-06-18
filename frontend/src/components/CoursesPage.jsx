import { useState, useEffect } from 'react'
import { useLang } from '../i18n/LangContext'
import { LANGUAGES, LANG_CODES, langFlag, langName } from '../utils/languages'

export default function CoursesPage({ apiBase, token, onCourseChange }) {
  const { t } = useLang()
  const [data, setData] = useState(null)         // {courses, active_course_id}
  const [creating, setCreating] = useState(false)
  const [expandedBase, setExpandedBase] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const load = () => {
    fetch(`${apiBase}/courses`, { headers })
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ courses: [], active_course_id: null }))
  }
  useEffect(load, [])

  const activate = async (id) => {
    if (busy) return
    setBusy(true)
    try {
      await fetch(`${apiBase}/courses/${id}/activate`, { method: 'POST', headers })
      onCourseChange?.()
      load()
    } finally { setBusy(false) }
  }

  const createCourse = async (base, target) => {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`${apiBase}/courses`, {
        method: 'POST', headers, body: JSON.stringify({ base_language: base, target_language: target }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(res.status === 409 ? t.courseExists : (d.detail || t.courseError))
        return
      }
      setCreating(false); setExpandedBase(null)
      onCourseChange?.()
      load()
    } finally { setBusy(false) }
  }

  const remove = async (id) => {
    if (!confirm(t.courseDeleteConfirm)) return
    setBusy(true)
    try {
      await fetch(`${apiBase}/courses/${id}`, { method: 'DELETE', headers })
      onCourseChange?.()
      load()
    } finally { setBusy(false) }
  }

  if (!data) return <div className="mt-20 text-center text-white/30">…</div>

  const ownedTargetsByBase = {}
  data.courses.forEach(c => {
    (ownedTargetsByBase[c.base_language] = ownedTargetsByBase[c.base_language] || new Set()).add(c.target_language)
  })

  return (
    <div className="mt-8 max-w-4xl mx-auto animate-fade-up">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold grad-text">📚 {t.coursesTitle}</h2>
        {!creating && (
          <button onClick={() => setCreating(true)}
            className="text-sm px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-sky-500 text-white font-medium">
            + {t.courseNew}
          </button>
        )}
      </div>

      {!creating ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {data.courses.map(c => (
            <div key={c.id}
              className={`glass rounded-2xl p-5 border transition-all ${
                c.id === data.active_course_id ? 'border-violet-500/40 bg-violet-500/5' : 'border-white/10'
              }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-lg font-semibold text-white">
                  {langFlag(c.base_language)} {langName(c.base_language)}
                  <span className="text-white/30 mx-1.5">→</span>
                  {langFlag(c.target_language)} {langName(c.target_language)}
                </div>
                {c.id === data.active_course_id && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                    {t.courseActive}
                  </span>
                )}
              </div>
              <p className="text-white/40 text-sm mb-4">{t.courseWordCount(c.word_count)}</p>
              <div className="flex gap-2">
                {c.id !== data.active_course_id && (
                  <button onClick={() => activate(c.id)} disabled={busy}
                    className="flex-1 py-2 rounded-xl glass border border-white/10 text-white/70 hover:text-white text-sm transition-all">
                    {t.courseSwitch}
                  </button>
                )}
                <button onClick={() => remove(c.id)} disabled={busy}
                  className="px-3 py-2 rounded-xl glass border border-white/10 text-red-400/70 hover:text-red-400 text-sm transition-all">
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white/80 font-semibold">{t.courseWhichSpeak}</h3>
            <button onClick={() => { setCreating(false); setExpandedBase(null); setError(null) }}
              className="text-white/40 hover:text-white text-sm">✕</button>
          </div>
          {error && <p className="text-red-400/80 text-xs mb-3">{error}</p>}
          <div className="space-y-2">
            {LANG_CODES.map(base => (
              <div key={base} className="rounded-xl border border-white/8 overflow-hidden">
                <button
                  onClick={() => setExpandedBase(expandedBase === base ? null : base)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors">
                  <span className="text-sm text-white/80">{langFlag(base)} {t.courseForSpeakers(LANGUAGES[base].name)}</span>
                  <span className={`text-white/30 transition-transform ${expandedBase === base ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {expandedBase === base && (
                  <div className="px-3 pb-3 pt-1 flex flex-wrap gap-2">
                    {LANG_CODES.filter(tg => tg !== base).map(tg => {
                      const owned = ownedTargetsByBase[base]?.has(tg)
                      return (
                        <button key={tg} disabled={owned || busy} onClick={() => createCourse(base, tg)}
                          className={`text-sm px-3 py-1.5 rounded-full border transition-all ${
                            owned ? 'border-white/5 text-white/25 cursor-default'
                                  : 'border-white/15 text-white/70 hover:text-white hover:border-violet-400/40'
                          }`}>
                          {langFlag(tg)} {langName(tg)}{owned ? ' ✓' : ''}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
