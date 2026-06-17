import { useState } from 'react'
import { useLang } from '../i18n/LangContext'

export default function OnboardingTour({ onClose }) {
  const { t } = useLang()
  const [step, setStep] = useState(0)

  const steps = [
    { icon: '🔍', title: t.tourAddTitle,     body: t.tourAddBody },
    { icon: '🔁', title: t.tourReviewTitle,  body: t.tourReviewBody },
    { icon: '📊', title: t.tourStatsTitle,   body: t.tourStatsBody },
  ]
  const last = step === steps.length - 1
  const s = steps[step]

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass rounded-3xl border border-white/10 shadow-2xl w-full max-w-sm p-7 text-center">
        <div className="text-5xl mb-4">{s.icon}</div>
        <h2 className="text-xl font-bold grad-text mb-2">{s.title}</h2>
        <p className="text-white/55 text-sm leading-relaxed mb-6">{s.body}</p>

        <div className="flex items-center justify-center gap-1.5 mb-6">
          {steps.map((_, i) => (
            <span key={i} className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-violet-400' : 'bg-white/15'}`} />
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl glass border border-white/10 text-white/50 hover:text-white text-sm transition-all">
            {t.tourSkip}
          </button>
          <button onClick={() => last ? onClose() : setStep(step + 1)}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-sky-500 text-white text-sm font-medium hover:opacity-90 transition-opacity">
            {last ? t.tourDone : t.tourNext}
          </button>
        </div>
      </div>
    </div>
  )
}
