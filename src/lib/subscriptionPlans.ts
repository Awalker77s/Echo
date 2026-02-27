export interface SubscriptionPlanOption {
  value: 'core' | 'memoir' | 'lifetime'
  label: string
  checkoutPlan: string
  isPublic: boolean
  internalOnly?: boolean
}

export const SUBSCRIPTION_PLANS: SubscriptionPlanOption[] = [
  {
    value: 'core',
    label: 'Core ($10/month)',
    checkoutPlan: 'core',
    isPublic: true,
  },
  {
    value: 'memoir',
    label: 'Memoir ($20/month)',
    checkoutPlan: 'memoir',
    isPublic: false,
    internalOnly: true,
  },
  {
    value: 'lifetime',
    label: 'Lifetime ($199 one-time)',
    checkoutPlan: 'lifetime',
    isPublic: false,
    internalOnly: true,
  },
]

const showInternalPlans = import.meta.env.DEV && import.meta.env.VITE_SHOW_INTERNAL_SUBSCRIPTION_PLANS === 'true'

export const PUBLIC_SUBSCRIPTION_PLANS = SUBSCRIPTION_PLANS.filter((plan) => plan.isPublic || showInternalPlans)

export const DEFAULT_SUBSCRIPTION_PLAN = PUBLIC_SUBSCRIPTION_PLANS[0]?.value ?? 'core'
