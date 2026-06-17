import { createContext, useContext, useState } from 'react'
import { translations } from './translations'

const LangContext = createContext(null)

export const LANG_OPTIONS = [
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'tr', label: 'Türkçe',   flag: '🇹🇷' },
  { code: 'zh', label: '中文',      flag: '🇨🇳' },
  { code: 'ru', label: 'Русский',  flag: '🇷🇺' },
]

export function LangProvider({ children }) {
  const [lang, setLang] = useState('en')
  return (
    <LangContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
