import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import logoSrc from '../assets/logo.png'

const API = 'http://localhost:8000'

export default function LoginPage({ onSwitchToRegister, onSwitchToForgot }) {
  const { login } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Login failed')
      login(data.access_token, data.user)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
      <p className="text-white/40 text-sm mb-8">Sign in to continue learning</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          required
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          required
        />

        {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold
                     hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 space-y-3 text-center">
        <button
          onClick={onSwitchToForgot}
          className="text-white/40 text-sm hover:text-white/70 transition-colors"
        >
          Forgot password?
        </button>
        <p className="text-white/30 text-sm">
          Don't have an account?{' '}
          <button onClick={onSwitchToRegister} className="text-violet-400 hover:text-violet-300 font-medium">
            Create one
          </button>
        </p>
      </div>
    </AuthLayout>
  )
}

export function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <img src={logoSrc} alt="Lexify" className="w-11 h-11 rounded-2xl object-cover shadow-xl shadow-violet-500/30" />
        <div>
          <p className="text-xl font-bold grad-text leading-none">Lexify</p>
          <p className="text-[11px] text-white/25 mt-0.5">AI Vocabulary Assistant</p>
        </div>
      </div>

      <div className="w-full max-w-sm glass rounded-3xl p-8 border border-white/8 shadow-2xl shadow-black/40">
        {children}
      </div>
    </div>
  )
}

function Field({ label, type, value, onChange, placeholder, required }) {
  return (
    <div>
      <label className="block text-xs font-medium text-white/40 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white
                   placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all"
      />
    </div>
  )
}

