import WordCard from './WordCard'
import { useLang } from '../i18n/LangContext'

export default function WordGrid({ words, onUpdate, onDelete, onEditOpen, onEditClose }) {
  const { t } = useLang()

  if (words.length === 0) {
    return (
      <div className="mt-24 flex flex-col items-center gap-3 text-center">
        <div className="w-20 h-20 rounded-2xl glass flex items-center justify-center text-4xl opacity-30">📚</div>
        <p className="text-white/30 text-lg font-medium">{t.noWords}</p>
        <p className="text-white/15 text-sm">{t.tryDifferent}</p>
      </div>
    )
  }

  return (
    <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {words.map((word, i) => (
        <WordCard
          key={word.id}
          word={word}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onEditOpen={onEditOpen}
          onEditClose={onEditClose}
          style={{ animationDelay: `${i * 60}ms`, opacity: 0 }}
        />
      ))}
    </div>
  )
}
