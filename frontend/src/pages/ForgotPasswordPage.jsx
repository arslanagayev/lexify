import { useState } from 'react'
import { AuthLayout } from './LoginPage'

const API = 'http://localhost:8000'

export default function ForgotPasswordPage({ onSwitchToLogin }) {
  const [step, setStep]         = useState('email')  // 'email' | 'reset' | 'done'
  const [email, setEmail]       = useState('')
  const [code, setCode]         = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  const handleSendCode = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error('Failed to send reset code')
      setStep('reset')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, new_password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Reset failed')
      setStep('done')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (step === 'done') {
    return (
      <AuthLayout>
        <div className="text-center py-4">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-white mb-2">Password updated!</h2>
          <p className="text-white/40 text-sm mb-8">You can now sign in with your new password.</p>
          <button
            onClick={onSwitchToLogin}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold hover:opacity-90 transition-all"
          >
            Back to Sign In
          </button>
        </div>
      </AuthLayout>
    )
  }

  if (step === 'reset') {
    return (
      <AuthLayout>
        <div className="text-center mb-6">
          <div className="text-3xl mb-3">🔑</div>
          <h2 className="text-xl font-bold text-white mb-1">Reset password</h2>
          <p className="text-white/40 text-sm">
            Enter the code sent to <span className="text-white/60 font-medium">{email}</span>
          </p>
        </div>

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/40 mb-1.5">Reset code</label>
            <input
              type="text"
              inputMode="numeric"
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
          <div>
            <label className="block text-xs font-medium text-white/40 mb-1.5">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
              required
              minLength={6}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white
                         placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 transition-all"
            />
          </div>

          {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loading || code.length !== 6 || newPassword.length < 6}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold
                       hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>

        <button onClick={() => setStep('email')} className="mt-4 w-full text-white/25 text-xs hover:text-white/50 transition-colors text-center">
          ← Back
        </button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="text-center mb-6">
        <div className="text-3xl mb-3">🔒</div>
        <h2 className="text-xl font-bold text-white mb-1">Forgot password?</h2>
        <p className="text-white/40 text-sm">Enter your email and we'll send a reset code</p>
      </div>

      <form onSubmit={handleSendCode} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-white/40 mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white
                       placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 transition-all"
          />
        </div>

        {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold
                     hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending…' : 'Send Reset Code'}
        </button>
      </form>

      <button onClick={onSwitchToLogin} className="mt-5 w-full text-white/40 text-sm hover:text-white/60 transition-colors text-center">
        ← Back to Sign In
      </button>
    </AuthLayout>
  )
}
