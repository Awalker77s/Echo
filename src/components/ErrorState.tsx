interface ErrorStateProps {
  title?: string
  message: string
  actionLabel?: string
  onAction?: () => void
}

export function ErrorState({ title = 'Something went wrong', message, actionLabel, onAction }: ErrorStateProps) {
  return (
    <div className="rounded-3xl bg-[#f8e5e8]/90 p-5 text-[#7f3e4b] shadow-[0_10px_30px_rgba(152,77,93,0.15)]">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm">{message}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="mt-3 rounded-xl bg-[#b86270] px-3 py-2 text-sm font-semibold text-white">
          {actionLabel}
        </button>
      )}
    </div>
  )
}
