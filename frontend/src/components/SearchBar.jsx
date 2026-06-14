import { useLang } from '../i18n/LangContext'

export default function SearchBar({
  value, onChange, onAdd, onRefresh, adding, addError, onClearAddError,
}) {
  const { t } = useLang()

  const handleKey = (e) => {
    if (e.key === 'Enter' && value.trim()) {
      onClearAddError()
      onAdd(value.trim())
    }
  }

  return (
    <div className="mt-10 mb-2 max-w-2xl mx-auto">
      <div className="grad-border">
        <div className="glass rounded-2xl flex items-center gap-3 px-4 py-3.5">
          {adding
            ? <SpinnerIcon className="w-5 h-5 text-violet-400 shrink-0 animate-spin" />
            : <SearchIcon className="w-5 h-5 text-white/30 shrink-0" />
          }
          <input
            type="text"
            value={value}
            onChange={e => { onClearAddError(); onChange(e.target.value) }}
            onKeyDown={handleKey}
            placeholder={t.searchPlaceholder}
            disabled={adding}
            className="flex-1 bg-transparent text-white placeholder-white/20 outline-none text-sm sm:text-base disabled:opacity-50"
          />
          {value && !adding && (
            <button onClick={() => onChange('')} className="text-white/25 hover:text-white/60 transition-colors">
              <XIcon className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={adding}
            className="text-white/25 hover:text-violet-400 transition-colors disabled:opacity-40"
          >
            <RefreshIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {adding && (
        <p className="text-center text-violet-400/70 text-xs mt-2 animate-pulse">{t.analyzing}</p>
      )}
      {addError && (
        <p className="text-center text-red-400/70 text-xs mt-2">
          {addError === 'ai_service_limited' ? t.aiServiceLimited : `⚠ ${addError}`}
        </p>
      )}
      {!adding && !addError && value && (
        <p className="text-center text-white/20 text-xs mt-2">{t.enterToAdd}</p>
      )}
    </div>
  )
}

function SearchIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}
function XIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
function RefreshIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  )
}
function SpinnerIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
