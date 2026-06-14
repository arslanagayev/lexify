import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../i18n/LangContext'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const CODE_TTL = 300

export default function SettingsPage() {
  const { t } = useLang()
  const { token, user, login } = useAuth()

  const [linked, setLinked] = useState(user?.telegram_linked || false)
  const [generating, setGenerating] = useState(false)
  const [codeData, setCodeData] = useState(null)   // { code, expiresAt }
  const [timeLeft, setTimeLeft] = useState(0)
  const [copied, setCopied] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    setLinked(user?.telegram_linked || false)
  }, [user])

  useEffect(() => {
    if (!codeData) return
    const tick = () => {
      const left = Math.max(0, Math.round((codeData.expiresAt - Date.now()) / 1000))
      setTimeLeft(left)
      if (left === 0) {
        setCodeData(null)
        clearInterval(timerRef.current)
      }
    }
    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => clearInterval(timerRef.current)
  }, [codeData])

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    setCodeData(null)
    try {
      const res = await fetch(`${API}/telegram/generate-link-code`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to generate code')
      setCodeData({ code: data.code, expiresAt: Date.now() + data.expires_in_seconds * 1000 })
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = (code) => {
    navigator.clipboard.writeText(`/link ${code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDisconnect = async () => {
    setRemoving(true)
    setError(null)
    try {
      const res = await fetch(`${API}/telegram/link`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to disconnect')
      login(token, data)
      setLinked(false)
      setCodeData(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold text-white mb-8">{t.settings}</h1>

      <div className="glass rounded-2xl p-6 border border-white/8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-cyan-500/30 border border-blue-500/20 flex items-center justify-center text-xl">
            ✈️
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{t.telegramBot}</h2>
            {linked && (
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                {t.telegramConnected}
              </span>
            )}
          </div>
        </div>

        {linked ? (
          <ConnectedView
            t={t}
            onDisconnect={handleDisconnect}
            removing={removing}
            error={error}
          />
        ) : (
          <SetupView
            t={t}
            generating={generating}
            codeData={codeData}
            timeLeft={timeLeft}
            copied={copied}
            error={error}
            onGenerate={handleGenerate}
            onCopy={handleCopy}
          />
        )}
      </div>

      <p className="mt-8 text-center text-white/20 text-xs">
        <a href="/privacy" className="hover:text-white/40 transition-colors">Privacy Policy</a>
      </p>
    </div>
  )
}

function SetupView({ t, generating, codeData, timeLeft, copied, error, onGenerate, onCopy }) {
  const mins = Math.floor(timeLeft / 60)
  const secs = String(timeLeft % 60).padStart(2, '0')

  return (
    <div className="space-y-5">
      <p className="text-sm text-white/55">
        {t.telegramLinkInstruction
          ? t.telegramLinkInstruction('______').split('\n')[0].replace('______', '').trim() +
            ' — ' + t.telegramCmdLink
          : 'Generate a code and send it to @LexifyAssistantBot on Telegram.'}
      </p>

      {codeData && timeLeft > 0 ? (
        <div className="space-y-4">
          {/* Code display */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center space-y-3">
            <p className="text-xs text-white/40 uppercase tracking-wider">Telegram'da şunu yaz</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl font-mono font-bold text-white tracking-[0.3em]">
                /link {codeData.code}
              </span>
              <button
                onClick={() => onCopy(codeData.code)}
                className="px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-medium hover:bg-violet-500/30 transition-all"
              >
                {copied ? t.telegramCodeCopied : t.telegramCopyCode}
              </button>
            </div>
            <p className="text-xs text-white/30">
              @LexifyAssistantBot &nbsp;·&nbsp;
              <span className={timeLeft < 60 ? 'text-red-400' : 'text-white/40'}>
                {mins}:{secs}
              </span>
            </p>
          </div>

          <p className="text-xs text-white/30 text-center">{t.telegramCodeExpires}</p>

          <button
            onClick={onGenerate}
            disabled={generating}
            className="w-full py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:text-white/70 hover:border-white/20 transition-all disabled:opacity-50"
          >
            {t.telegramGenerateCode}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Instructions */}
          <div className="space-y-2">
            {[
              '1. Aşağıdaki butona tıkla → 6 haneli kod üret',
              '2. Telegram\'da @LexifyAssistantBot\'a yaz: /link KOD',
              '3. Hesabın bağlanır, komutları kullanabilirsin',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3 text-sm text-white/50">
                <span className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{step.replace(/^\d+\.\s*/, '')}</span>
              </div>
            ))}
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
              {error}
            </p>
          )}

          <button
            onClick={onGenerate}
            disabled={generating}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold
                       hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? t.telegramGenerating : t.telegramGenerateCode}
          </button>
        </div>
      )}
    </div>
  )
}

function ConnectedView({ t, onDisconnect, removing, error }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-white/55">{t.telegramConnectedDesc}</p>

      <div className="bg-white/3 rounded-xl p-4 border border-white/8 space-y-1.5">
        <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2">
          {t.telegramCommands}
        </p>
        {[t.telegramCmdAdd, t.telegramCmdQuery, t.telegramCmdReview, t.telegramCmdQuiz].map((cmd, i) => (
          <p key={i} className="text-xs font-mono text-white/50">{cmd}</p>
        ))}
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
          {error}
        </p>
      )}

      <button
        onClick={onDisconnect}
        disabled={removing}
        className="px-4 py-2 rounded-xl border border-red-500/30 text-red-400/80 hover:text-red-400 hover:bg-red-500/10
                   text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {removing ? t.telegramDisconnecting : t.telegramDisconnect}
      </button>
    </div>
  )
}
