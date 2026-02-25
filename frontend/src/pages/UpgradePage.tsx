import { useState } from 'react'
import { api } from '../services/api'

export function UpgradePage() {
  const [annual, setAnnual] = useState(true)
  const plan = annual ? 'echo_premium_annual' : 'echo_premium_monthly'
  return <div className="mx-auto max-w-xl space-y-4"><h1 className="text-3xl font-bold">Echo Premium</h1><p className="text-textSecondary">Unlock deeper emotional insights.</p><div className="flex gap-2"><button className={`rounded px-4 py-2 ${!annual?'bg-primary':'bg-surface'}`} onClick={()=>setAnnual(false)}>Monthly</button><button className={`rounded px-4 py-2 ${annual?'bg-primary':'bg-surface'}`} onClick={()=>setAnnual(true)}>Annual (save 33%)</button></div><div className="rounded bg-surface p-4 text-sm"><p>Free: 1 entry/day, 7-day history, basic mood tag</p><p>Premium: Unlimited entries, full history, analytics, AI advice, burnout alerts, downloadable reports</p></div><button onClick={async()=>window.location.href=(await api.createCheckout(plan)).checkout_url} className="w-full rounded bg-primary p-4 text-lg font-semibold">Start Premium</button><a href="/" className="block text-center text-textSecondary underline">Maybe later</a></div>
}
