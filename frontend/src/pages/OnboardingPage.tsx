import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'

export function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('Alex')
  const [tz, setTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [time, setTime] = useState('08:00')
  const setNameGlobal = useAppStore((s) => s.setName)
  const nav = useNavigate()
  const steps = useMemo(()=>[
    <input className="w-full rounded bg-surface p-3" value={name} onChange={(e)=>setName(e.target.value)} />,
    <select className="w-full rounded bg-surface p-3" value={tz} onChange={(e)=>setTz(e.target.value)}><option>{tz}</option><option>UTC</option><option>America/New_York</option></select>,
    <div className="space-y-3"><input type="time" className="w-full rounded bg-surface p-3" value={time} onChange={(e)=>setTime(e.target.value)} /><label className="flex gap-2"><input type="checkbox" defaultChecked/> Enable reminders</label></div>
  ],[name,tz,time])
  const titles=['What should we call you?','Your timezone?','When should Echo remind you?']
  return <div className="mx-auto max-w-md space-y-6 py-10"><h2 className="text-2xl font-bold">{titles[step]}</h2><motion.div key={step} initial={{x:20,opacity:0}} animate={{x:0,opacity:1}}>{steps[step]}</motion.div><div className="flex gap-2">{[0,1,2].map(i=><div key={i} className={`h-2 flex-1 rounded ${i===step?'bg-primary':'bg-surface'}`}/>)}</div><button className="w-full rounded bg-primary p-3" onClick={()=> step<2?setStep(step+1):(setNameGlobal(name),nav('/'))}>Continue</button></div>
}
