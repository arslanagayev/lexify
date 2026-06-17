import { useState, useEffect } from 'react'
import { useLang } from '../i18n/LangContext'

export default function AdminPanel({ apiBase, token }) {
  const { t } = useLang()
  const [stats, setStats] = useState(null)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    fetch(`${apiBase}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.status === 403) { setDenied(true); throw new Error() } return r.json() })
      .then(setStats)
      .catch(() => {})
  }, [apiBase, token])

  if (denied) {
    return <div className="mt-20 text-center text-white/40">{t.adminDenied}</div>
  }

  const cards = stats ? [
    { label: t.adminTotalUsers, value: stats.total_users, icon: '👥' },
    { label: t.adminTotalWords, value: stats.total_words, icon: '📚' },
    { label: t.adminActiveUsers, value: stats.active_users_7d, icon: '🔥' },
    { label: t.adminTotalReviews, value: stats.total_reviews, icon: '🔁' },
    { label: t.adminTelegramLinked, value: stats.telegram_linked, icon: '✈️' },
    { label: t.adminHealth, value: stats.healthy ? 'OK' : 'ERR', icon: '💚' },
  ] : []

  return (
    <div className="mt-8 max-w-4xl mx-auto animate-fade-up">
      <h2 className="text-xl font-bold grad-text mb-6">🛡️ {t.adminTitle}</h2>
      {!stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 skeleton rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {cards.map((c, i) => (
            <div key={i} className="glass rounded-2xl p-5 border border-white/10">
              <p className="text-2xl mb-1">{c.icon}</p>
              <p className="text-2xl font-bold text-white">{c.value}</p>
              <p className="text-xs text-white/30">{c.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
