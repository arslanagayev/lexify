import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import SettingsPage from './pages/SettingsPage'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Header from './components/Header'
import SearchBar from './components/SearchBar'
import WordGrid from './components/WordGrid'
import ReviewMode from './components/ReviewMode'
import QuizMode from './components/QuizMode'
import StatsPanel from './components/StatsPanel'
import DailyWord from './components/DailyWord'
import { ToastContainer } from './components/Toast'
import FloatingChatWidget from './components/FloatingChatWidget'
import { useLang } from './i18n/LangContext'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function App() {
  const { token, logout } = useAuth()
  const [authPage, setAuthPage] = useState('login')  // 'login' | 'register' | 'forgot'
  const [openSettings, setOpenSettings] = useState(false)

  if (window.location.pathname === '/privacy') {
    return <PrivacyPolicy />
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
    return (
      <LoginPage
        onSwitchToRegister={() => setAuthPage('register')}
        onSwitchToForgot={() => setAuthPage('forgot')}
      />
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
  const { t } = useLang()
  const [words, setWords]         = useState([])
  const [query, setQuery]         = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [adding, setAdding]       = useState(false)
  const [addError, setAddError]   = useState(null)
  const [mode, setMode]           = useState('grid')
  const [streak, setStreak]       = useState(0)
  const [toasts, setToasts]       = useState([])

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

  useEffect(() => {
    fetchWords()
    fetchStreak()
  }, [fetchWords, fetchStreak])

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

  const handleReview = useCallback(async (id, known) => {
    const res = await fetch(`${API}/words/${id}/review`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ known }),
    })
    if (res.status === 401) { handleUnauth(); return }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const updated = await res.json()
    setWords(prev => prev.map(w => (w.id === id ? updated : w)))
    fetchStreak()
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
    return matchText && matchTag
  })

  return (
    <div className="min-h-screen font-sans">
      <Header
        mode={mode}
        onModeChange={setMode}
        count={words.length}
        streak={streak}
        onLogout={onLogout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {mode === 'settings' ? (
          <SettingsPage />
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
                    <DailyWord words={words} />
                    {allTags.length > 0 && (
                      <TagFilter
                        tags={allTags}
                        active={tagFilter}
                        onChange={setTagFilter}
                        t={t}
                      />
                    )}
                    <WordGrid
                  words={filtered}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onEditOpen={onEditOpen}
                  onEditClose={onEditClose}
                />
                  </>
                )}
                {mode === 'review' && (
                  <ReviewMode words={words} onReview={handleReview} />
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

      <FloatingChatWidget apiBase={API} token={token} />
    </div>
  )
}

function TagFilter({ tags, active, onChange, t }) {
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
          {tag}
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
