import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ChapterReport } from '../types'

export function ChapterReportsPage() {
  const [reports, setReports] = useState<ChapterReport[]>([])
  const [selected, setSelected] = useState<string>('')

  useEffect(() => {
    async function load() {
      if (!supabase) return
      const { data } = await supabase.from('chapter_reports').select('*').order('month', { ascending: false })
      if (data) {
        const rows = data as ChapterReport[]
        setReports(rows)
        if (rows[0]) setSelected(rows[0].id)
      }
    }
    void load()
  }, [])

  const activeReport = useMemo(() => reports.find((report) => report.id === selected) ?? null, [reports, selected])

  function shareReport() {
    if (!activeReport) return
    const text = `${activeReport.title}\n\n${activeReport.narrative.slice(0, 300)}...`
    if (navigator.share) {
      void navigator.share({ title: activeReport.title, text })
      return
    }
    void navigator.clipboard.writeText(text)
    alert('Chapter excerpt copied to clipboard.')
  }

  return (
    <main className="space-y-4">
      <h2 className="serif-reading text-3xl text-[#302b4b]">Chapter Reports</h2>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {reports.map((report) => (
          <button
            key={report.id}
            onClick={() => setSelected(report.id)}
            className={`min-w-52 rounded-3xl p-4 text-left ${report.id === selected ? 'bg-[#e8e2ff] text-[#413987]' : 'app-card text-[#5f667a]'}`}
          >
            <p className="text-xs uppercase tracking-[0.14em]">{new Date(report.month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
            <p className="serif-reading mt-2 text-lg">{report.title}</p>
          </button>
        ))}
      </div>

      <section className="app-card bg-gradient-to-b from-[#fff8f2] to-[#f8f1ea] p-6 md:p-10">
        {!activeReport ? (
          <p className="text-[#6a7284]">No chapters yet. Generate your first month to begin your memoir.</p>
        ) : (
          <article className="serif-reading space-y-5 text-[#2f2a3e]">
            <header>
              <p className="text-xs uppercase tracking-[0.16em] text-[#82788e]">
                {new Date(activeReport.month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </p>
              <h3 className="mt-2 text-4xl">{activeReport.title}</h3>
            </header>
            {activeReport.narrative.split('\n').filter(Boolean).map((paragraph, index) => (
              <p key={index} className="indent-6 text-lg leading-[1.9]">{paragraph}</p>
            ))}
            <div className="flex flex-wrap gap-3">
              <button onClick={shareReport} className="premium-button">Share</button>
              <button onClick={() => window.print()} className="soft-pill">Print</button>
            </div>
          </article>
        )}
      </section>
    </main>
  )
}
