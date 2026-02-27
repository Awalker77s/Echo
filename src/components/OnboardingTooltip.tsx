import { useEffect, useState } from 'react'

const KEY = 'echo.ideasVault.onboarding.dismissed'

export function OnboardingTooltip() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(localStorage.getItem(KEY) !== 'true')
  }, [])

  if (!open) return null

  return (
    <div className="absolute bottom-4 left-4 z-20 max-w-xs rounded-xl border border-white/10 bg-[#111525]/95 p-3 text-xs text-slate-300">
      <p className="font-semibold text-slate-100">Quick start</p>
      <ol className="mt-1 list-decimal space-y-1 pl-4">
        <li>Drag a journal entry into the canvas.</li>
        <li>Click <strong>Generate Ideas</strong>.</li>
        <li>Use two-finger scroll to pan, pinch to zoom.</li>
      </ol>
      <button
        className="mt-2 rounded bg-white/10 px-2 py-1"
        onClick={() => {
          localStorage.setItem(KEY, 'true')
          setOpen(false)
        }}
      >
        Got it
      </button>
    </div>
  )
}
