interface RecordButtonProps {
  recording: boolean
  onClick: () => void
}

export function RecordButton({ recording, onClick }: RecordButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`mx-auto flex h-44 w-44 items-center justify-center rounded-full transition duration-500 ${
        recording
          ? 'bg-gradient-to-br from-[#867fd8] to-[#5f5ab7] text-white scale-95'
          : 'bg-gradient-to-br from-[#7f78d4] to-[#5e58b0] text-white hover:scale-[1.02]'
      }`}
      style={{ animation: recording ? undefined : 'pulse-glow 2.4s infinite' }}
    >
      <div className="flex h-36 w-36 items-center justify-center rounded-full bg-white/15 backdrop-blur">
        <span className="text-xl font-semibold tracking-wide">{recording ? 'Stop' : 'Record'}</span>
      </div>
    </button>
  )
}
