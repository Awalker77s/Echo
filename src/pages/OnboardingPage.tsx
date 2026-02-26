import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

const slides = [
  {
    title: 'Speak your truth',
    text: 'Capture thoughts in seconds with a calm voice-first ritual.',
    gradient: 'from-[#d9d4ff] to-[#f3ebe0]',
  },
  {
    title: 'Reflect with warmth',
    text: 'AI shapes your words into a beautiful private journal entry.',
    gradient: 'from-[#d5e0ff] to-[#f8ede5]',
  },
  {
    title: 'Notice your patterns',
    text: 'Track moods, themes, and growth stories over time.',
    gradient: 'from-[#f2d9ef] to-[#eee5ff]',
  },
]

export function OnboardingPage() {
  const [index, setIndex] = useState(0)
  const navigate = useNavigate()

  const next = () => {
    if (index === slides.length - 1) {
      navigate('/signup')
      return
    }
    setIndex((value) => value + 1)
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4 text-slate-900 dark:text-gray-100">
      <motion.section
        key={index}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -80) next()
          if (info.offset.x > 80 && index > 0) setIndex((value) => value - 1)
        }}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className={`app-card w-full max-w-md bg-gradient-to-br ${slides[index].gradient} p-8 text-center dark:from-slate-800 dark:to-slate-900`}
      >
        <div className="mx-auto mb-8 h-32 w-32 rounded-full bg-white/50 dark:bg-slate-700/80" />
        <h1 className="serif-reading text-4xl text-[#2c2640] dark:text-gray-100">{slides[index].title}</h1>
        <p className="mt-4 text-[#5a6072] dark:text-slate-300">{slides[index].text}</p>
        <button onClick={next} className="premium-button mt-8 w-full">
          {index === slides.length - 1 ? 'Begin journaling' : 'Continue'}
        </button>
        <div className="mt-5 flex justify-center gap-2">
          {slides.map((_, dot) => <span key={dot} className={`h-2.5 w-2.5 rounded-full ${dot === index ? 'bg-[#655fc1]' : 'bg-white/70'}`} />)}
        </div>
      </motion.section>
    </main>
  )
}
