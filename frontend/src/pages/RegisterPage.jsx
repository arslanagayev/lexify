import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../i18n/LangContext'
import { AuthLayout } from './LoginPage'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const RESEND_COOLDOWN = 30

export default function RegisterPage({ onSwitchToLogin, onOpenSettings }) {
  const { login } = useAuth()
  const { t } = useLang()
  const [step, setStep]         = useState('form')  // 'form' | 'verify'
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  // Form fields
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [firstName, setFirstName]   = useState('')
  const [lastName, setLastName]     = useState('')
  const [username, setUsername]     = useState('')
  const [age, setAge]               = useState('')
  const [wantsTelegram, setWantsTelegram] = useState(false)

  // Verify step
  const [code, setCode] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const cooldownRef = useRef(null)

  useEffect(() => {
    if (step === 'verify') setResendCooldown(RESEND_COOLDOWN)
  }, [step])

  useEffect(() => {
    if (resendCooldown <= 0) return
    cooldownRef.current = setInterval(() => {
      setResendCooldown(v => {
        if (v <= 1) { clearInterval(cooldownRef.current); return 0 }
        return v - 1
      })
    }, 1000)
    return () => clearInterval(cooldownRef.current)
  }, [resendCooldown > 0 && step === 'verify'])

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, password,
          first_name: firstName,
          last_name: lastName,
          username,
          age: age ? parseInt(age) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Registration failed')
      setStep('verify')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Verification failed')
      login(data.access_token, data.user)
      if (wantsTelegram && onOpenSettings) onOpenSettings()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setError(null)
    try {
      const res = await fetch(`${API}/auth/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error('Could not resend')
      setError('New code sent! Check your inbox.')
      setResendCooldown(RESEND_COOLDOWN)
    } catch (e) {
      setError(e.message)
    }
  }

  if (step === 'verify') {
    return (
      <AuthLayout>
        <div className="text-center mb-6">
          <div className="text-3xl mb-3">📬</div>
          <h2 className="text-xl font-bold text-white mb-1">Check your email</h2>
          <p className="text-white/40 text-sm">
            We sent a 6-digit code to<br />
            <span className="text-white/60 font-medium">{email}</span>
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/40 mb-1.5">Verification code</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xl text-white
                         text-center tracking-[0.5em] font-mono placeholder:text-white/20
                         focus:outline-none focus:border-violet-500/50 transition-all"
            />
          </div>

          {error && (
            <p className={`text-sm border rounded-xl px-4 py-2 ${
              error === 'New code sent!'
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : 'text-red-400 bg-red-500/10 border-red-500/20'
            }`}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold
                       hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying…' : 'Verify Email'}
          </button>
        </form>

        <div className="mt-4 text-center space-y-2">
          <p className="text-white/25 text-xs leading-relaxed">
            May take 1–2 min · Check spam/junk folder<br />
            <span className="opacity-70">1–2 dk sürebilir · Spam/gereksiz klasörünü kontrol et</span><br />
            <span className="opacity-50">Может занять 1–2 мин · Проверьте папку спам</span><br />
            <span className="opacity-40">可能需要1-2分钟 · 请检查垃圾邮件</span>
          </p>
          <p className="text-white/30 text-sm">
            Didn't receive it?{' '}
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="text-violet-400 hover:text-violet-300 disabled:text-white/20 disabled:cursor-not-allowed transition-colors"
            >
              {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend'}
            </button>
          </p>
          <button onClick={() => setStep('form')} className="text-white/25 text-xs hover:text-white/50 transition-colors">
            ← Back to registration
          </button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h2 className="text-2xl font-bold text-white mb-1">Create account</h2>
      <p className="text-white/40 text-sm mb-6">Start learning smarter with Lexify</p>

      <form onSubmit={handleRegister} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" value={firstName} onChange={setFirstName} placeholder="Arslan" required />
          <Field label="Last name"  value={lastName}  onChange={setLastName}  placeholder="Agayev" required />
        </div>
        <Field label="Username" value={username} onChange={setUsername} placeholder="Crazy" required />
        <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="arslanagayew39@gmail.com" required />
        <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="Min 6 characters" required />
        <Field label="Age (optional)" type="number" value={age} onChange={setAge} placeholder="23" />

        {/* Telegram toggle */}
        <label className="flex items-center gap-3 cursor-pointer py-1">
          <div
            onClick={() => setWantsTelegram(v => !v)}
            className={`relative w-10 h-5 rounded-full border transition-all ${
              wantsTelegram
                ? 'bg-violet-500 border-violet-500'
                : 'bg-white/5 border-white/15'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${wantsTelegram ? 'translate-x-5' : ''}`} />
          </div>
          <span className="text-sm text-white/50 select-none">{t.telegramWant}</span>
        </label>

        {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold
                     hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-1"
        >
          {loading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <p className="mt-5 text-center text-white/30 text-sm">
        Already have an account?{' '}
        <button onClick={onSwitchToLogin} className="text-violet-400 hover:text-violet-300 font-medium">
          Sign in
        </button>
      </p>
      <p className="mt-2 text-center text-white/20 text-xs">
        <a href="/privacy" className="hover:text-white/40 transition-colors">Privacy Policy</a>
      </p>
    </AuthLayout>
  )
}

function Field({ label, type = 'text', value, onChange, placeholder, required }) {
  return (
    <div>
      <label className="block text-xs font-medium text-white/40 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white
                   placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all"
      />
    </div>
  )
}
