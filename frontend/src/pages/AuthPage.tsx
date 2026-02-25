import { motion } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const nav = useNavigate()
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto mt-16 max-w-md space-y-6 text-center">
      <h1 className="text-6xl font-extrabold text-primary">Echo</h1>
      <p className="text-textSecondary">Your emotions, translated.</p>
      <button className="w-full rounded-xl bg-primary p-3">Continue with Google</button>
      <button className="w-full rounded-xl bg-surface p-3">Continue with Email</button>
      <div className="space-y-2 text-left">
        <input className="w-full rounded bg-surface p-3" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input className="w-full rounded bg-surface p-3" type="password" placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)} />
      </div>
      <button onClick={()=>nav('/onboarding')} className="w-full rounded-xl bg-secondary p-3 text-black">Start</button>
    </motion.div>
  )
}
