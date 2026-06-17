import { useState, useEffect } from 'react'
import { useLang } from '../i18n/LangContext'

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ReviewCalendar({ apiBase, token, words }) {
  const { t } = useLang()
  const [data, setData] = useState({ due: {}, done: {} })
  const [offset, setOffset] = useState(0)   // months from current
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    fetch(`${apiBase}/review/calendar`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setData(d || { due: {}, done: {} }))
      .catch(() => {})
  }, [apiBase, token])

  const today = new Date()
  const todayStr = ymd(today)
  const view = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const year = view.getFullYear()
  const month = view.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))

  const weekdayNames = Array.from({ length: 7 }, (_, i) =>
    new Date(2026, 1, 1 + i).toLocaleDateString(undefined, { weekday: 'short' })
  )

  const todayDue = data.due[todayStr] || 0

  // Words for the selected day (today includes overdue)
  const selectedWords = selected
    ? words.filter(w => {
        if (!w.next_review) return false
        const nr = new Date(w.next_review)
        if (selected === todayStr) return ymd(nr) <= todayStr
        return ymd(nr) === selected
      })
    : []

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-white/60">📅 {t.calendarTitle}</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => { setOffset(o => o - 1); setSelected(null) }}
            className="text-white/40 hover:text-white px-2">‹</button>
          <span className="text-xs text-white/50 w-28 text-center">
            {view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => { setOffset(o => o + 1); setSelected(null) }}
            className="text-white/40 hover:text-white px-2">›</button>
        </div>
      </div>
      <p className="text-xs text-violet-300/70 mb-4">{t.calendarTodayDue(todayDue)}</p>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdayNames.map((w, i) => (
          <div key={i} className="text-[10px] text-white/25 uppercase tracking-wide pb-1">{w}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const ds = ymd(d)
          const due = data.due[ds] || 0
          const done = data.done[ds] || 0
          const isToday = ds === todayStr
          const isSel = ds === selected
          return (
            <button
              key={i}
              onClick={() => setSelected(isSel ? null : ds)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all border ${
                isSel ? 'border-violet-400/60 bg-violet-500/15'
                : isToday ? 'border-violet-400/40 bg-white/5'
                : 'border-transparent hover:bg-white/5'
              }`}
            >
              <span className={isToday ? 'text-violet-300 font-bold' : 'text-white/60'}>{d.getDate()}</span>
              <span className="flex gap-0.5 mt-0.5 h-1.5">
                {due > 0 && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" title={`${due} due`} />}
                {done > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title={`${done} done`} />}
              </span>
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 text-[11px] text-white/35">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-400" />{t.calendarDue}</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />{t.calendarDone}</span>
      </div>

      {/* Day detail */}
      {selected && (
        <div className="mt-4 pt-3 border-t border-white/8">
          <p className="text-xs text-white/40 mb-2">{selected}</p>
          {selectedWords.length === 0 ? (
            <p className="text-white/25 text-xs">{t.calendarNoWords}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selectedWords.map(w => (
                <span key={w.id} className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60">
                  {w.word}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
