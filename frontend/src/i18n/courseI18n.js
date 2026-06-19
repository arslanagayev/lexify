// Topic-tag, POS, and CEFR-level translations.
// Canonical English keys are stored in the DB; display follows the interface language.

const TOPIC_LABELS = {
  en: {
    // original set
    business: 'business', finance: 'finance', politics: 'politics', science: 'science',
    technology: 'technology', culture: 'culture', psychology: 'psychology',
    environment: 'environment', health: 'health', law: 'law', economics: 'economics',
    society: 'society', education: 'education', sports: 'sports', arts: 'arts',
    // expanded set
    food: 'food', daily_life: 'daily life', grammar: 'grammar', travel: 'travel',
    family: 'family', work: 'work', nature: 'nature', emotions: 'emotions',
    history: 'history', music: 'music', religion: 'religion', money: 'money',
    time: 'time', art: 'arts',
  },
  tr: {
    business: 'ticaret', finance: 'finans', politics: 'siyaset', science: 'bilim',
    technology: 'teknoloji', culture: 'kültür', psychology: 'psikoloji',
    environment: 'çevre', health: 'sağlık', law: 'hukuk', economics: 'ekonomi',
    society: 'toplum', education: 'eğitim', sports: 'spor', arts: 'sanat',
    food: 'yemek', daily_life: 'günlük yaşam', grammar: 'dilbilgisi', travel: 'seyahat',
    family: 'aile', work: 'çalışma', nature: 'doğa', emotions: 'duygular',
    history: 'tarih', music: 'müzik', religion: 'din', money: 'para',
    time: 'zaman', art: 'sanat',
  },
  zh: {
    business: '商业', finance: '金融', politics: '政治', science: '科学',
    technology: '科技', culture: '文化', psychology: '心理学',
    environment: '环境', health: '健康', law: '法律', economics: '经济',
    society: '社会', education: '教育', sports: '体育', arts: '艺术',
    food: '饮食', daily_life: '日常生活', grammar: '语法', travel: '旅行',
    family: '家庭', work: '工作', nature: '自然', emotions: '情感',
    history: '历史', music: '音乐', religion: '宗教', money: '金钱',
    time: '时间', art: '艺术',
  },
  ru: {
    business: 'бизнес', finance: 'финансы', politics: 'политика', science: 'наука',
    technology: 'технологии', culture: 'культура', psychology: 'психология',
    environment: 'экология', health: 'здоровье', law: 'право', economics: 'экономика',
    society: 'общество', education: 'образование', sports: 'спорт', arts: 'искусство',
    food: 'еда', daily_life: 'повседневная жизнь', grammar: 'грамматика', travel: 'путешествия',
    family: 'семья', work: 'работа', nature: 'природа', emotions: 'эмоции',
    history: 'история', music: 'музыка', religion: 'религия', money: 'деньги',
    time: 'время', art: 'искусство',
  },
}

// Normalize key: lowercase, collapse spaces/hyphens to underscore
function _normTopic(key) {
  return (key || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

export function topicLabel(lang, key) {
  const k = _normTopic(key)
  const label = TOPIC_LABELS[lang]?.[k] || TOPIC_LABELS.en[k]
  if (label) return label
  // Fallback: prettify the raw key (daily_life → "Daily Life")
  return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || key
}

// ── Part of Speech translations ───────────────────────────────────────────────
const POS_LABELS = {
  en: {
    noun: 'noun', verb: 'verb', adjective: 'adjective', adverb: 'adverb',
    pronoun: 'pronoun', preposition: 'preposition', conjunction: 'conjunction',
    interjection: 'interjection', article: 'article', numeral: 'numeral',
    particle: 'particle', determiner: 'determiner',
  },
  tr: {
    noun: 'isim', verb: 'fiil', adjective: 'sıfat', adverb: 'zarf',
    pronoun: 'zamir', preposition: 'edat', conjunction: 'bağlaç',
    interjection: 'ünlem', article: 'tanımlık', numeral: 'sayı sıfatı',
    particle: 'edat', determiner: 'belirteç',
  },
  zh: {
    noun: '名词', verb: '动词', adjective: '形容词', adverb: '副词',
    pronoun: '代词', preposition: '介词', conjunction: '连词',
    interjection: '感叹词', article: '冠词', numeral: '数词',
    particle: '助词', determiner: '限定词',
  },
  ru: {
    noun: 'существительное', verb: 'глагол', adjective: 'прилагательное',
    adverb: 'наречие', pronoun: 'местоимение', preposition: 'предлог',
    conjunction: 'союз', interjection: 'междометие', article: 'артикль',
    numeral: 'числительное', particle: 'частица', determiner: 'определитель',
  },
}

export function posLabel(lang, key) {
  const k = (key || '').trim().toLowerCase()
  return POS_LABELS[lang]?.[k] || POS_LABELS.en[k] || key
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
