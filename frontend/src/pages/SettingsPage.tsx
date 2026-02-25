import { useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import { mockEntries } from '../services/mockData'
import { useAppStore } from '../store/useAppStore'

export function SettingsPage() {
  const [name,setName] = useState('Alex'); const tier = useAppStore((s)=>s.tier)
  const exportData = () => { const blob = new Blob([JSON.stringify(mockEntries,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='echo-data.json'; a.click() }
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Settings</h1><section className="rounded bg-surface p-3 space-y-2"><h3>Profile</h3><input className="w-full rounded bg-background p-2" value={name} onChange={(e)=>setName(e.target.value)}/><input type="file"/></section><section className="rounded bg-surface p-3 space-y-2"><h3>Notifications</h3><label><input type="checkbox" defaultChecked/> Daily reminder</label><input type="time" className="rounded bg-background p-2" defaultValue="08:00"/></section><section className="rounded bg-surface p-3 space-y-2"><h3>Privacy</h3><label><input type="checkbox" defaultChecked/> Auto-delete media after analysis</label><button onClick={exportData} className="rounded bg-background px-3 py-2">Export my data</button><button onClick={()=>toast('Confirm delete modal placeholder')} className="rounded bg-red-500/20 px-3 py-2">Delete account</button></section><section className="rounded bg-surface p-3 space-y-2"><h3>Subscription</h3><span className="rounded bg-background px-2 py-1">{tier.toUpperCase()}</span><button onClick={async()=>window.location.href=(await api.getPortal()).portal_url} className="block rounded bg-background px-3 py-2">Manage Subscription</button>{tier==='free' && <a href="/upgrade" className="block rounded bg-primary px-3 py-2 text-center">Upgrade to Premium</a>}</section></div>
}
