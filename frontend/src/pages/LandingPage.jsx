import { useLang } from '../i18n/LangContext'
import logoSrc from '../assets/logo.png'

export default function LandingPage({ onGetStarted, onLogin }) {
  const { t } = useLang()

  const features = [
    { icon: '📰', title: t.landFeat1Title, body: t.landFeat1Body },
    { icon: '🤖', title: t.landFeat2Title, body: t.landFeat2Body },
    { icon: '🔁', title: t.landFeat3Title, body: t.landFeat3Body },
    { icon: '✈️', title: t.landFeat4Title, body: t.landFeat4Body },
  ]
  const steps = [
    { n: '1', title: t.landStep1Title, body: t.landStep1Body },
    { n: '2', title: t.landStep2Title, body: t.landStep2Body },
    { n: '3', title: t.landStep3Title, body: t.landStep3Body },
  ]

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={logoSrc} alt="Lexify" className="w-9 h-9 rounded-xl object-cover shadow-lg shadow-violet-500/25" />
          <span className="text-lg font-bold grad-text">Lexify</span>
        </div>
        <button onClick={onLogin}
          className="text-sm text-white/60 hover:text-white px-4 py-2 transition-colors">
          {t.landLogin}
        </button>
      </header>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-4 text-center pt-16 pb-20">
        <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-5">
          <span className="grad-text">{t.landHeroTitle}</span>
        </h1>
        <p className="text-white/55 text-lg leading-relaxed mb-9 max-w-xl mx-auto">
          {t.landHeroSubtitle}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={onGetStarted}
            className="px-7 py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-sky-500 text-white font-semibold hover:opacity-90 transition-opacity">
            {t.landGetStarted}
          </button>
          <button onClick={onLogin}
            className="px-7 py-3 rounded-2xl glass border border-white/10 text-white/70 font-medium hover:text-white transition-all">
            {t.landLogin}
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <div key={i} className="glass rounded-2xl p-6 border border-white/8">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="text-white font-semibold mb-1.5">{f.title}</h3>
              <p className="text-white/45 text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-4 pb-24">
        <h2 className="text-2xl font-bold text-center text-white/85 mb-10">{t.landHowTitle}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <div key={i} className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center text-white font-bold text-lg">
                {s.n}
              </div>
              <h3 className="text-white font-semibold mb-1.5">{s.title}</h3>
              <p className="text-white/45 text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-4 pb-20 text-center">
        <div className="glass rounded-3xl p-10 border border-white/8">
          <h2 className="text-2xl font-bold grad-text mb-3">{t.landCtaTitle}</h2>
          <button onClick={onGetStarted}
            className="mt-2 px-7 py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-sky-500 text-white font-semibold hover:opacity-90 transition-opacity">
            {t.landGetStarted}
          </button>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center">
        <p className="text-white/25 text-xs">© 2026 Lexify · {t.landHeroTitle}</p>
        <a href="/privacy" className="text-white/25 hover:text-white/50 text-xs transition-colors">Privacy Policy</a>
      </footer>
    </div>
  )
}
