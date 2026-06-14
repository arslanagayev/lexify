/**
 * Finds the best available voice for a language tag.
 * Falls back to any voice whose lang starts with the same prefix
 * (e.g. zh-CN → zh-TW, zh-HK, zh …)
 */
function findVoice(lang) {
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  // 1. Exact match
  let v = voices.find(v => v.lang === lang)
  if (v) return v

  // 2. Prefix match  (zh-CN → zh-TW, zh-HK, zh)
  const prefix = lang.split('-')[0].toLowerCase()
  v = voices.find(v => v.lang.toLowerCase().startsWith(prefix + '-'))
  if (v) return v

  // 3. Bare prefix
  v = voices.find(v => v.lang.toLowerCase() === prefix)
  return v || null
}

/**
 * Speak text in the given BCP-47 language.
 * Handles async voice loading and zh-CN fallback automatically.
 *
 * @param {string} text
 * @param {string} lang  e.g. 'en-US' | 'zh-CN'
 * @param {{ onStart?: () => void, onEnd?: () => void, onError?: () => void }} callbacks
 */
export function speak(text, lang, callbacks = {}) {
  if (!window.speechSynthesis || !text?.trim()) return

  window.speechSynthesis.cancel()

  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = lang
  utt.rate = 0.88

  if (callbacks.onStart) utt.onstart = callbacks.onStart
  if (callbacks.onEnd)   utt.onend   = callbacks.onEnd
  if (callbacks.onError) utt.onerror = callbacks.onError

  const doSpeak = () => {
    const voice = findVoice(lang)
    if (voice) utt.voice = voice
    window.speechSynthesis.speak(utt)
  }

  const voices = window.speechSynthesis.getVoices()
  if (voices.length > 0) {
    doSpeak()
  } else {
    // Voices load asynchronously in Chrome/Safari; wait for the event
    window.speechSynthesis.addEventListener('voiceschanged', doSpeak, { once: true })
  }
}
