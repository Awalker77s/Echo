import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../services/api'

export function ProcessingPage() {
  const [params] = useSearchParams(); const id = params.get('id') ?? 'entry-1'; const nav = useNavigate()
  const steps = useMemo(()=>['Analyzing facial expressions...','Reading your energy...','Writing your reflection...'],[])
  const [idx, setIdx] = useState(0)
  useEffect(()=>{ const ticker = setInterval(()=>setIdx((i)=>(i+1)%steps.length),1200); const poll = setInterval(async()=>{ const st=await api.getCheckinStatus(id); if(st.status==='complete') nav(`/result/${id}`)},2000); return ()=>{clearInterval(ticker);clearInterval(poll)} },[id,nav,steps.length])
  return <div className="grid min-h-[70vh] place-items-center text-center"><div><motion.div animate={{y:[0,-10,0]}} transition={{repeat:Infinity,duration:1.2}} className="mx-auto mb-6 h-24 w-24 rounded-full bg-primary/20"/><h1 className="text-2xl">Echo is reading you...</h1><p className="mt-2 text-textSecondary">{steps[idx]}</p></div></div>
}
