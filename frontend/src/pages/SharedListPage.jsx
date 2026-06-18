import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function SharedListPage() {
  const { token } = useAuth()
  const code = window.location.pathname.split('/shared/')[1]?.replace(/\/$/, '')
  const [data, setData] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    fetch(`${API}/lists/shared/${code}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(setData)
      .catch(() => setNotFound(true))
  }, [code])

  const importList = async () => {
    setImporting(true)
    try {
      const res = await fetch(`${API}/lists/shared/${code}/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      setResult(await res.json())
    } catch {
      setResult({ error: true })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <a href="/" className="inline-flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm mb-8 transition-colors">
          ← Lexify
        </a>

        {notFound ? (
          <div className="glass rounded-3xl border border-white/8 p-12 text-center">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-white/50">This shared list was not found.</p>
          </div>
        ) : !data ? (
          <div className="h-64 skeleton rounded-3xl" />
        ) : (
          <div className="glass rounded-3xl border border-white/8 p-8">
            <h1 className="text-2xl font-bold grad-text mb-1">{data.title}</h1>
            <p className="text-white/35 text-sm mb-6">
              {data.count} words · shared by {data.owner || 'a Lexify user'}
            </p>

            {result ? (
              <div className="text-center py-6">
                {result.error ? (
                  <p className="text-red-400/80">Import failed. Please try again.</p>
                ) : (
                  <>
                    <div className="text-4xl mb-2">✅</div>
                    <p className="text-white/80">{result.imported} words added, {result.skipped} skipped</p>
                    <a href="/" className="inline-block mt-5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-sky-500 text-white text-sm font-medium">
                      Go to my words →
                    </a>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-6 max-h-80 overflow-y-auto">
                  {data.words.map((w, i) => (
                    <div key={i} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                      <span className="text-white/85 text-sm font-medium">{w.word}</span>
                      {w.chinese_meaning && <span className="text-white/35 text-xs ml-2">{w.chinese_meaning}</span>}
                    </div>
                  ))}
                </div>
                {token ? (
                  <button onClick={importList} disabled={importing}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-sky-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                    {importing ? 'Importing…' : 'Import this list'}
                  </button>
                ) : (
                  <a href="/" className="block text-center w-full py-3 rounded-xl glass border border-white/10 text-white/70 font-medium hover:text-white transition-all">
                    Sign in to import this list
                  </a>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
