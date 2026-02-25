import { create } from 'zustand'
import type { Tier } from '../types'

type AppState = {
  isAuthenticated: boolean
  name: string
  tier: Tier
  setAuth: (authenticated: boolean) => void
  setName: (name: string) => void
  setTier: (tier: Tier) => void
}

export const useAppStore = create<AppState>((set) => ({
  isAuthenticated: true,
  name: 'Alex',
  tier: 'free',
  setAuth: (isAuthenticated) => set({ isAuthenticated }),
  setName: (name) => set({ name }),
  setTier: (tier) => set({ tier })
}))
