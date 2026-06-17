import { useState, useEffect, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts'
import { useLang } from '../i18n/LangContext'
import ReviewCalendar from './ReviewCalendar'
import ShareCard from './ShareCard'
import ErrorBoundary from './ErrorBoundary'

export default function StatsPanel({ words, apiBase, token, onImportComplete }) {
  const { t } = useLang()
  const [stats, setStats]           = useState(null)
  const [overview, setOverview]     = useState(null)
  const [insights, setInsights]     = useState(null)
  const [showShare, setShowShare]   = useState(false)
  const [loading, setLoading]       = useState(true)
  const [reviewLog, setReviewLog]   = useState([])
  const [importMsg, setImportMsg]   = useState(null)
  const importRef = useRef(null)

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {}

  useEffect(() => {
    fetch(`${apiBase}/stats`, { headers: authHeader })
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false) })
      .catch(() => setLoading(false))
    fetch(`${apiBase}/review-log?limit=20`, { headers: authHeader })
      .then(r => r.json())
      .then(setReviewLog)
      .catch(() => {})
    fetch(`${apiBase}/stats/overview`, { headers: authHeader })
      .then(r => r.json())
      .then(setOverview)
      .catch(() => {})
    fetch(`${apiBase}/stats/insights`, { headers: authHeader })
      .then(r => r.json())
      .then(setInsights)
      .catch(() => {})
  }, [apiBase, words.length])

  // Day labels for the weekly chart (last 7 days, oldest → newest)
  const weeklyData = overview ? overview.weekly_added.map((added, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return {
      day: d.toLocaleDateString(undefined, { weekday: 'short' }),
      added,
      mastered: overview.weekly_mastered[i] || 0,
    }
  }) : []

  const handleExport = async () => {
    const res = await fetch(`${apiBase}/words/export`, { headers: authHeader })
    const data = await res.json()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lexify-export-${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const arr = Array.isArray(data) ? data : [data]
      const res = await fetch(`${apiBase}/words/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(arr),
      })
      if (!res.ok) throw new Error()
      const result = await res.json()
      setImportMsg(t.importSuccess(result.imported, result.skipped))
      onImportComplete?.()
    } catch {
      setImportMsg(t.importError)
    }
    importRef.current.value = ''
    setTimeout(() => setImportMsg(null), 4000)
  }

  const posCounts = words.reduce((acc, w) => {
    const pos = w.part_of_speech || 'other'
    acc[pos] = (acc[pos] || 0) + 1
    return acc
  }, {})
  const posData = Object.entries(posCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([pos, count]) => ({ pos, count }))

  const POS_COLORS = {
    noun:'#38bdf8', verb:'#34d399', adjective:'#fbbf24',
    adverb:'#a78bfa', preposition:'#f472b6', other:'#6b7280',
  }

  const knownRate = stats ? Math.round(stats.known_rate * 100) : 0
  const dueCount  = words.filter(w => !w.next_review || new Date(w.next_review) <= new Date()).length

  const tooltipStyle = {
    background: 'rgba(13,13,24,0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12, color: 'white', fontSize: 12,
  }

  return (
    <div className="mt-8 space-y-6 animate-fade-up">
      {/* Export / Import toolbar */}
      <div className="flex items-center gap-3 justify-end flex-wrap">
        {importMsg && (
          <p className={`text-xs flex-1 ${importMsg === t.importError ? 'text-red-400' : 'text-emerald-400'}`}>{importMsg}</p>
        )}
        <button onClick={() => setShowShare(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-white/10 text-white/50 hover:text-white text-sm transition-all">
          🔗 {t.shareProgress}
        </button>
        <button onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-white/10 text-white/50 hover:text-white text-sm transition-all">
          <DownloadIcon className="w-4 h-4" />{t.exportWords}
        </button>
        <button onClick={() => importRef.current.click()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-white/10 text-white/50 hover:text-white text-sm transition-all">
          <UploadIcon className="w-4 h-4" />{t.importWords}
        </button>
        <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
      </div>

      {/* FAZ 2 — Mastery Overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label={t.totalWords}     value={overview?.total_words ?? '—'}                       icon="📚" color="violet"  loading={!overview} />
        <StatCard label={t.masteredLabel}  value={overview?.mastered_count ?? '—'}                    icon="✅" color="emerald" loading={!overview} />
        <StatCard label={t.avgDaysMaster}  value={overview ? `${overview.avg_days_to_master}d` : '—'} icon="⏱️" color="cyan"    loading={!overview} />
        <StatCard label={t.accuracyRateLabel} value={overview ? `${Math.round(overview.accuracy_rate*100)}%` : '—'} icon="🎯" color="amber" loading={!overview} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly added vs mastered */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white/60 mb-4">{t.weeklyProgress}</h3>
          {!overview ? (
            <div className="h-48 skeleton rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyData} barCategoryGap="30%">
                <XAxis dataKey="day" tick={{ fill:'rgba(255,255,255,0.3)', fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:'rgba(255,255,255,0.2)', fontSize:10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill:'rgba(255,255,255,0.04)' }} />
                <Legend formatter={v => <span style={{ color:'rgba(255,255,255,0.4)', fontSize:11 }}>{v}</span>} />
                <Bar dataKey="added"    name={t.barAdded}    fill="#38bdf8" radius={[4,4,0,0]} maxBarSize={20} />
                <Bar dataKey="mastered" name={t.barMastered} fill="#34d399" radius={[4,4,0,0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Hardest 5 words */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white/60 mb-4">{t.hardestWords}</h3>
          {!overview ? (
            <div className="h-48 skeleton rounded-xl" />
          ) : overview.hardest_words.length === 0 ? (
            <p className="text-white/20 text-sm text-center py-12">{t.noData}</p>
          ) : (
            <div className="space-y-2">
              {overview.hardest_words.map((w, i) => (
                <div key={w.id} className="flex items-center gap-3 py-1">
                  <span className="text-white/20 text-xs w-4 shrink-0">{i + 1}</span>
                  <span className="text-white/80 text-sm font-medium truncate flex-1">{w.word}</span>
                  <span className="text-white/30 text-xs shrink-0">{t.reviewsShort(w.reviews)}</span>
                  <span className={`text-xs font-medium w-10 text-right shrink-0 ${
                    w.accuracy >= 0.7 ? 'text-emerald-400' : w.accuracy >= 0.4 ? 'text-amber-400' : 'text-red-400'
                  }`}>{Math.round(w.accuracy * 100)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FAZ 20 — Learning insights */}
      {insights && insights.weakest_pos && (
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white/60 mb-3">💡 {t.insightsTitle}</h3>
          <p className="text-sm text-white/70 mb-4">
            {t.insightWeakest(insights.weakest_pos)}
            {insights.strongest_pos && insights.strongest_pos !== insights.weakest_pos
              && ' ' + t.insightStrongest(insights.strongest_pos)}
          </p>
          <div className="space-y-1.5">
            {insights.by_pos.filter(p => p.accuracy !== null).map(p => (
              <div key={p.pos} className="flex items-center gap-3">
                <span className="text-white/50 text-xs w-24 truncate shrink-0 capitalize">{p.pos}</span>
                <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400"
                       style={{ width: `${Math.round(p.accuracy * 100)}%` }} />
                </div>
                <span className="text-white/25 text-xs w-9 text-right shrink-0">{Math.round(p.accuracy * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAZ 18 — Spaced repetition calendar */}
      <ErrorBoundary silent>
        <ReviewCalendar apiBase={apiBase} token={token} words={words} />
      </ErrorBoundary>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label={t.totalWords}    value={words.length}              icon="📚" color="violet" />
        <StatCard label={t.addedToday}    value={stats?.added_today ?? '—'} icon="✨" color="cyan"    loading={loading} />
        <StatCard label={t.reviewedToday} value={stats?.reviewed_today ?? '—'} icon="🔁" color="emerald" loading={loading} />
        <StatCard label={t.accuracyStat}  value={`${knownRate}%`}           icon="🎯" color="amber"  loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity chart */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white/60 mb-4">{t.last7Days}</h3>
          {loading ? (
            <div className="h-48 skeleton rounded-xl" />
          ) : stats?.daily_history?.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.daily_history} barCategoryGap="30%">
                <XAxis dataKey="date" tickFormatter={d => d.slice(5)}
                  tick={{ fill:'rgba(255,255,255,0.3)', fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:'rgba(255,255,255,0.2)', fontSize:10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill:'rgba(255,255,255,0.04)' }} />
                <Legend formatter={v => <span style={{ color:'rgba(255,255,255,0.4)', fontSize:11 }}>{v}</span>} />
                <Bar dataKey="added"    name={t.barAdded}    fill="#8b5cf6" radius={[4,4,0,0]} maxBarSize={20} />
                <Bar dataKey="reviewed" name={t.barReviewed} fill="#06b6d4" radius={[4,4,0,0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-white/20 text-sm text-center py-12">{t.noData}</p>
          )}
        </div>

        {/* POS distribution */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white/60 mb-4">{t.posDistribution}</h3>
          {posData.length === 0 ? (
            <p className="text-white/20 text-sm text-center py-12">{t.noWords_chart}</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={posData} layout="vertical" barCategoryGap="20%">
                <XAxis type="number" tick={{ fill:'rgba(255,255,255,0.2)', fontSize:10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="pos" tick={{ fill:'rgba(255,255,255,0.4)', fontSize:11 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill:'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="count" name={t.totalWords} radius={[0,4,4,0]} maxBarSize={18}>
                  {posData.map(({ pos }) => (
                    <Cell key={pos} fill={POS_COLORS[pos] || POS_COLORS.other} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white/60 mb-4">{t.recentActivity}</h3>
        {reviewLog.length === 0 ? (
          <p className="text-white/20 text-sm text-center py-6">{t.noActivity}</p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {reviewLog.slice(0, 20).map(entry => {
              const dt = new Date(entry.reviewed_at)
              const dateStr = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              const timeStr = dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
              return (
                <div key={entry.id} className="flex items-center gap-3 py-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                    entry.known
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                      : 'bg-red-500/15 text-red-400 border border-red-500/20'
                  }`}>
                    {entry.known ? t.activityKnown : t.activityUnknown}
                  </span>
                  <span className="text-white/70 text-sm font-medium truncate flex-1">{entry.word_text}</span>
                  <span className="text-white/20 text-xs shrink-0">{dateStr} {timeStr}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Review status */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white/60 mb-4">{t.reviewStatus}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
          <MiniStat label={t.pendingReview} value={dueCount}                      accent="violet" />
          <MiniStat label={t.totalReviews}  value={stats?.total_reviews ?? '—'}   accent="cyan"   loading={loading} />
          <MiniStat label={t.totalWords}    value={words.length}                   accent="emerald" />
        </div>

        {words.filter(w => w.review_count > 0).length > 0 && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {[...words]
              .filter(w => w.review_count > 0)
              .sort((a, b) => b.review_count - a.review_count)
              .slice(0, 15)
              .map(w => {
                const total = (w.known_count || 0) + (w.unknown_count || 0)
                const pct   = total > 0 ? Math.round((w.known_count / total) * 100) : 0
                return (
                  <div key={w.id} className="flex items-center gap-3">
                    <span className="text-white/50 text-xs w-28 truncate shrink-0">{w.word}</span>
                    <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-all"
                           style={{ width:`${pct}%` }} />
                    </div>
                    <span className="text-white/25 text-xs w-8 text-right shrink-0">{pct}%</span>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {showShare && (
        <ErrorBoundary silent>
          <ShareCard apiBase={apiBase} token={token} onClose={() => setShowShare(false)} />
        </ErrorBoundary>
      )}
    </div>
  )
}

function DownloadIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
}
function UploadIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  )
}

function StatCard({ label, value, icon, color, loading }) {
  const border = {
    violet: 'border-violet-500/20 bg-violet-500/5',
    cyan:   'border-cyan-500/20 bg-cyan-500/5',
    emerald:'border-emerald-500/20 bg-emerald-500/5',
    amber:  'border-amber-500/20 bg-amber-500/5',
  }[color] || 'border-white/10'

  return (
    <div className={`glass rounded-2xl p-5 border ${border}`}>
      <p className="text-2xl mb-1">{icon}</p>
      {loading
        ? <div className="skeleton h-7 w-16 rounded-lg mb-1" />
        : <p className="text-2xl font-bold text-white">{value}</p>}
      <p className="text-xs text-white/30">{label}</p>
    </div>
  )
}

function MiniStat({ label, value, accent, loading }) {
  const color = { violet:'text-violet-300', cyan:'text-cyan-300', emerald:'text-emerald-300' }[accent]
  return (
    <div className="text-center">
      {loading
        ? <div className="skeleton h-8 w-12 rounded-lg mx-auto mb-1" />
        : <p className={`text-3xl font-bold ${color}`}>{value}</p>}
      <p className="text-xs text-white/30">{label}</p>
    </div>
  )
}
