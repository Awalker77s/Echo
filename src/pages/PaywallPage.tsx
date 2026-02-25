import { useState } from 'react'
import { ErrorState } from '../components/ErrorState'
import { supabase } from '../lib/supabase'

const plans = [
  { key: 'core', title: 'Core', price: '£7/mo', features: ['Unlimited recordings', 'Mood graph', 'Ideas Vault'], recommended: false },
  { key: 'memoir', title: 'Memoir', price: '£12/mo', features: ['Everything in Core', 'Pattern insights', 'Monthly chapters'], recommended: true },
  { key: 'lifetime', title: 'Lifetime', price: '£99 once', features: ['Everything forever', 'No subscription', 'Annual print credit'], recommended: false },
]

export function PaywallPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function checkout(plan: string) {
    if (!supabase) return
    setLoadingPlan(plan)
    setError(null)
    const { data, error } = await supabase.functions.invoke('create-checkout', { body: { plan } })
    if (error) {
      setLoadingPlan(null)
      setError(error.message)
      return
    }
    if (data?.url) window.location.href = data.url
  }

  return (
    <main className="space-y-5">
      <div className="text-center">
        <h2 className="serif-reading text-4xl text-[#2e2947]">Choose your journaling path</h2>
        <p className="mt-2 text-[#666f84]">Unlock deeper reflection and long-term personal archives.</p>
      </div>
      {error && <ErrorState message={error} />}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <article key={plan.key} className={`app-card p-6 ${plan.recommended ? 'ring-2 ring-[#8178d8]' : ''}`}>
            {plan.recommended && <p className="soft-pill mb-3 inline-flex bg-[#e6e1fb] text-[#4b438f]">Recommended</p>}
            <h3 className="text-xl font-semibold">{plan.title}</h3>
            <p className="mt-1 text-2xl font-bold text-[#3b356a]">{plan.price}</p>
            <ul className="mt-4 space-y-2 text-sm text-[#656d7f]">
              {plan.features.map((feature) => <li key={feature}>• {feature}</li>)}
            </ul>
            <button className="premium-button mt-5 w-full" disabled={loadingPlan === plan.key} onClick={() => void checkout(plan.key)}>
              {loadingPlan === plan.key ? 'Redirecting…' : 'Choose plan'}
            </button>
          </article>
        ))}
      </div>
    </main>
  )
}
