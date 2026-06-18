// Topic-tag and CEFR-level translations, keyed by the canonical English key
// stored in the database. Display follows the interface language; the stored
// value never changes (e.g. DB keeps "culture", UI shows "文化" / "Kültür").

const TOPIC_LABELS = {
  en: {
    business: 'business', finance: 'finance', politics: 'politics', science: 'science',
    technology: 'technology', culture: 'culture', psychology: 'psychology',
    environment: 'environment', health: 'health', law: 'law', economics: 'economics',
    society: 'society', education: 'education', sports: 'sports', arts: 'arts',
  },
  tr: {
    business: 'iş', finance: 'finans', politics: 'siyaset', science: 'bilim',
    technology: 'teknoloji', culture: 'kültür', psychology: 'psikoloji',
    environment: 'çevre', health: 'sağlık', law: 'hukuk', economics: 'ekonomi',
    society: 'toplum', education: 'eğitim', sports: 'spor', arts: 'sanat',
  },
  zh: {
    business: '商业', finance: '金融', politics: '政治', science: '科学',
    technology: '科技', culture: '文化', psychology: '心理学',
    environment: '环境', health: '健康', law: '法律', economics: '经济',
    society: '社会', education: '教育', sports: '体育', arts: '艺术',
  },
  ru: {
    business: 'бизнес', finance: 'финансы', politics: 'политика', science: 'наука',
    technology: 'технологии', culture: 'культура', psychology: 'психология',
    environment: 'экология', health: 'здоровье', law: 'право', economics: 'экономика',
    society: 'общество', education: 'образование', sports: 'спорт', arts: 'искусство',
  },
}

// Translate a stored topic key for display. Falls back to the raw value so any
// tag the AI returns that isn't in the fixed set still shows up.
export function topicLabel(lang, key) {
  const k = (key || '').trim().toLowerCase()
  return TOPIC_LABELS[lang]?.[k] || TOPIC_LABELS.en[k] || key
}

// ── Levels (course "degree") ──────────────────────────────────────────────────
export const LEVELS = ['beginner', 'intermediate', 'advanced']
export const LEVEL_CEFR = { beginner: 'A1–A2', intermediate: 'B1–B2', advanced: 'C1–C2' }

const LEVEL_LABELS = {
  en: { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced',
        prompt: l => `What's your level in ${l}?`, change: 'Level', choose: 'Choose your level' },
  tr: { beginner: 'Başlangıç', intermediate: 'Orta', advanced: 'İleri',
        prompt: l => `${l} seviyen nedir?`, change: 'Seviye', choose: 'Seviyeni seç' },
  zh: { beginner: '初级', intermediate: '中级', advanced: '高级',
        prompt: l => `你的${l}水平如何？`, change: '水平', choose: '选择你的水平' },
  ru: { beginner: 'Начальный', intermediate: 'Средний', advanced: 'Продвинутый',
        prompt: l => `Какой у вас уровень (${l})?`, change: 'Уровень', choose: 'Выберите уровень' },
}

export function levelLabel(lang, level) {
  const L = LEVEL_LABELS[lang] || LEVEL_LABELS.en
  return L[level] || LEVEL_LABELS.en[level] || level
}
export function levelPrompt(lang, langName) {
  return (LEVEL_LABELS[lang] || LEVEL_LABELS.en).prompt(langName)
}
export function levelChangeLabel(lang) {
  return (LEVEL_LABELS[lang] || LEVEL_LABELS.en).change
}
export function levelChooseLabel(lang) {
  return (LEVEL_LABELS[lang] || LEVEL_LABELS.en).choose
}
