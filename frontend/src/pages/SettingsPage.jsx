import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../i18n/LangContext'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const CODE_TTL = 300

export default function SettingsPage() {
  const { t } = useLang()
  const { token, user, login, logout } = useAuth()

  // ── Telegram state ────────────────────────────────────────────
  const [linked, setLinked]       = useState(user?.telegram_linked || false)
  const [generating, setGenerating] = useState(false)
  const [codeData, setCodeData]   = useState(null)
  const [timeLeft, setTimeLeft]   = useState(0)
  const [copied, setCopied]       = useState(false)
  const [removing, setRemoving]   = useState(false)
  const [tgError, setTgError]     = useState(null)
  const timerRef = useRef(null)

  useEffect(() => { setLinked(user?.telegram_linked || false) }, [user])

  useEffect(() => {
    if (!codeData) return
    const tick = () => {
      const left = Math.max(0, Math.round((codeData.expiresAt - Date.now()) / 1000))
      setTimeLeft(left)
      if (left === 0) { setCodeData(null); clearInterval(timerRef.current) }
    }
    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => clearInterval(timerRef.current)
  }, [codeData])

  const handleGenerate = async () => {
    setGenerating(true); setTgError(null); setCodeData(null)
    try {
      const res = await fetch(`${API}/telegram/generate-link-code`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed')
      setCodeData({ code: data.code, expiresAt: Date.now() + data.expires_in_seconds * 1000 })
    } catch (e) { setTgError(e.message) } finally { setGenerating(false) }
  }

  const handleCopy = (code) => {
    navigator.clipboard.writeText(`/link ${code}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const handleDisconnect = async () => {
    setRemoving(true); setTgError(null)
    try {
      const res = await fetch(`${API}/telegram/link`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed')
      login(token, data); setLinked(false); setCodeData(null)
    } catch (e) { setTgError(e.message) } finally { setRemoving(false) }
  }

  // ── Profile state ─────────────────────────────────────────────
  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name || '',
    last_name:  user?.last_name  || '',
    username:   user?.username   || '',
  })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg]       = useState(null) // {ok, text}

  const handleProfileSave = async () => {
    setProfileSaving(true); setProfileMsg(null)
    try {
      const res = await fetch(`${API}/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(profileForm),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.detail === 'Username already taken' ? t.usernameTaken : (data.detail || 'Error')
        throw new Error(msg)
      }
      login(token, data)
      setProfileMsg({ ok: true, text: t.profileSaved })
    } catch (e) {
      setProfileMsg({ ok: false, text: e.message })
    } finally {
      setProfileSaving(false)
    }
  }

  // ── Password state ────────────────────────────────────────────
  const [weeklyEmail, setWeeklyEmail] = useState(user?.weekly_email !== false)
  const toggleWeeklyEmail = async () => {
    const next = !weeklyEmail
    setWeeklyEmail(next)
    try {
      await fetch(`${API}/auth/weekly-email`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: next }),
      })
    } catch {
      setWeeklyEmail(!next)  // revert on failure
    }
  }

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg]       = useState(null)

  const handlePasswordUpdate = async () => {
    setPwMsg(null)
    if (pwForm.next.length < 6)   return setPwMsg({ ok: false, text: t.passwordTooShort })
    if (pwForm.next !== pwForm.confirm) return setPwMsg({ ok: false, text: t.passwordMismatch })
    setPwSaving(true)
    try {
      const res = await fetch(`${API}/auth/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = res.status === 401 ? t.wrongPassword : (data.detail || 'Error')
        throw new Error(msg)
      }
      setPwMsg({ ok: true, text: t.passwordUpdated })
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (e) {
      setPwMsg({ ok: false, text: e.message })
    } finally {
      setPwSaving(false)
    }
  }

  // ── Delete Account state ──────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword]   = useState('')
  const [deleting, setDeleting]               = useState(false)
  const [deleteError, setDeleteError]         = useState(null)

  const handleDeleteAccount = async () => {
    setDeleting(true); setDeleteError(null)
    try {
      const res = await fetch(`${API}/auth/account`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: deletePassword }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(res.status === 401 ? t.wrongPassword : (data.detail || 'Error'))
      }
      logout()
    } catch (e) {
      setDeleteError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-6">
      <h1 className="text-2xl font-bold text-white mb-2">{t.settings}</h1>

      {/* ── Profile Information ────────────────────────────────── */}
      <Section icon="👤" title={t.profileInfo}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <SettingsField
              label={t.firstName}
              value={profileForm.first_name}
              onChange={v => setProfileForm(f => ({ ...f, first_name: v }))}
            />
            <SettingsField
              label={t.lastName}
              value={profileForm.last_name}
              onChange={v => setProfileForm(f => ({ ...f, last_name: v }))}
            />
          </div>
          <SettingsField
            label={t.usernameLabel}
            value={profileForm.username}
            onChange={v => setProfileForm(f => ({ ...f, username: v }))}
          />
          {profileMsg && (
            <Msg ok={profileMsg.ok}>{profileMsg.text}</Msg>
          )}
          <button
            onClick={handleProfileSave}
            disabled={profileSaving}
            className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium
                       transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {profileSaving ? t.savingProfile : t.saveProfile}
          </button>
        </div>
      </Section>

      {/* ── Change Password ───────────────────────────────────── */}
      <Section icon="🔑" title={t.changePassword}>
        <div className="space-y-3">
          <SettingsField
            label={t.currentPassword} type="password"
            value={pwForm.current}
            onChange={v => setPwForm(f => ({ ...f, current: v }))}
          />
          <SettingsField
            label={t.newPassword} type="password"
            value={pwForm.next}
            onChange={v => setPwForm(f => ({ ...f, next: v }))}
          />
          <SettingsField
            label={t.confirmPassword} type="password"
            value={pwForm.confirm}
            onChange={v => setPwForm(f => ({ ...f, confirm: v }))}
          />
          {pwMsg && <Msg ok={pwMsg.ok}>{pwMsg.text}</Msg>}
          <button
            onClick={handlePasswordUpdate}
            disabled={pwSaving}
            className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium
                       transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pwSaving ? t.updatingPassword : t.updatePassword}
          </button>
        </div>
      </Section>

      {/* ── Telegram Bot ──────────────────────────────────────── */}
      <Section icon="✈️" title={t.telegramBot} badge={linked ? t.telegramConnected : null}>
        {linked ? (
          <ConnectedView t={t} onDisconnect={handleDisconnect} removing={removing} error={tgError} />
        ) : (
          <SetupView
            t={t} generating={generating} codeData={codeData} timeLeft={timeLeft}
            copied={copied} error={tgError} onGenerate={handleGenerate} onCopy={handleCopy}
          />
        )}
      </Section>

      <Section icon="📧" title={t.weeklyEmailTitle}>
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-sm text-white/55">{t.weeklyEmailDesc}</span>
          <button
            onClick={toggleWeeklyEmail}
            type="button"
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${weeklyEmail ? 'bg-violet-500' : 'bg-white/15'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${weeklyEmail ? 'translate-x-5' : ''}`} />
          </button>
        </label>
      </Section>

      {/* ── Danger Zone ───────────────────────────────────────── */}
      <div className="glass rounded-2xl p-6 border border-red-500/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center text-xl">
            ⚠️
          </div>
          <h2 className="text-lg font-semibold text-red-400">{t.dangerZone}</h2>
        </div>
        <p className="text-sm text-white/45 mb-4">{t.deleteAccountDesc}</p>
        <button
          onClick={() => { setShowDeleteModal(true); setDeletePassword(''); setDeleteError(null) }}
          className="px-5 py-2 rounded-xl border border-red-500/40 text-red-400 text-sm font-medium
                     hover:bg-red-500/10 transition-all"
        >
          {t.deleteAccount}
        </button>
      </div>

      <p className="text-center text-white/20 text-xs">
        <a href="/privacy" className="hover:text-white/40 transition-colors">Privacy Policy</a>
      </p>

      {/* ── Delete Modal ──────────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
             style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="glass w-full max-w-sm rounded-2xl p-7 border border-white/10 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">{t.deleteConfirmTitle}</h3>
            <p className="text-sm text-white/50 mb-5">{t.deleteConfirmDesc}</p>
            <SettingsField
              label={t.deletePasswordLabel} type="password"
              value={deletePassword}
              onChange={setDeletePassword}
            />
            {deleteError && <Msg ok={false} className="mt-3">{deleteError}</Msg>}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-white/15 text-white/60 text-sm
                           hover:text-white/80 hover:border-white/25 transition-all disabled:opacity-40"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || !deletePassword}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium
                           transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? t.deleting : t.deletePermanently}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────

function Section({ icon, title, badge, children }) {
  return (
    <div className="glass rounded-2xl p-6 border border-white/8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20
                        border border-violet-500/15 flex items-center justify-center text-xl">
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {badge && (
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              {badge}
            </span>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}

function SettingsField({ label, type = 'text', value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-white/40 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white
                   placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all"
      />
    </div>
  )
}

function Msg({ ok, children, className = '' }) {
  return (
    <p className={`text-sm px-3 py-2 rounded-xl ${ok
      ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
      : 'text-red-400 bg-red-500/10 border border-red-500/20'
    } ${className}`}>
      {children}
    </p>
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
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center space-y-3">
            <p className="text-xs text-white/40 uppercase tracking-wider">{t.telegramWriteThis}</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl font-mono font-bold text-white tracking-[0.3em]">
                /link {codeData.code}
              </span>
              <button
                onClick={() => onCopy(codeData.code)}
                className="px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/30
                           text-violet-300 text-xs font-medium hover:bg-violet-500/30 transition-all"
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
            onClick={onGenerate} disabled={generating}
            className="w-full py-2.5 rounded-xl border border-white/10 text-white/50 text-sm
                       hover:text-white/70 hover:border-white/20 transition-all disabled:opacity-50"
          >
            {t.telegramGenerateCode}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            {[t.telegramStep1, t.telegramStep2, t.telegramStep3].map((step, i) => (
              <div key={i} className="flex items-start gap-3 text-sm text-white/50">
                <span className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/30
                                 flex items-center justify-center text-violet-300 text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>
          {error && <Msg ok={false}>{error}</Msg>}
          <button
            onClick={onGenerate} disabled={generating}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white
                       font-semibold hover:opacity-90 active:scale-[0.98] transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
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
      {error && <Msg ok={false}>{error}</Msg>}
      <button
        onClick={onDisconnect} disabled={removing}
        className="px-4 py-2 rounded-xl border border-red-500/30 text-red-400/80
                   hover:text-red-400 hover:bg-red-500/10 text-sm transition-all
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {removing ? t.telegramDisconnecting : t.telegramDisconnect}
      </button>
    </div>
  )
}
