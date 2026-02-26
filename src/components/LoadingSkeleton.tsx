export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="app-card space-y-3 p-5" role="status" aria-live="polite">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="h-4 rounded-full bg-[#ece5de]"
          style={{ width: `${Math.max(35, 100 - index * 12)}%`, animation: 'pulse 1.5s ease-in-out infinite' }}
        />
      ))}
    </div>
  )
}
