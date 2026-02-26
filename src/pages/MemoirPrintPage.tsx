import { useEffect, useState } from 'react'
import { ErrorState } from '../components/ErrorState'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { supabase } from '../lib/supabase'
import { invokeEdgeFunction } from '../lib/edgeFunctions'
import type { ChapterReport, Plan } from '../types'

export function MemoirPrintPage() {
  const [plan, setPlan] = useState<Plan>('free')
  const [chapters, setChapters] = useState<ChapterReport[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!supabase) {
      setError('Supabase is not configured.')
      setLoading(false)
      return
    }
    setLoading(true)
    const [{ data: profile, error: profileError }, { data: reports, error: reportError }] = await Promise.all([
      supabase.from('users').select('plan').single(),
      supabase.from('chapter_reports').select('id,month,title,narrative,entry_count,top_themes,mood_summary,growth_moments,created_at').order('month', { ascending: false }),
    ])

    if (profileError || reportError) setError('Unable to load memoir print details right now.')
    else {
      if (profile?.plan) setPlan(profile.plan as Plan)
      setChapters((reports as ChapterReport[]) ?? [])
      setError(null)
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function placeOrder() {
    if (!supabase) return
    const { data, error: orderError } = await invokeEdgeFunction<{ orderId: string }>('order-memoir', { body: { chapterIds: chapters.map((chapter) => chapter.id) } })
    if (orderError) {
      setError(orderError.message)
      return
    }
    if (!data?.orderId) {
      setError('Order request succeeded but no order ID was returned.')
      return
    }
    setStatus(`Order request submitted: ${data.orderId}`)
  }

  const canOrder = plan === 'memoir' || plan === 'lifetime'

  if (loading) return <LoadingSkeleton lines={5} />

  return (
    <main className="space-y-4">
      <h2 className="serif-reading text-3xl text-[#312b4e]">Printed memoir</h2>
      {error && <ErrorState message={error} onAction={() => void load()} actionLabel="Try again" />}
      {!canOrder && <div className="app-card p-4 text-[#7a5d37]">Memoir printing is available on Memoir and Lifetime plans.</div>}
      <section className="app-card p-5">
        <h3 className="text-lg font-semibold">Book preview</h3>
        <ul className="mt-3 max-h-80 space-y-2 overflow-auto">
          {chapters.map((chapter) => (
            <li key={chapter.id} className="rounded-2xl bg-[#f8f3ed] p-3">
              <p className="serif-reading text-lg text-[#312b4f]">{chapter.title}</p>
              <p className="text-sm text-[#737b8e]">{new Date(chapter.month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
            </li>
          ))}
        </ul>
        <button onClick={() => void placeOrder()} disabled={!canOrder || chapters.length === 0} className="premium-button mt-4 disabled:opacity-50">Order printed memoir</button>
      </section>
      {status && <p className="text-sm text-[#6d7589]">{status}</p>}
    </main>
  )
}
