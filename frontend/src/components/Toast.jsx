import { useEffect, useState } from 'react'

export function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col-reverse gap-2 pointer-events-none">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => setVisible(true), 10)
    // Start exit animation before removal
    const exitTimer  = setTimeout(() => setVisible(false), toast.duration - 400)
    const removeTimer = setTimeout(() => onRemove(toast.id), toast.duration)
    return () => {
      clearTimeout(enterTimer)
      clearTimeout(exitTimer)
      clearTimeout(removeTimer)
    }
  }, [toast.id, toast.duration, onRemove])

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl
                  bg-[#1a1a2e] border border-violet-500/30 shadow-2xl shadow-black/50
                  transition-all duration-400
                  ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      <span className="text-lg leading-none shrink-0">{toast.icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{toast.title}</p>
        {toast.subtitle && (
          <p className="text-xs text-white/40 truncate max-w-[220px]">{toast.subtitle}</p>
        )}
      </div>
    </div>
  )
}
