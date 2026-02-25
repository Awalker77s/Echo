import { type FormEvent, useState } from 'react'
import { ErrorState } from '../components/ErrorState'
import { supabase } from '../lib/supabase'

const giftPlans = [
  { value: 'core', label: 'Core (£7/month)' },
  { value: 'memoir', label: 'Memoir (£12/month)' },
  { value: 'lifetime', label: 'Lifetime (£99 one-time)' },
]

export function GiftSubscriptionsPage() {
  const [plan, setPlan] = useState('core')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function purchaseGift() {
    if (!supabase) {
      setError('Supabase is not configured.')
      return
    }
    setError(null)
    const { data, error: purchaseError } = await supabase.functions.invoke('create-gift-checkout', { body: { plan } })
    if (purchaseError) {
      setError(purchaseError.message)
      return
    }
    if (data?.url) window.location.href = data.url
  }

  async function redeemGift(event: FormEvent) {
    event.preventDefault()
    if (!supabase) {
      setError('Supabase is not configured.')
      return
    }
    setError(null)
    const { data, error: redeemError } = await supabase.functions.invoke('redeem-gift', { body: { code } })
    if (redeemError) {
      setError(redeemError.message)
      return
    }
    setMessage(`Gift redeemed! Your plan is now ${data.plan}.`)
    setCode('')
  }

  return (
    <main className="space-y-4">
      <h2 className="serif-reading text-3xl text-[#302b4c]">Gift subscriptions</h2>
      {error && <ErrorState message={error} />}

      <section className="app-card p-5">
        <h3 className="text-lg font-semibold">Send a thoughtful gift</h3>
        <p className="mt-1 text-sm text-[#6b7386]">Choose a plan and we’ll generate a private redemption code after checkout.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select className="rounded-2xl bg-[#f8f2ec] px-3 py-2" value={plan} onChange={(event) => setPlan(event.target.value)}>
            {giftPlans.map((giftPlan) => <option key={giftPlan.value} value={giftPlan.value}>{giftPlan.label}</option>)}
          </select>
          <button onClick={() => void purchaseGift()} className="premium-button">Purchase gift</button>
        </div>
      </section>

      <section className="app-card p-5">
        <h3 className="text-lg font-semibold">Redeem a gift code</h3>
        <form className="mt-3 flex flex-wrap gap-3" onSubmit={(event) => void redeemGift(event)}>
          <input className="rounded-2xl bg-[#f8f2ec] px-3 py-2" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ECHO-XXXXXX" required />
          <button className="premium-button">Redeem</button>
        </form>
      </section>

      {message && <p className="text-sm text-[#70506f]">{message}</p>}
    </main>
  )
}
