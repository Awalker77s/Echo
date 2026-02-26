import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { RecordButton } from '../components/RecordButton'
import { Waveform } from '../components/Waveform'
import { useRecorder } from '../hooks/useRecorder'
import { supabase } from '../lib/supabase'
import { invokeEdgeFunction } from '../lib/edgeFunctions'

const messages = ['Reflecting on your words...', 'Finding the meaning...', 'Crafting your memory...']

export function HomePage() {
  const { isRecording, duration, audioBlob, start, stop, analyserRef, dataArrayRef, error, resetBlob } = useRecorder()
  const [processing, setProcessing] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [messageIndex, setMessageIndex] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    if (!processing) return
    const timer = window.setInterval(() => {
      setMessageIndex((value) => (value + 1) % messages.length)
    }, 2200)
    return () => window.clearInterval(timer)
  }, [processing])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  async function submitRecording() {
    if (!audioBlob || !supabase) return
    setProcessing(true)
    setSubmitError(null)
    const file = new File([audioBlob], 'recording.webm', { type: audioBlob.type })
    const formData = new FormData()
    formData.append('audio', file)

    const { data, error: fnError } = await invokeEdgeFunction<{ id: string }>('process-recording', { body: formData })
    setProcessing(false)

    if (fnError) {
      setSubmitError(fnError.message)
      return
    }

    if (!data?.id) {
      setSubmitError('Processing completed but no entry ID was returned.')
      return
    }

    resetBlob()
    navigate(`/entries/${data.id}`)
  }

  if (isRecording) {
    return (
      <main className="fixed inset-0 z-30 flex min-h-screen flex-col justify-center gap-8 bg-[#221f32]/95 p-6 text-center text-white">
        <p className="text-sm uppercase tracking-[0.2em] text-[#cfc8ff]">Recording</p>
        <p className="text-6xl font-semibold tracking-tight">{new Date(duration * 1000).toISOString().substring(14, 19)}</p>
        <div className="mx-auto w-full max-w-xl"><Waveform analyser={analyserRef} dataArray={dataArrayRef} active={isRecording} height={180} /></div>
        <button onClick={stop} className="mx-auto rounded-full bg-[#f3edf9] px-8 py-3 font-semibold text-[#2e2854]">Stop recording</button>
      </main>
    )
  }

  if (processing) {
    return (
      <main className="flex min-h-[72vh] flex-col items-center justify-center gap-6 text-center">
        <div className="h-16 w-16 rounded-full bg-[#dcd6ff]" style={{ animation: 'breathe 1.8s ease-in-out infinite' }} />
        <h2 className="serif-reading text-3xl text-[#312a4f] dark:text-gray-100">{messages[messageIndex]}</h2>
        <p className="text-[#677087]">We’re gently shaping your entry and insights.</p>
      </main>
    )
  }

  return (
    <main className="page-fade mx-auto flex max-w-3xl flex-col gap-6">
      <section className="app-card p-6 md:p-8">
        <p className="text-sm text-[#737a8c] dark:text-slate-300">{greeting}</p>
        <h2 className="serif-reading mt-1 text-4xl text-[#302a4a] dark:text-gray-100">What’s on your mind today?</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="soft-pill">🔥 6 day streak</span>
          <span className="soft-pill">Today’s mood: Reflective</span>
        </div>
      </section>

      <section className="app-card p-8 text-center">
        <RecordButton recording={false} onClick={() => void start()} />
        <p className="mt-5 text-sm text-[#6e7587] dark:text-slate-300">Tap to begin your voice journal</p>
        {audioBlob && (
          <motion.button initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} onClick={() => void submitRecording()} className="premium-button mt-5">
            Process entry
          </motion.button>
        )}
      </section>

      {error && <p className="text-sm text-[#af6b73] dark:text-rose-300">{error}</p>}
      {submitError && <p className="text-sm text-[#af6b73] dark:text-rose-300">{submitError}</p>}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link to="/timeline" className="soft-pill">Timeline</Link>
        <Link to="/mood" className="soft-pill">Mood Dashboard</Link>
        <Link to="/ideas" className="soft-pill">Ideas Vault</Link>
        <Link to="/insights" className="soft-pill">Insights</Link>
        <Link to="/chapters" className="soft-pill">Chapter Reports</Link>
      </div>
    </main>
  )
}
