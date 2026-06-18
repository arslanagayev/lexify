// Dependency-free PDF export: opens a print-friendly window and triggers
// the browser's print dialog (user saves as PDF). No external libraries.

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ))
}

export function exportWordsPdf(words, labels = {}) {
  const date = new Date().toLocaleDateString()
  const title = `${labels.title || 'My Lexify Vocabulary'} — ${date}`

  const rows = words.map((w, i) => `
    <div class="card">
      <div class="head">
        <span class="num">${i + 1}</span>
        <span class="word">${esc(w.word)}</span>
        ${w.phonetic ? `<span class="phon">${esc(w.phonetic)}</span>` : ''}
        ${w.part_of_speech ? `<span class="pos">${esc(w.part_of_speech)}</span>` : ''}
      </div>
      ${w.chinese_meaning ? `<div class="row"><b>${esc(labels.meaning || 'Meaning')}:</b> ${esc(w.chinese_meaning)}</div>` : ''}
      ${w.example_sentence ? `<div class="row ex"><b>${esc(labels.example || 'Example')}:</b> <i>${esc(w.example_sentence)}</i></div>` : ''}
      ${w.source_name ? `<div class="row src">${esc(labels.source || 'Source')}: ${esc(w.source_name)}</div>` : ''}
    </div>`).join('')

  const saveLabel = labels.saveBtn || 'Save as PDF'
  const hint = labels.hint || 'Click “Save as PDF” (or press Ctrl/Cmd+P) and choose “Save as PDF”.'

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1f2937; margin: 0; background:#f4f4f7; }
    .wrap { max-width: 760px; margin: 0 auto; padding: 28px 24px 60px; }
    .toolbar { position: sticky; top: 0; background:#ffffff; border-bottom:1px solid #e5e7eb; padding:12px 16px;
               display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .toolbar .note { font-size:12px; color:#6b7280; }
    .btn { background:linear-gradient(135deg,#7c3aed,#0891b2); color:#fff; border:0; border-radius:8px;
           padding:9px 16px; font-size:13px; font-weight:600; cursor:pointer; }
    h1 { font-size: 22px; margin: 0 0 2px; color: #6d28d9; }
    .sub { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
    .card { background:#fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; page-break-inside: avoid; }
    .head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
    .num { color: #9ca3af; font-size: 11px; }
    .word { font-size: 18px; font-weight: 700; }
    .phon { color: #6b7280; font-family: monospace; font-size: 12px; }
    .pos { font-size: 11px; color: #7c3aed; border: 1px solid #ddd6fe; border-radius: 999px; padding: 1px 8px; }
    .row { font-size: 13px; margin-top: 3px; line-height: 1.5; }
    .src { color: #9ca3af; font-size: 11px; }
    @media print {
      body { margin: 0; background:#fff; }
      .wrap { padding: 12mm; max-width:none; }
      .no-print { display: none !important; }
      .card { border-color:#e5e7eb; }
    }
  </style></head><body>
    <div class="toolbar no-print">
      <span class="note">${esc(hint)}</span>
      <button class="btn" onclick="window.print()">${esc(saveLabel)}</button>
    </div>
    <div class="wrap">
      <h1>Lexify</h1>
      <div class="sub">${esc(title)} · ${words.length} ${esc(labels.words || 'words')}</div>
      ${rows}
    </div>
  </body></html>`

  const win = window.open('', '_blank')
  if (!win) {
    alert(labels.popupBlocked || 'Please allow pop-ups to export the PDF.')
    return false
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  return true
}
