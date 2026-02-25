import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ChapterReport, Plan } from '../types'

export function MemoirPrintPage() {
  const [plan, setPlan] = useState<Plan>('free')
  const [chapters, setChapters] = useState<ChapterReport[]>([])
  const [status, setStatus] = useState('')

  useEffect(() => {
    async function load() {
      if (!supabase) return
      const [{ data: profile }, { data: reports }] = await Promise.all([
        supabase.from('users').select('plan').single(),
        supabase.from('chapter_reports').select('id,month,title,narrative,entry_count,top_themes,mood_summary,growth_moments,created_at').order('month', { ascending: false }),
      ])
      if (profile?.plan) setPlan(profile.plan as Plan)
      if (reports) setChapters(reports as ChapterReport[])
    }
    void load()
  }, [])

  async function placeOrder() {
    if (!supabase) return
    const { data, error } = await supabase.functions.invoke('order-memoir', { body: { chapterIds: chapters.map((chapter) => chapter.id) } })
    if (error) return setStatus(error.message)
    setStatus(`Order request submitted: ${data.orderId}`)
  }

  const canOrder = plan === 'memoir' || plan === 'lifetime'

  return (
    <main className="space-y-4">
      <h2 className="serif-reading text-3xl text-[#312b4e]">Printed memoir</h2>
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
        <button onClick={() => void placeOrder()} disabled={!canOrder || chapters.length === 0} className="premium-button mt-4 disabled:opacity-50">
          Order printed memoir
        </button>
      </section>
      {status && <p className="text-sm text-[#6d7589]">{status}</p>}
    </main>
  )
}
