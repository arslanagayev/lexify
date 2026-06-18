// Supported course languages (must mirror backend/languages.py).
export const LANGUAGES = {
  en: { name: 'English',    native: 'English',    flag: '🇬🇧' },
  zh: { name: 'Chinese',    native: '中文',        flag: '🇨🇳' },
  es: { name: 'Spanish',    native: 'Español',    flag: '🇪🇸' },
  hi: { name: 'Hindi',      native: 'हिन्दी',       flag: '🇮🇳' },
  ar: { name: 'Arabic',     native: 'العربية',     flag: '🇸🇦' },
  fr: { name: 'French',     native: 'Français',   flag: '🇫🇷' },
  ru: { name: 'Russian',    native: 'Русский',    flag: '🇷🇺' },
  pt: { name: 'Portuguese', native: 'Português',  flag: '🇵🇹' },
  de: { name: 'German',     native: 'Deutsch',    flag: '🇩🇪' },
  ja: { name: 'Japanese',   native: '日本語',       flag: '🇯🇵' },
  ko: { name: 'Korean',     native: '한국어',       flag: '🇰🇷' },
  tr: { name: 'Turkish',    native: 'Türkçe',     flag: '🇹🇷' },
  it: { name: 'Italian',    native: 'Italiano',   flag: '🇮🇹' },
  nl: { name: 'Dutch',      native: 'Nederlands', flag: '🇳🇱' },
  pl: { name: 'Polish',     native: 'Polski',     flag: '🇵🇱' },
  vi: { name: 'Vietnamese', native: 'Tiếng Việt', flag: '🇻🇳' },
}

export const LANG_CODES = Object.keys(LANGUAGES)

export function langFlag(code) { return LANGUAGES[code]?.flag || '🌐' }
export function langName(code) { return LANGUAGES[code]?.name || code }
export function langLabel(code) {
  const l = LANGUAGES[code]
  return l ? `${l.flag} ${l.name}` : code
}

// BCP-47 tag for TTS by target language
export const TTS_LOCALE = {
  en: 'en-US', zh: 'zh-CN', es: 'es-ES', hi: 'hi-IN', ar: 'ar-SA', fr: 'fr-FR',
  ru: 'ru-RU', pt: 'pt-PT', de: 'de-DE', ja: 'ja-JP', ko: 'ko-KR', tr: 'tr-TR',
  it: 'it-IT', nl: 'nl-NL', pl: 'pl-PL', vi: 'vi-VN',
}
