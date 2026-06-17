/**
 * Lightweight CSS confetti burst — no dependency.
 * Render conditionally; it auto-fades via the parent removing it.
 */
const COLORS = ['#a78bfa', '#38bdf8', '#34d399', '#fbbf24', '#f472b6']

export default function Confetti() {
  const pieces = Array.from({ length: 40 })
  return (
    <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
      {pieces.map((_, i) => {
        const left = (i * 2.5) % 100
        const delay = (i % 10) * 0.08
        const color = COLORS[i % COLORS.length]
        const size = 6 + (i % 4) * 2
        return (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: `${left}%`,
              width: size,
              height: size,
              background: color,
              animationDelay: `${delay}s`,
            }}
          />
        )
      })}
    </div>
  )
}
