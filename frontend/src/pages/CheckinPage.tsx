import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'

export function CheckinPage() {
  const [countdown, setCountdown] = useState(15)
  const inputRef = useRef<HTMLInputElement>(null)
  const nav = useNavigate()
  const submit = async (mediaType: 'image'|'video') => {
    const data = await api.createCheckin(mediaType, 'uploads/mock-key')
    toast.success('Check-in started')
    nav(`/processing?id=${data.entry_id}`)
  }
  return <div className="space-y-4"><h1 className="text-2xl font-bold">Check In</h1><div className="grid gap-3 md:grid-cols-3"> <button onClick={()=>submit('image')} className="rounded-xl bg-surface p-6">📸 Take Selfie</button><button onClick={()=>{setCountdown(15);const t=setInterval(()=>setCountdown(c=>{if(c<=1){clearInterval(t);return 0}return c-1}),1000);submit('video')}} className="rounded-xl bg-surface p-6">🎥 Record Clip ({countdown}s)</button><button onClick={()=>inputRef.current?.click()} className="rounded-xl bg-surface p-6">📁 Upload</button></div><input ref={inputRef} type="file" className="hidden" accept=".jpg,.png,.mp4,.mov,.webm" onChange={()=>submit('image')}/></div>
}
