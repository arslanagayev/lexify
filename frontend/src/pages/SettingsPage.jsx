import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../i18n/LangContext'

const API = 'http://localhost:8000'

export default function SettingsPage() {
  const { t } = useLang()
  const { token, user, login } = useAuth()

  const [connected, setConnected] = useState(user?.telegram_bot_connected || false)
  const [tokenInput, setTokenInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    setConnected(user?.telegram_bot_connected || false)
  }, [user])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`${API}/telegram/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token: tokenInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to connect')
      login(token, data)
      setConnected(true)
      setTokenInput('')
      setSuccess('Bot connected! Send /start to it on Telegram.')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`${API}/telegram/setup`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to disconnect')
      login(token, data)
      setConnected(false)
      setSuccess('Bot disconnected.')
    } catch (e) {
      setError(e.message)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold text-white mb-8">{t.settings}</h1>

      {/* Telegram Bot Card */}
      <div className="glass rounded-2xl p-6 border border-white/8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-cyan-500/30 border border-blue-500/20 flex items-center justify-center text-xl">
            ✈️
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{t.telegramBot}</h2>
            {connected && (
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                {t.telegramConnected}
              </span>
            )}
          </div>
        </div>

        {connected ? (
          <ConnectedView t={t} onRemove={handleRemove} removing={removing} error={error} success={success} />
        ) : (
          <SetupView
            t={t}
            tokenInput={tokenInput}
            setTokenInput={setTokenInput}
            onSave={handleSave}
            saving={saving}
            error={error}
            success={success}
          />
        )}
      </div>
    </div>
  )
}

function SetupView({ t, tokenInput, setTokenInput, onSave, saving, error, success }) {
  return (
    <div className="space-y-5">
      {/* Step-by-step instructions */}
      <div className="space-y-2">
        {[t.telegramStep1, t.telegramStep2, t.telegramStep3].map((step, i) => (
          <div key={i} className="flex items-start gap-3 text-sm text-white/60">
            <span className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 text-xs font-bold shrink-0 mt-0.5">
              {i + 1}
            </span>
            <span>{step.replace(/^\d+\.\s*/, '')}</span>
          </div>
        ))}
      </div>

      <form onSubmit={onSave} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-white/40 mb-1.5">
            {t.telegramTokenLabel}
          </label>
          <input
            type="text"
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            placeholder={t.telegramTokenPlaceholder}
            required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white
                       placeholder:text-white/20 font-mono focus:outline-none focus:border-violet-500/50 transition-all"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
            {error}
          </p>
        )}
        {success && (
          <p className="text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || !tokenInput.trim()}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold
                     hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? t.telegramSaving : t.telegramSave}
        </button>
      </form>
    </div>
  )
}

function ConnectedView({ t, onRemove, removing, error, success }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-white/55">{t.telegramConnectedDesc}</p>

      {/* Commands reference */}
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
      {success && (
        <p className="text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2">
          {success}
        </p>
      )}

      <button
        onClick={onRemove}
        disabled={removing}
        className="px-4 py-2 rounded-xl border border-red-500/30 text-red-400/80 hover:text-red-400 hover:bg-red-500/10
                   text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {removing ? t.telegramDisconnecting : t.telegramDisconnect}
      </button>
    </div>
  )
}
