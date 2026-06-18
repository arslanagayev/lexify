import { useLang } from '../i18n/LangContext'

// Mobile-only bottom navigation. Hidden on md+ (desktop keeps the top nav).
export default function BottomNav({ mode, onModeChange, isAdmin }) {
  const { t } = useLang()
  const items = [
    { key: 'grid',     icon: '📋', label: t.grid },
    { key: 'review',   icon: '🔄', label: t.review },
    { key: 'quiz',     icon: '❓', label: t.quiz },
    { key: 'discover', icon: '🧭', label: t.discover },
    { key: 'stats',    icon: '📊', label: t.stats },
    ...(isAdmin ? [{ key: 'admin', icon: '🛡️', label: t.admin }] : []),
  ]
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex border-t border-white/10 bg-black/70 backdrop-blur-2xl">
      {items.map(({ key, icon, label }) => (
        <button
          key={key}
          onClick={() => onModeChange(key)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] transition-colors ${
            mode === key ? 'text-violet-300' : 'text-white/45'
          }`}
        >
          <span className="text-base leading-none">{icon}</span>
          <span className="text-[10px] leading-none truncate max-w-full px-0.5">{label}</span>
        </button>
      ))}
    </nav>
  )
}
