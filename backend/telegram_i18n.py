from __future__ import annotations

STRINGS: dict[str, dict[str, str]] = {
    "not_linked": {
        "en": "❌ Your account is not linked. Generate a code at lexifyvocab.tech → Settings, then use /link CODE.",
        "tr": "❌ Hesabın bağlı değil. lexifyvocab.tech → Ayarlar'dan kod üret, ardından /link KOD ile bağla.",
        "ru": "❌ Аккаунт не привязан. Получи код на lexifyvocab.tech → Настройки, затем /link КОД.",
        "zh": "❌ 账号未绑定。在 lexifyvocab.tech → 设置 中生成代码，然后使用 /link 代码。",
    },
    "link_success": {
        "en": "✅ Account linked to Lexify! You can now use:\n\nadd <word> — add a word\nquery <word> — look up a word\nreview — spaced repetition list\nquiz — quiz question",
        "tr": "✅ Hesabın Lexify'a bağlandı! Artık şu komutları kullanabilirsin:\n\nadd <kelime> — kelime ekle\nquery <kelime> — kelime ara\nreview — tekrar listesi\nquiz — quiz sorusu",
        "ru": "✅ Аккаунт привязан к Lexify! Доступные команды:\n\nadd <слово> — добавить слово\nquery <слово> — найти слово\nreview — список повторения\nquiz — вопрос викторины",
        "zh": "✅ 账号已绑定到 Lexify！现在可以使用：\n\nadd <单词> — 添加单词\nquery <单词> — 查找单词\nreview — 复习列表\nquiz — 测验题",
    },
    "link_invalid": {
        "en": "❌ Invalid or expired code. Generate a new one at lexifyvocab.tech → Settings.",
        "tr": "❌ Geçersiz veya süresi dolmuş kod. lexifyvocab.tech → Ayarlar'dan yeni kod üret.",
        "ru": "❌ Недействительный или просроченный код. Получи новый на lexifyvocab.tech → Настройки.",
        "zh": "❌ 代码无效或已过期。请在 lexifyvocab.tech → 设置 中生成新代码。",
    },
    "word_not_found": {
        "en": '❌ "{word}" was not found in your list.',
        "tr": '❌ "{word}" kelimesi listenizde bulunamadı.',
        "ru": '❌ Слово "{word}" не найдено в вашем списке.',
        "zh": '❌ 您的列表中未找到"{word}"。',
    },
    "review_header": {
        "en": "📋 Words due for review ({n}):",
        "tr": "📋 Tekrar edilecek kelimeler ({n} adet):",
        "ru": "📋 Слова для повторения ({n} шт.):",
        "zh": "📋 待复习单词（{n} 个）：",
    },
    "review_empty": {
        "en": "🎉 Great job! No words due for review right now.",
        "tr": "🎉 Tebrikler! Şu an tekrar edilecek kelimen yok.",
        "ru": "🎉 Отлично! Сейчас нет слов для повторения.",
        "zh": "🎉 太棒了！目前没有需要复习的单词。",
    },
    "review_link": {
        "en": "Open review mode at: lexifyvocab.tech",
        "tr": "Lexify'da tekrar modunu aç: lexifyvocab.tech",
        "ru": "Открой режим повторения: lexifyvocab.tech",
        "zh": "打开复习模式：lexifyvocab.tech",
    },
    "quiz_not_enough": {
        "en": "📚 You need at least 2 words for a quiz. Use add <word> to add words.",
        "tr": "📚 Quiz için en az 2 kelime gerekli. add <kelime> ile kelime ekle.",
        "ru": "📚 Для викторины нужно минимум 2 слова. Добавь слова командой add <слово>.",
        "zh": "📚 测验需要至少 2 个单词。使用 add <单词> 添加单词。",
    },
    "quiz_prompt": {
        "en": "Answer: 1, 2, 3 or 4",
        "tr": "Cevabını yaz: 1, 2, 3 veya 4",
        "ru": "Введите ответ: 1, 2, 3 или 4",
        "zh": "输入答案：1、2、3 或 4",
    },
    "quiz_correct": {
        "en": '✅ Correct! "{word}" = {answer}',
        "tr": '✅ Doğru! "{word}" = {answer}',
        "ru": '✅ Верно! "{word}" = {answer}',
        "zh": '✅ 正确！"{word}" = {answer}',
    },
    "quiz_wrong": {
        "en": "❌ Wrong. Correct answer: {answer}",
        "tr": "❌ Yanlış. Doğru cevap: {answer}",
        "ru": "❌ Неверно. Правильный ответ: {answer}",
        "zh": "❌ 错误。正确答案：{answer}",
    },
    "quiz_q_meaning": {
        "en": 'What does "{word}" mean?',
        "tr": '"{word}" ne anlama gelir?',
        "ru": 'Что означает "{word}"?',
        "zh": '"{word}"是什么意思？',
    },
    "quiz_q_reverse": {
        "en": 'Which word means "{meaning}"?',
        "tr": 'Hangi kelime "{meaning}" anlamına gelir?',
        "ru": 'Какое слово означает "{meaning}"?',
        "zh": '哪个单词的意思是"{meaning}"？',
    },
    "word_already_exists": {
        "en": "Word already in your list.",
        "tr": "Bu kelime zaten listenizde.",
        "ru": "Это слово уже в вашем списке.",
        "zh": "该单词已在您的列表中。",
    },
    "enrichment_error": {
        "en": "❌ Failed to process the word. Please try again.",
        "tr": "❌ Kelime işlenirken hata oluştu. Tekrar dene.",
        "ru": "❌ Ошибка при обработке слова. Попробуй ещё раз.",
        "zh": "❌ 处理单词时出错，请重试。",
    },
}


def t(key: str, lang: str = "en", **kwargs) -> str:
    """Return translated string for key in given language, falling back to English."""
    lang = lang if lang in ("en", "tr", "ru", "zh") else "en"
    text = STRINGS.get(key, {}).get(lang) or STRINGS.get(key, {}).get("en", key)
    return text.format(**kwargs) if kwargs else text
