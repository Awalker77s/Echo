import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Plan } from '../types'

const planRank: Record<Plan, number> = {
  free: 0,
  core: 1,
  memoir: 2,
  lifetime: 3,
}

interface FeatureGateProps {
  userPlan: Plan
  requiredPlan: Plan
  featureName: string
  children: ReactNode
}

export function FeatureGate({ userPlan, requiredPlan, featureName, children }: FeatureGateProps) {
  if (planRank[userPlan] >= planRank[requiredPlan]) return <>{children}</>

  return (
    <section className="app-card p-6 text-center">
      <p className="text-sm uppercase tracking-[0.16em] text-[#7b7488]">Feature locked</p>
      <h3 className="serif-reading mt-2 text-2xl text-[#312b4f]">{featureName}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-[#6d7588]">
        {requiredPlan === 'core' ? 'Upgrade to Core or above to unlock this feature.' : 'Upgrade to Memoir or Lifetime to unlock this feature.'}
      </p>
      <Link className="premium-button mt-4 inline-flex" to="/paywall">View plans</Link>
    </section>
  )
}
