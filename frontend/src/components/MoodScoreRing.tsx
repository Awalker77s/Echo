import { motion } from 'motion/react'

export function MoodScoreRing({ score, size = 180 }: { score: number; size?: number }) {
  const stroke = 10
  const r = size / 2 - stroke
  const c = 2 * Math.PI * r
  const target = c - (score / 100) * c
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} stroke="#2a2a33" strokeWidth={stroke} fill="transparent" />
        <motion.circle
          cx={size/2} cy={size/2} r={r}
          stroke="#7B61FF" strokeWidth={stroke} fill="transparent"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: target }} transition={{ duration: 1 }}
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-3xl font-bold">{score}</div>
    </div>
  )
}
