import { useState, useCallback } from 'react'
import { useLang } from '../i18n/LangContext'
import { speak } from '../utils/speech'
import PronounceCheck from './PronounceCheck'
import ErrorBoundary from './ErrorBoundary'

const POS_STYLE = {
  noun:        'bg-sky-500/15 text-sky-300 border-sky-500/25',
  verb:        'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  adjective:   'bg-amber-500/15 text-amber-300 border-amber-500/25',
  adverb:      'bg-purple-500/15 text-purple-300 border-purple-500/25',
  preposition: 'bg-pink-500/15 text-pink-300 border-pink-500/25',
  conjunction: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
  interjection:'bg-rose-500/15 text-rose-300 border-rose-500/25',
}
const POS_DEFAULT = 'bg-white/8 text-white/40 border-white/15'

export default function WordCard({ word: w, onUpdate, onDelete, onEditOpen, onEditClose, onOpenMap, token, apiBase, style }) {
  const { t } = useLang()
  const [editing, setEditing]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [speaking, setSpeaking] = useState(null)
  const [draft, setDraft]       = useState({})

  const startEdit = () => {
    setDraft({
      word: w.word || '',
      phonetic: w.phonetic || '',
      part_of_speech: w.part_of_speech || '',
      chinese_meaning: w.chinese_meaning || '',
      example_sentence: w.example_sentence || '',
      chinese_translation: w.chinese_translation || '',
      synonyms: w.synonyms || '',
      antonyms: w.antonyms || '',
      collocations: w.collocations || '',
      tags: w.tags || '',
      etymology: w.etymology || '',
      source_name: w.source_name || '',
      source_url: w.source_url || '',
    })
    setEditing(true)
    onEditOpen?.()
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(w.id, draft)
      setEditing(false)
      onEditClose?.()
    } finally { setSaving(false) }
  }

  const handleCancelEdit = () => {
    setEditing(false)
    onEditClose?.()
  }

  const handleDelete = async () => {
    if (!confirm(t.deleteConfirm(w.word))) return
    setDeleting(true)
    try { await onDelete(w.id) } finally { setDeleting(false) }
  }

  const handleSpeak = useCallback((text, lang, key) => {
    speak(text, lang, {
      onStart: () => setSpeaking(key),
      onEnd:   () => setSpeaking(null),
      onError: () => setSpeaking(null),
    })
  }, [])

  const posKey = (w.part_of_speech || '').toLowerCase()
  const posStyle = POS_STYLE[posKey] || POS_DEFAULT

  // Mini stats tooltip (FAZ 2): "X reviews | Y% accuracy | added Zd ago"
  const reviews = w.review_count || 0
  const acc = reviews > 0 ? Math.round((w.known_count / reviews) * 100) : 0
  const daysAgo = w.created_at
    ? Math.floor((Date.now() - new Date(w.created_at).getTime()) / 86400000)
    : 0
  const statTip = reviews > 0
    ? `${t.reviewsShort(reviews)} | ${acc}% accuracy | ${t.addedAgo(daysAgo)}`
    : t.addedAgo(daysAgo)

  if (editing) {
    return (
      <EditCard
        draft={draft} setDraft={setDraft}
        onSave={handleSave} onCancel={handleCancelEdit}
        saving={saving} style={style} t={t}
      />
    )
  }

  return (
    <article
      style={style}
      title={statTip}
      className="glass rounded-2xl p-6 flex flex-col gap-4
                 hover:bg-white/[0.07] hover:border-white/14
                 hover:-translate-y-1 hover:shadow-2xl hover:shadow-violet-500/10
                 transition-all duration-300 animate-fade-up group"
    >
      {/* ── Badges row + actions ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {w.mastery_status === 'mastered' && (
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {t.badgeMastered} ✓
            </span>
          )}
          {w.mastery_status === 'learning' && (
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              {t.badgeLearning}
            </span>
          )}
          {w.mastery_status === 'new' && (
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-sky-500/40 bg-sky-500/15 text-sky-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              {t.badgeNew}
            </span>
          )}
          {w.part_of_speech && (
            <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${posStyle}`}>
              {w.part_of_speech}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <ErrorBoundary silent>
            <PronounceCheck word={w.word} wordId={w.id} token={token} apiBase={apiBase} compact />
          </ErrorBoundary>
          {(w.synonyms || w.antonyms || w.collocations) && onOpenMap && (
            <button onClick={() => onOpenMap(w)}
              className="p-1.5 rounded-lg text-white/20 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all opacity-0 group-hover:opacity-100"
              title={t.wordMapTip}>
              <MapIcon className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={startEdit}
            className="p-1.5 rounded-lg text-white/20 hover:text-violet-300 hover:bg-violet-500/10 transition-all opacity-0 group-hover:opacity-100"
            title={t.editTip}>
            <EditIcon className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-40"
            title={t.deleteTip}>
            {deleting ? <SpinIcon className="w-3.5 h-3.5 animate-spin" /> : <TrashIcon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Word title + phonetic ── */}
      <div className="-mt-1">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-white tracking-tight break-words">{w.word}</h2>
          <SpeakBtn
            active={speaking === 'word'}
            onClick={() => handleSpeak(w.word, 'en-US', 'word')}
            compact title={t.pronounce}
          />
        </div>
        {w.phonetic && (
          <p className="font-mono text-sm text-white/35 mt-0.5">{w.phonetic}</p>
        )}
      </div>

      {/* ── Chinese meaning ── */}
      {w.chinese_meaning && (
        <div className="rounded-xl px-4 py-3 bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border border-white/5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] uppercase tracking-widest text-white/25">{t.meaning}</p>
            <SpeakBtn
              active={speaking === 'meaning'}
              onClick={() => handleSpeak(w.chinese_meaning, 'zh-CN', 'meaning')}
              label="zh-CN"
            />
          </div>
          <p className="text-white font-semibold text-lg leading-snug">{w.chinese_meaning}</p>
          {w.chinese_pinyin && (
            <p className="text-white/35 text-sm font-mono mt-1 tracking-wide">{w.chinese_pinyin}</p>
          )}
        </div>
      )}

      {/* ── Example + translations ── */}
      {w.example_sentence && (
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-white/25">{t.example}</p>
            <SpeakBtn
              active={speaking === 'en'}
              onClick={() => handleSpeak(w.example_sentence, 'en-US', 'en')}
              label="en-US"
            />
          </div>
          <p className="text-white/60 text-sm leading-relaxed italic">"{w.example_sentence}"</p>

          {w.chinese_translation && (
            <div className="flex items-start justify-between gap-2 pt-1 border-t border-white/5">
              <p className="text-white/35 text-sm leading-relaxed">{w.chinese_translation}</p>
              <SpeakBtn
                active={speaking === 'zh'}
                onClick={() => handleSpeak(w.chinese_translation, 'zh-CN', 'zh')}
                label="zh-CN"
                className="mt-0.5"
              />
            </div>
          )}
        </div>
      )}

      {/* ── Synonyms / Antonyms / Collocations ── */}
      {(w.synonyms || w.antonyms || w.collocations) && (
        <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
          {w.synonyms && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-widest text-white/25 shrink-0 w-20">{t.synonyms}</span>
              {w.synonyms.split(',').map(s => s.trim()).filter(Boolean).map((s, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300/70">{s}</span>
              ))}
            </div>
          )}
          {w.antonyms && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-widest text-white/25 shrink-0 w-20">{t.antonyms}</span>
              {w.antonyms.split(',').map(s => s.trim()).filter(Boolean).map((s, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300/70">{s}</span>
              ))}
            </div>
          )}
          {w.collocations && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-widest text-white/25 shrink-0 w-20">{t.collocations}</span>
              {w.collocations.split(',').map(s => s.trim()).filter(Boolean).map((s, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300/70">{s}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tags ── */}
      {w.tags && (
        <div className="flex flex-wrap gap-1.5">
          {w.tags.split(',').map(s => s.trim()).filter(Boolean).map((tag, i) => (
            <span key={i} className="text-[11px] px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300/70">{tag}</span>
          ))}
        </div>
      )}

      {/* ── Etymology ── */}
      {w.etymology && (
        <div className="pt-2 border-t border-white/5">
          <p className="text-[10px] uppercase tracking-widest text-white/25 mb-1">{t.etymology}</p>
          <p className="text-white/35 text-xs leading-relaxed">{w.etymology}</p>
        </div>
      )}

      {/* ── Source ── */}
      {w.source_name && (
        <div className="pt-2 border-t border-white/5">
          <p className="text-[10px] uppercase tracking-widest text-white/25 mb-1">{t.source}</p>
          {w.source_url
            ? <a href={w.source_url} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-violet-400 transition-colors group/src">
                <LinkIcon className="w-3.5 h-3.5 shrink-0 group-hover/src:text-violet-400" />
                <span className="truncate">{w.source_name}</span>
              </a>
            : <p className="text-sm text-white/40">{w.source_name}</p>
          }
        </div>
      )}
    </article>
  )
}

/* ── Inline edit card ─────────────────────────────────────── */
function EditCard({ draft, setDraft, onSave, onCancel, saving, style, t }) {
  const set = key => e => setDraft(d => ({ ...d, [key]: e.target.value }))
  const inp = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-violet-500/50 transition-colors placeholder-white/20"
  const ta  = inp + " resize-none"

  return (
    <article style={style} className="glass rounded-2xl p-5 flex flex-col gap-3 border-violet-500/30 bg-violet-500/5 animate-fade-up">
      <p className="text-xs text-violet-300/70 font-medium uppercase tracking-wider">{t.editing}</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-white/25 mb-1 block">{t.fieldWord}</label>
          <input className={inp} value={draft.word} onChange={set('word')} />
        </div>
        <div>
          <label className="text-[10px] text-white/25 mb-1 block">{t.fieldPhonetic}</label>
          <input className={`${inp} font-mono`} value={draft.phonetic} onChange={set('phonetic')} placeholder="/wɜːrd/" />
        </div>
      </div>

      <div>
        <label className="text-[10px] text-white/25 mb-1 block">{t.fieldPos}</label>
        <select className={inp} value={draft.part_of_speech} onChange={set('part_of_speech')}>
          <option value="">—</option>
          {['noun','verb','adjective','adverb','preposition','conjunction','interjection'].map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[10px] text-white/25 mb-1 block">{t.fieldMeaning}</label>
        <input className={inp} value={draft.chinese_meaning} onChange={set('chinese_meaning')} />
      </div>
      <div>
        <label className="text-[10px] text-white/25 mb-1 block">{t.fieldExample}</label>
        <textarea className={ta} rows={2} value={draft.example_sentence} onChange={set('example_sentence')} />
      </div>
      <div>
        <label className="text-[10px] text-white/25 mb-1 block">{t.fieldTranslation}</label>
        <textarea className={ta} rows={2} value={draft.chinese_translation} onChange={set('chinese_translation')} />
      </div>

      <div>
        <label className="text-[10px] text-white/25 mb-1 block">{t.fieldSynonyms}</label>
        <input className={inp} value={draft.synonyms} onChange={set('synonyms')} placeholder="e.g. toughness, durability" />
      </div>
      <div>
        <label className="text-[10px] text-white/25 mb-1 block">{t.fieldAntonyms}</label>
        <input className={inp} value={draft.antonyms} onChange={set('antonyms')} placeholder="e.g. fragility, weakness" />
      </div>
      <div>
        <label className="text-[10px] text-white/25 mb-1 block">{t.fieldCollocations}</label>
        <input className={inp} value={draft.collocations} onChange={set('collocations')} placeholder="e.g. show resilience, remarkable resilience" />
      </div>
      <div>
        <label className="text-[10px] text-white/25 mb-1 block">{t.fieldTags}</label>
        <input className={inp} value={draft.tags} onChange={set('tags')} placeholder="e.g. business, finance" />
      </div>
      <div>
        <label className="text-[10px] text-white/25 mb-1 block">{t.fieldEtymology}</label>
        <textarea className={ta} rows={2} value={draft.etymology} onChange={set('etymology')} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-white/25 mb-1 block">{t.fieldSource}</label>
          <input className={inp} value={draft.source_name} onChange={set('source_name')} />
        </div>
        <div>
          <label className="text-[10px] text-white/25 mb-1 block">{t.fieldSourceUrl}</label>
          <input className={inp} value={draft.source_url} onChange={set('source_url')} />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onSave} disabled={saving}
          className="flex-1 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
          {saving && <SpinIcon className="w-3.5 h-3.5 animate-spin" />}
          {saving ? t.saving : t.save}
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 rounded-xl glass text-white/50 hover:text-white text-sm transition-colors">
          {t.cancel}
        </button>
      </div>
    </article>
  )
}

/* ── Speak button ─────────────────────────────────────────── */
function SpeakBtn({ active, onClick, label, compact, className = '', title }) {
  return (
    <button onClick={onClick} title={title}
      className={`flex items-center gap-1.5 rounded-lg text-[11px] font-mono border transition-all duration-200
        ${compact ? 'p-1' : 'px-2.5 py-1'} ${className}
        ${active
          ? 'bg-violet-500/25 border-violet-400/40 text-violet-300'
          : 'bg-white/5 border-white/10 text-white/30 hover:bg-white/10 hover:text-white/50'}`}
    >
      {active ? <SoundWave /> : <SpeakerIcon className="w-3 h-3" />}
      {!compact && label}
    </button>
  )
}

function SoundWave() {
  return (
    <span className="flex items-end gap-px h-3">
      {[8,12,10,6].map((h,i) => (
        <span key={i} className="sound-bar inline-block w-0.5 rounded-full bg-violet-300" style={{ height:`${h}px` }} />
      ))}
    </span>
  )
}

/* ── Icons ────────────────────────────────────────────────── */
function SpeakerIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
    </svg>
  )
}
function MapIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <circle cx="12" cy="5" r="2" />
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="18" r="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v3m0 0l-5.5 6.5M12 10l5.5 6.5" />
    </svg>
  )
}
function EditIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
    </svg>
  )
}
function TrashIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  )
}
function LinkIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  )
}
function SpinIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
