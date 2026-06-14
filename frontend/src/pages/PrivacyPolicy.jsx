export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen px-4 py-12">
      <div className="max-w-2xl mx-auto">

        {/* Back link */}
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm mb-10 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Lexify
        </a>

        {/* Card */}
        <div className="glass rounded-3xl border border-white/8 shadow-2xl shadow-black/40 p-8 sm:p-12 space-y-8">

          {/* Header */}
          <div className="border-b border-white/8 pb-8">
            <h1 className="text-3xl font-bold grad-text mb-2">Privacy Policy</h1>
            <p className="text-white/35 text-sm">Last updated: June 2026</p>
          </div>

          <p className="text-white/60 leading-relaxed">
            Lexify ("we", "our", "us") is an AI-powered vocabulary learning platform. This Privacy Policy
            explains what information we collect, how we use it, and your rights regarding your data.
          </p>

          <Section title="1. Information We Collect">
            <ul className="space-y-2 text-white/55 text-sm leading-relaxed list-none">
              <Li><strong className="text-white/75">Account Information:</strong> email address, first name, last name, username, age (optional), and a securely hashed password.</Li>
              <Li><strong className="text-white/75">Vocabulary Data:</strong> words you add, review history, quiz results, and learning statistics.</Li>
              <Li><strong className="text-white/75">Telegram Integration (optional):</strong> if you link your Telegram account, we store your Telegram chat ID and language preference to enable bot features.</Li>
              <Li><strong className="text-white/75">Usage Data:</strong> basic technical information such as IP address (for security and rate-limiting purposes).</Li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul className="space-y-2 text-white/55 text-sm leading-relaxed list-none">
              <Li>To provide and improve the Lexify service (vocabulary cards, spaced repetition, quizzes, statistics)</Li>
              <Li>To send account-related emails (email verification, password reset)</Li>
              <Li>To enable the optional Telegram bot integration</Li>
              <Li>To maintain security (rate limiting, abuse prevention)</Li>
            </ul>
          </Section>

          <Section title="3. Third-Party Services">
            <p className="text-white/55 text-sm leading-relaxed">
              To provide AI-generated definitions, translations, and example sentences, the English word you add
              is sent to DeepSeek's API for processing. Example sentences are sourced from public news websites
              via web search. Account emails (verification, password reset) are sent via Google's Gmail service.
              If you link Telegram, your messages to our bot are processed by our AI assistant (powered by DeepSeek).
            </p>
            <p className="mt-3 text-white/55 text-sm font-medium">
              We do not sell your personal data to third parties.
            </p>
          </Section>

          <Section title="4. Data Storage & Security">
            <p className="text-white/55 text-sm leading-relaxed">
              Your data is stored on our servers with industry-standard security measures, including password
              hashing, rate limiting, and HTTPS encryption. However, no system is 100% secure, and we cannot
              guarantee absolute security.
            </p>
          </Section>

          <Section title="5. Your Rights">
            <p className="text-white/55 text-sm leading-relaxed">
              You can access and correct your account information, and permanently delete your account at
              any time, directly from the Settings page. For any other privacy questions, contact us at{' '}
              <a href="mailto:lexifyvocab@gmail.com" className="text-violet-400 hover:text-violet-300 transition-colors">
                lexifyvocab@gmail.com
              </a>.
            </p>
          </Section>

          <Section title="6. Children's Privacy">
            <p className="text-white/55 text-sm leading-relaxed">
              Lexify is not intended for children under 13. We do not knowingly collect data from children
              under 13. If you believe a child has provided us with personal data, please contact us so we
              can remove it.
            </p>
          </Section>

          <Section title="7. Cookies & Local Storage">
            <p className="text-white/55 text-sm leading-relaxed">
              We use browser local storage to keep you signed in (storing an authentication token). We do not
              use third-party advertising cookies.
            </p>
          </Section>

          <Section title="8. Changes to This Policy">
            <p className="text-white/55 text-sm leading-relaxed">
              We may update this policy from time to time. Continued use of Lexify after changes constitutes
              acceptance of the updated policy.
            </p>
          </Section>

          <Section title="9. Contact">
            <p className="text-white/55 text-sm leading-relaxed">
              For privacy questions or data deletion requests:{' '}
              <a href="mailto:lexifyvocab@gmail.com" className="text-violet-400 hover:text-violet-300 transition-colors">
                lexifyvocab@gmail.com
              </a>
            </p>
          </Section>

        </div>

        <p className="text-center text-white/20 text-xs mt-8">© 2026 Lexify · AI-Powered Vocabulary Learning</p>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-white/85">{title}</h2>
      {children}
    </div>
  )
}

function Li({ children }) {
  return (
    <li className="flex gap-2">
      <span className="text-violet-400/60 mt-0.5 shrink-0">•</span>
      <span>{children}</span>
    </li>
  )
}
