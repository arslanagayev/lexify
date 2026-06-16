import { useState } from 'react'
import { useLang, LANG_OPTIONS } from '../i18n/LangContext'
import { useAuth } from '../context/AuthContext'
import logoSrc from '../assets/logo.png'

export default function Header({ mode, onModeChange, count, streak, onLogout }) {
  const { lang, setLang, t } = useLang()
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-2xl bg-black/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <img src={logoSrc} alt="Lexify" className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-violet-500/25" />
          <div className="hidden sm:block">
            <p className="text-base font-bold grad-text leading-none">Lexify</p>
            <p className="text-[11px] text-white/25 leading-none mt-0.5">{t.wordCount(count)}</p>
          </div>
          {/* Streak badge */}
          {streak > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/25">
              <span className="text-sm leading-none">🔥</span>
              <span className="text-xs font-semibold text-orange-300">{t.streakDays(streak)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="glass rounded-xl p-1 flex gap-1">
            {[
              { key: 'grid',     label: t.grid,     icon: <GridIcon /> },
              { key: 'review',   label: t.review,   icon: <CardIcon /> },
              { key: 'quiz',     label: t.quiz,     icon: <QuizIcon /> },
              { key: 'discover', label: t.discover, icon: <CompassIcon /> },
              { key: 'stats',    label: t.stats,    icon: <ChartIcon /> },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => onModeChange(key)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                  mode === key
                    ? 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-md shadow-violet-500/30'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Language selector */}
          <LangSelector lang={lang} setLang={setLang} />

          {/* User menu */}
          {user && <UserMenu user={user} onLogout={onLogout} onOpenSettings={() => onModeChange('settings')} />}
        </div>
      </div>
    </header>
  )
}

function UserMenu({ user, onLogout, onOpenSettings }) {
  const [open, setOpen] = useState(false)
  const { t } = useLang()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="glass rounded-xl px-2.5 py-1.5 flex items-center gap-2 text-white/60 hover:text-white transition-colors"
      >
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {(user.first_name?.[0] || user.username?.[0] || '?').toUpperCase()}
        </div>
        <span className="hidden sm:inline text-xs font-medium max-w-[80px] truncate">
          {user.first_name || user.username}
        </span>
        <ChevronIcon className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 glass rounded-xl p-3 min-w-[180px] shadow-2xl shadow-black/40">
            <div className="px-1 pb-2 mb-2 border-b border-white/8">
              <p className="text-white/80 text-sm font-semibold">{user.first_name} {user.last_name}</p>
              <p className="text-white/30 text-xs">@{user.username}</p>
            </div>
            <button
              onClick={() => { setOpen(false); onOpenSettings() }}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm text-white/55 hover:text-white hover:bg-white/5 transition-colors"
            >
              <SettingsIcon className="w-4 h-4" />
              {t.settings}
            </button>
            <button
              onClick={() => { setOpen(false); onLogout() }}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/8 transition-colors"
            >
              <LogoutIcon className="w-4 h-4" />
              {t.signOut}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function LangSelector({ lang, setLang }) {
  const [open, setOpen] = useState(false)
  const current = LANG_OPTIONS.find(l => l.code === lang) || LANG_OPTIONS[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="glass rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 text-white/60 hover:text-white transition-colors"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="hidden sm:inline text-xs font-medium">{current.label}</span>
        <ChevronIcon className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 glass rounded-xl p-1 min-w-[148px] shadow-2xl shadow-black/40">
            {LANG_OPTIONS.map(l => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setOpen(false) }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  lang === l.code
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'text-white/55 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="text-base">{l.flag}</span>
                <span>{l.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ── Icons ─────────────────────────────────────────────────── */

function GridIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  )
}
function CardIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  )
}
function QuizIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
    </svg>
  )
}
function CompassIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.12 9.88l-1.06 4.24-4.24 1.06 1.06-4.24 4.24-1.06z" />
    </svg>
  )
}
function ChartIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  )
}
function ChevronIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  )
}
function LogoutIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  )
}
function SettingsIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
