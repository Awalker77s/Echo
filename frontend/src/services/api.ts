import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/axios'
import { mockEntries, mockUser, trend30DayData, weeklyChartData } from './mockData'
import type { CheckinStatusResponse, MoodEntry } from '../types'

const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') === 'true'
const delay = (ms = 1000) => new Promise((r) => setTimeout(r, ms))

export const api = {
  async getUser() {
    if (USE_MOCK) {
      await delay()
      return mockUser
    }
    const res = await apiClient.get('/api/v1/me')
    return res.data
  },
  async getEntries() {
    if (USE_MOCK) {
      await delay()
      return mockEntries
    }
    const res = await apiClient.get('/api/v1/entries')
    return res.data as MoodEntry[]
  },
  async getEntry(id: string) {
    if (USE_MOCK) {
      await delay()
      return mockEntries.find((e) => e.id === id) ?? mockEntries[0]
    }
    const res = await apiClient.get(`/api/v1/entries/${id}`)
    return res.data
  },
  async createCheckin(mediaType: 'image' | 'video', mediaUrl: string) {
    if (USE_MOCK) {
      await delay(500)
      return { entry_id: 'entry-1', status: 'processing' }
    }
    const res = await apiClient.post('/api/v1/checkins', { media_type: mediaType, media_url: mediaUrl })
    return res.data
  },
  async getCheckinStatus(id: string): Promise<CheckinStatusResponse> {
    if (USE_MOCK) {
      await delay(1000)
      return { entry_id: id, status: 'complete', result: mockEntries[0] }
    }
    const res = await apiClient.get(`/api/v1/checkins/${id}/status`)
    return res.data
  },
  async createCheckout(plan: 'echo_premium_monthly' | 'echo_premium_annual') {
    if (USE_MOCK) {
      await delay()
      return { checkout_url: '/upgrade' }
    }
    const res = await apiClient.post('/api/v1/billing/create-checkout', { plan })
    return res.data
  },
  async getPortal() {
    if (USE_MOCK) {
      await delay()
      return { portal_url: '/settings' }
    }
    const res = await apiClient.get('/api/v1/billing/portal')
    return res.data
  }
}

export const useUserQuery = () => useQuery({ queryKey: ['user'], queryFn: api.getUser })
export const useEntriesQuery = () => useQuery({ queryKey: ['entries'], queryFn: api.getEntries })
export const useWeeklyChartQuery = () => useQuery({ queryKey: ['weekly'], queryFn: async () => (USE_MOCK ? (await delay(), weeklyChartData) : []) })
export const useTrendQuery = () => useQuery({ queryKey: ['trend'], queryFn: async () => (USE_MOCK ? (await delay(), trend30DayData) : []) })
