import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import SettingsPage from './pages/SettingsPage'
import PrivacyPolicy from './pages/PrivacyPolicy'
import SharedListPage from './pages/SharedListPage'
import LandingPage from './pages/LandingPage'
import Header from './components/Header'
import SearchBar from './components/SearchBar'
import WordGrid from './components/WordGrid'
import ReviewMode from './components/ReviewMode'
import QuizMode from './components/QuizMode'
import StatsPanel from './components/StatsPanel'
import DailyWord from './components/DailyWord'
import { ToastContainer } from './components/Toast'
import FloatingChatWidget from './components/FloatingChatWidget'
import ImportWordsModal from './components/ImportWordsModal'
import DiscoverPanel from './components/DiscoverPanel'
import AdminPanel from './components/AdminPanel'
import OnboardingTour from './components/OnboardingTour'
import ImportListModal from './components/ImportListModal'
import CoursesPage from './components/CoursesPage'
import BottomNav from './components/BottomNav'
import { langFlag } from './utils/languages'
import { topicLabel } from './i18n/courseI18n'
import StoryGeneratorModal from './components/StoryGeneratorModal'
import { exportWordsPdf } from './utils/exportPdf'
import WordMapModal from './components/WordMapModal'
import AchievementsModal from './components/AchievementsModal'
import Confetti from './components/Confetti'
import ErrorBoundary from './components/ErrorBoundary'
import { useLang } from './i18n/LangContext'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function App() {
  const { token, logout } = useAuth()
  const [authPage, setAuthPage] = useState('landing')  // 'landing' | 'login' | 'register' | 'forgot'
  const [openSettings, setOpenSettings] = useState(false)

  if (window.location.pathname === '/privacy') {
    return <PrivacyPolicy />
  }

  if (window.location.pathname.startsWith('/shared/')) {
    return <SharedListPage />
  }

  if (!token) {
    if (authPage === 'register') {
      return (
        <RegisterPage
          onSwitchToLogin={() => setAuthPage('login')}
          onOpenSettings={() => setOpenSettings(true)}
        />
      )
    }
    if (authPage === 'forgot') {
      return <ForgotPasswordPage onSwitchToLogin={() => setAuthPage('login')} />
    }
    if (authPage === 'login') {
      return (
        <LoginPage
          onSwitchToRegister={() => setAuthPage('register')}
          onSwitchToForgot={() => setAuthPage('forgot')}
        />
      )
    }
    return (
      <ErrorBoundary fallback={
        <LoginPage onSwitchToRegister={() => setAuthPage('register')} onSwitchToForgot={() => setAuthPage('forgot')} />
      }>
        <LandingPage
          onGetStarted={() => setAuthPage('register')}
          onLogin={() => setAuthPage('login')}
        />
      </ErrorBoundary>
    )
  }

  return (
    <MainApp
      token={token}
      onLogout={logout}
      initialSettings={openSettings}
      onInitialSettingsConsumed={() => setOpenSettings(false)}
    />
  )
}

let _toastId = 0

function MainApp({ token, onLogout, initialSettings, onInitialSettingsConsumed }) {
  const { t, lang, setLang } = useLang()
  const { user } = useAuth()
  const seenLangs = useRef(new Set())
  const langInitRef = useRef(false)

  // Load the user's saved language once on mount
  useEffect(() => {
    if (!langInitRef.current && user?.language_preference && user.language_preference !== lang) {
      setLang(user.language_preference)
    }
    langInitRef.current = true
  }, [user])  // eslint-disable-line

  // Persist language changes for the logged-in user (single source of truth)
  useEffect(() => {
    if (!token || !langInitRef.current) return
    fetch(`${API}/auth/language`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ lang }),
    }).catch(() => {})
  }, [lang, token])
  const [words, setWords]         = useState([])
  const [query, setQuery]         = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [masteryFilter, setMasteryFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [showImport, setShowImport] = useState(false)
  const [mapWord, setMapWord] = useState(null)
  const [showAchievements, setShowAchievements] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [shareData, setShareData] = useState(null)   // { code, url }
  const [showImportList, setShowImportList] = useState(false)
  const [showStory, setShowStory] = useState(false)
  const [activeCourse, setActiveCourse] = useState(null)

  const fetchActiveCourse = useCallback(async () => {
    try {
      const res = await fetch(`${API}/courses/active`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setActiveCourse(await res.json())
    } catch { /* ignore */ }
  }, [token])
  const [showTour, setShowTour] = useState(false)
  const tourSeenRef = useRef(false)

  const createShareLink = useCallback(async () => {
    try {
      const res = await fetch(`${API}/lists/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: '' }),
      })
      if (!res.ok) return
      const d = await res.json()
      setShareData({ code: d.code, url: d.url })
    } catch { /* ignore */ }
  }, [token])
  const [theme, setTheme] = useState('dark')  // session-only, defaults dark

  useEffect(() => {
    const el = document.documentElement
    if (theme === 'light') el.classList.add('light')
    else el.classList.remove('light')
  }, [theme])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [adding, setAdding]       = useState(false)
  const [addError, setAddError]   = useState(null)
  const [mode, setMode]           = useState('grid')
  const [streak, setStreak]       = useState(0)
  const [toasts, setToasts]       = useState([])

  // Onboarding tour for new users (declared after `loading` to avoid TDZ)
  useEffect(() => {
    if (!loading && words.length === 0 && !tourSeenRef.current) {
      tourSeenRef.current = true
      setShowTour(true)
    }
  }, [loading, words.length])

  // Track how many WordCards are in edit mode (via callbacks)
  const editingCountRef = useRef(0)

  const addToast = useCallback((icon, title, subtitle) => {
    const id = ++_toastId
    setToasts(prev => [...prev, { id, icon, title, subtitle, duration: 4000 }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const onEditOpen  = useCallback(() => { editingCountRef.current++ }, [])
  const onEditClose = useCallback(() => { editingCountRef.current = Math.max(0, editingCountRef.current - 1) }, [])

  useEffect(() => {
    if (initialSettings) {
      setMode('settings')
      onInitialSettingsConsumed()
    }
  }, [initialSettings, onInitialSettingsConsumed])

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }

  const handleUnauth = useCallback(() => {
    onLogout()
  }, [onLogout])

  const fetchWords = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/words`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.status === 401) { handleUnauth(); return }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setWords(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [token, handleUnauth])

  const fetchStreak = useCallback(async () => {
    try {
      const res = await fetch(`${API}/streak`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setStreak(data.streak || 0)
      }
    } catch { /* ignore */ }
  }, [token])

  const checkAchievements = useCallback(async () => {
    try {
      const res = await fetch(`${API}/achievements`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const data = await res.json()
      if (data.newly_unlocked?.length) {
        const byId = Object.fromEntries((data.achievements || []).map(a => [a.id, a]))
        data.newly_unlocked.forEach(id => {
          const a = byId[id]
          if (a) addToast(a.icon || '🏆', t.achievementUnlocked, a.name)
        })
        setConfetti(true)
        setTimeout(() => setConfetti(false), 2600)
      }
    } catch { /* ignore */ }
  }, [token, addToast, t])

  useEffect(() => {
    fetchWords()
    fetchStreak()
    checkAchievements()
    fetchActiveCourse()
  }, [fetchWords, fetchStreak, checkAchievements, fetchActiveCourse])

  const handleCourseChange = useCallback(() => {
    fetchWords()
    fetchStreak()
    fetchActiveCourse()
    setMode('grid')
  }, [fetchWords, fetchStreak, fetchActiveCourse])

  // Polyglot achievement: all 4 interface languages used this session
  useEffect(() => {
    seenLangs.current.add(lang)
    if (seenLangs.current.size >= 4 && token) {
      fetch(`${API}/achievements/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ achievement_id: 'polyglot' }),
      }).then(r => r.ok && r.json()).then(d => { if (d?.unlocked) checkAchievements() }).catch(() => {})
    }
  }, [lang, token, checkAchievements])

  // ── Silent background polling ─────────────────────────────
  useEffect(() => {
    const INTERVAL = 5000

    const poll = async () => {
      if (document.hidden) return            // tab arka planda
      if (editingCountRef.current > 0) return // edit modu açık, atla

      try {
        const res = await fetch(`${API}/words`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const newWords = await res.json()

        setWords(prev => {
          const prevIds = new Set(prev.map(w => w.id))
          const added   = newWords.filter(w => !prevIds.has(w.id))

          // Hiç değişiklik yoksa state'i dokunmadan bırak
          if (added.length === 0 && newWords.length === prev.length) return prev

          if (added.length > 0) {
            const label = added.length === 1
              ? `"${added[0].word}"`
              : `${added.length} kelime`
            addToast('🎉', `Telegram'dan ${label} eklendi!`, added.map(w => w.word).join(', '))
          }
          return newWords
        })
      } catch { /* ağ hatası — sessizce atla */ }
    }

    const id = setInterval(poll, INTERVAL)
    return () => clearInterval(id)
  }, [token, addToast])

  const handleAdd = useCallback(async (word) => {
    if (!word.trim()) return
    setAdding(true)
    setAddError(null)
    try {
      const res = await fetch(`${API}/words`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ word: word.trim() }),
      })
      if (res.status === 401) { handleUnauth(); return }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const detail = err.detail || {}
        if (detail.error_code === 'ai_service_limited') throw new Error('ai_service_limited')
        throw new Error(detail.message || (typeof detail === 'string' ? detail : null) || `HTTP ${res.status}`)
      }
      const newWord = await res.json()
      setWords(prev => [newWord, ...prev])
      setQuery('')
      fetchStreak()
      checkAchievements()
    } catch (e) {
      setAddError(e.message)
    } finally {
      setAdding(false)
    }
  }, [authHeaders, handleUnauth, fetchStreak])

  const handleUpdate = useCallback(async (id, updates) => {
    const res = await fetch(`${API}/words/${id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(updates),
    })
    if (res.status === 401) { handleUnauth(); return }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const updated = await res.json()
    setWords(prev => prev.map(w => (w.id === id ? updated : w)))
    return updated
  }, [authHeaders, handleUnauth])

  const handleDelete = useCallback(async (id) => {
    const res = await fetch(`${API}/words/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 401) { handleUnauth(); return }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    setWords(prev => prev.filter(w => w.id !== id))
  }, [token, handleUnauth])

  const handleReview = useCallback(async (id, known, quality = null) => {
    const res = await fetch(`${API}/words/${id}/review`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ known, quality }),
    })
    if (res.status === 401) { handleUnauth(); return }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const updated = await res.json()
    setWords(prev => prev.map(w => (w.id === id ? updated : w)))
    fetchStreak()
    checkAchievements()
    return updated
  }, [authHeaders, handleUnauth, fetchStreak])

  const allTags = [...new Set(
    words.flatMap(w => (w.tags || '').split(',').map(t => t.trim()).filter(Boolean))
  )].sort()

  const filtered = words.filter(w => {
    const matchText = !query.trim() ||
      w.word?.toLowerCase().includes(query.toLowerCase()) ||
      w.chinese_meaning?.includes(query) ||
      w.part_of_speech?.toLowerCase().includes(query.toLowerCase()) ||
      (w.tags || '').toLowerCase().includes(query.toLowerCase())
    const matchTag = !tagFilter ||
      (w.tags || '').split(',').map(t => t.trim()).includes(tagFilter)
    const matchMastery = masteryFilter === 'all' ||
      (w.mastery_status || 'new') === masteryFilter
    return matchText && matchTag && matchMastery
  })

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'oldest':   return new Date(a.created_at) - new Date(b.created_at)
      case 'az':       return (a.word || '').localeCompare(b.word || '')
      case 'za':       return (b.word || '').localeCompare(a.word || '')
      case 'hardest':  return (b.difficulty_score || 0) - (a.difficulty_score || 0)
      case 'reviewed': return (b.review_count || 0) - (a.review_count || 0)
      default:         return new Date(b.created_at) - new Date(a.created_at) // newest
    }
  })

  const ownedWords = new Set(words.map(w => (w.word || '').toLowerCase()))

  const masteryCounts = words.reduce((acc, w) => {
    const s = w.mastery_status || 'new'
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})

  return (
    <div className="min-h-screen font-sans">
      <Header
        mode={mode}
        onModeChange={setMode}
        count={words.length}
        streak={streak}
        onLogout={onLogout}
        onOpenAchievements={() => setShowAchievements(true)}
        theme={theme}
        onToggleTheme={() => setTheme(th => th === 'dark' ? 'light' : 'dark')}
        activeCourse={activeCourse}
        onOpenCourses={() => setMode('courses')}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {mode === 'settings' ? (
          <SettingsPage />
        ) : mode === 'discover' ? (
          <DiscoverPanel apiBase={API} token={token} onAdded={fetchWords} />
        ) : mode === 'admin' ? (
          <ErrorBoundary silent>
            <AdminPanel apiBase={API} token={token} />
          </ErrorBoundary>
        ) : mode === 'courses' ? (
          <ErrorBoundary silent>
            <CoursesPage apiBase={API} token={token} onCourseChange={handleCourseChange} />
          </ErrorBoundary>
        ) : (
          <>
            {mode !== 'stats' && mode !== 'quiz' && (
              <SearchBar
                value={query}
                onChange={setQuery}
                onAdd={handleAdd}
                onRefresh={fetchWords}
                adding={adding}
                addError={addError}
                onClearAddError={() => setAddError(null)}
              />
            )}

            {error && <BackendError message={error} onRetry={fetchWords} t={t} />}

            {!error && loading && <SkeletonGrid />}

            {!error && !loading && (
              <>
                {mode === 'grid' && (
                  <>
                    <DailyWord words={words} targetLang={activeCourse?.target_language || 'en'} level={activeCourse?.level} />
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <FilterBar
                        active={masteryFilter}
                        onChange={setMasteryFilter}
                        counts={masteryCounts}
                        total={words.length}
                        t={t}
                      />
                      <div className="flex items-center gap-2 mt-5 flex-wrap">
                        <select
                          value={sortBy}
                          onChange={e => setSortBy(e.target.value)}
                          className="text-xs px-3 py-1.5 rounded-full glass border border-white/10 text-white/60 hover:text-white transition-all focus:outline-none cursor-pointer"
                        >
                          <option value="newest">{t.sortNewest}</option>
                          <option value="oldest">{t.sortOldest}</option>
                          <option value="az">{t.sortAZ}</option>
                          <option value="za">{t.sortZA}</option>
                          <option value="hardest">{t.sortHardest}</option>
                          <option value="reviewed">{t.sortReviewed}</option>
                        </select>
                        <button
                          onClick={() => setShowImport(true)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full glass border border-white/10 text-white/50 hover:text-white transition-all"
                        >
                          📥 {t.importWordsBtn}
                        </button>
                        {words.length > 0 && (
                          <button
                            onClick={createShareLink}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full glass border border-white/10 text-white/50 hover:text-white transition-all"
                          >
                            🔗 {t.shareListBtn}
                          </button>
                        )}
                        <button
                          onClick={() => setShowImportList(true)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full glass border border-white/10 text-white/50 hover:text-white transition-all"
                        >
                          📲 {t.importListBtn}
                        </button>
                        {words.length > 0 && (
                          <button
                            onClick={() => exportWordsPdf(words, {
                              title: t.pdfTitle, meaning: t.meaning, example: t.example,
                              source: t.source, words: t.pdfWords,
                              saveBtn: t.pdfSave, hint: t.pdfHint, popupBlocked: t.pdfPopup,
                            })}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full glass border border-white/10 text-white/50 hover:text-white transition-all"
                          >
                            📄 {t.exportPdf}
                          </button>
                        )}
                        {words.length >= 2 && (
                          <button
                            onClick={() => setShowStory(true)}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full glass border border-white/10 text-white/50 hover:text-white transition-all"
                          >
                            📖 {t.storyBtn}
                          </button>
                        )}
                      </div>
                    </div>
                    {allTags.length > 0 && (
                      <TagFilter
                        tags={allTags}
                        active={tagFilter}
                        onChange={setTagFilter}
                        t={t}
                        lang={lang}
                      />
                    )}
                    <WordGrid
                  words={sorted}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onEditOpen={onEditOpen}
                  onEditClose={onEditClose}
                  onOpenMap={setMapWord}
                  token={token}
                  apiBase={API}
                  ownedWords={ownedWords}
                  onAddWord={handleAdd}
                  targetLang={activeCourse?.target_language || 'en'}
                  baseLang={activeCourse?.base_language || 'zh'}
                  level={activeCourse?.level}
                />
                  </>
                )}
                {mode === 'review' && (
                  <ReviewMode words={words} onReview={handleReview} token={token} apiBase={API}
                    targetLang={activeCourse?.target_language || 'en'}
                    baseLang={activeCourse?.base_language || 'zh'}
                    level={activeCourse?.level} />
                )}
                {mode === 'quiz' && (
                  <QuizMode words={words} token={token} />
                )}
                {mode === 'stats' && (
                  <StatsPanel
                    words={words}
                    apiBase={API}
                    token={token}
                    onImportComplete={fetchWords}
                  />
                )}
              </>
            )}
          </>
        )}
      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <BottomNav mode={mode} onModeChange={setMode} isAdmin={user?.is_admin} />

      <FloatingChatWidget apiBase={API} token={token} />

      {showImport && (
        <ImportWordsModal
          apiBase={API}
          token={token}
          onClose={() => setShowImport(false)}
          onComplete={fetchWords}
        />
      )}

      {mapWord && (
        <WordMapModal word={mapWord} words={words} onClose={() => setMapWord(null)} />
      )}

      {showAchievements && (
        <ErrorBoundary silent>
          <AchievementsModal apiBase={API} token={token} onClose={() => setShowAchievements(false)} />
        </ErrorBoundary>
      )}

      {confetti && <Confetti />}

      {showTour && (
        <ErrorBoundary silent>
          <OnboardingTour onClose={() => setShowTour(false)} />
        </ErrorBoundary>
      )}

      {shareData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShareData(null)}>
          <div className="glass rounded-3xl border border-white/10 shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold grad-text mb-2">{t.shareListTitle}</h2>
            <p className="text-white/45 text-sm mb-4">{t.shareListDesc}</p>

            <label className="text-[11px] uppercase tracking-widest text-white/30">{t.shareCodeLabel}</label>
            <div className="flex gap-2 mt-1 mb-3">
              <input readOnly value={shareData.code}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 font-mono tracking-wider" />
              <button
                onClick={() => navigator.clipboard?.writeText(shareData.code)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-sky-500 text-white text-sm font-medium whitespace-nowrap">
                {t.copyCode}
              </button>
            </div>

            <label className="text-[11px] uppercase tracking-widest text-white/30">{t.shareLinkLabel}</label>
            <div className="flex gap-2 mt-1">
              <input readOnly value={shareData.url}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80" />
              <button
                onClick={() => navigator.clipboard?.writeText(shareData.url)}
                className="px-4 py-2 rounded-xl glass border border-white/10 text-white/70 hover:text-white text-sm font-medium whitespace-nowrap">
                {t.copyLink}
              </button>
            </div>

            <button onClick={() => setShareData(null)}
              className="mt-5 w-full py-2 rounded-xl glass border border-white/10 text-white/50 hover:text-white text-sm transition-all">
              {t.importDone}
            </button>
          </div>
        </div>
      )}

      {showImportList && (
        <ErrorBoundary silent>
          <ImportListModal apiBase={API} token={token} onClose={() => setShowImportList(false)} onImported={fetchWords} />
        </ErrorBoundary>
      )}

      {showStory && (
        <ErrorBoundary silent>
          <StoryGeneratorModal words={words} apiBase={API} token={token} targetLang={activeCourse?.target_language || 'en'} level={activeCourse?.level} onClose={() => setShowStory(false)} />
        </ErrorBoundary>
      )}
    </div>
  )
}

function FilterBar({ active, onChange, counts, total, t }) {
  const items = [
    { key: 'all',       label: t.filterAll,      count: total,                dot: 'bg-white/40',     on: 'bg-violet-500/20 border-violet-500/40 text-violet-300' },
    { key: 'learning',  label: t.filterLearning, count: counts.learning || 0, dot: 'bg-amber-400',    on: 'bg-amber-500/20 border-amber-500/40 text-amber-300' },
    { key: 'mastered',  label: t.filterMastered, count: counts.mastered || 0, dot: 'bg-emerald-400',  on: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' },
    { key: 'new',       label: t.filterNew,      count: counts.new || 0,      dot: 'bg-sky-400',      on: 'bg-sky-500/20 border-sky-500/40 text-sky-300' },
  ]
  return (
    <div className="flex items-center gap-2 mt-5 flex-wrap">
      {items.map(it => (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
            active === it.key ? it.on : 'border-white/10 text-white/40 hover:text-white/70'
          }`}
        >
          {it.key !== 'all' && <span className={`w-1.5 h-1.5 rounded-full ${it.dot}`} />}
          {it.label}
          <span className="text-white/30">{it.count}</span>
        </button>
      ))}
    </div>
  )
}

function TagFilter({ tags, active, onChange, t, lang }) {
  return (
    <div className="flex items-center gap-2 mt-4 flex-wrap">
      <button
        onClick={() => onChange('')}
        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
          !active
            ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
            : 'border-white/10 text-white/35 hover:text-white/60'
        }`}
      >
        {t.allTags}
      </button>
      {tags.map(tag => (
        <button
          key={tag}
          onClick={() => onChange(active === tag ? '' : tag)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
            active === tag
              ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
              : 'border-white/10 text-white/35 hover:text-white/60'
          }`}
        >
          {topicLabel(lang, tag)}
        </button>
      ))}
    </div>
  )
}

function BackendError({ message, onRetry, t }) {
  return (
    <div className="mt-16 max-w-md mx-auto glass rounded-2xl p-8 text-center border border-red-500/20 bg-red-500/5">
      <div className="text-4xl mb-4">🔴</div>
      <p className="text-white/70 font-semibold mb-2">{t.backendError}</p>
      <p className="text-white/30 text-sm font-mono mb-1">{import.meta.env.VITE_API_URL || 'localhost:8000'}</p>
      <p className="text-white/20 text-xs mb-6">{t.backendHint}</p>
      <button
        onClick={onRetry}
        className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-500/20 to-cyan-500/20
                   border border-white/10 text-white/60 hover:text-white text-sm transition-all"
      >
        {t.retry}
      </button>
      <p className="text-red-400/50 text-xs mt-4 font-mono">{message}</p>
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="glass rounded-2xl p-6 h-72 flex flex-col gap-4">
          <div className="flex justify-between">
            <div className="skeleton h-7 w-36 rounded-lg" />
            <div className="skeleton h-5 w-16 rounded-full" />
          </div>
          <div className="skeleton h-4 w-24 rounded-md" />
          <div className="skeleton flex-1 rounded-xl" />
          <div className="skeleton h-3 w-48 rounded-md" />
          <div className="skeleton h-3 w-40 rounded-md" />
        </div>
      ))}
    </div>
  )
}
