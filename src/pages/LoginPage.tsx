import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signIn, signInWithGoogle } from '../lib/auth'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const { error: authError } = await signIn(email, password)
      if (authError) {
        setError(authError.message)
        setSubmitting(false)
        return
      }
      navigate('/')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to continue right now.')
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <section className="app-card w-full max-w-md p-6">
        <h1 className="serif-reading text-3xl text-[#302a4d]">Welcome back</h1>
        <p className="mt-1 text-sm text-[#6a7385]">Return to your private reflection space.</p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input className="w-full rounded-2xl bg-[#f8f2ec] p-3 outline-none" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="w-full rounded-2xl bg-[#f8f2ec] p-3 outline-none" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-[#af6b73]">{error}</p>}
          <button className="premium-button w-full" disabled={submitting}>{submitting ? 'Logging in…' : 'Log in'}</button>
        </form>
        <button onClick={() => void signInWithGoogle()} className="mt-3 w-full rounded-2xl bg-[#ebe5dd] p-3 text-[#555d72]">Continue with Google</button>
        <p className="mt-4 text-sm text-[#697083]">Need an account? <Link to="/signup" className="text-[#4e478f] underline">Sign up</Link></p>
      </section>
    </main>
  )
}
