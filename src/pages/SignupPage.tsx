import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signUp } from '../lib/auth'

export function SignupPage() {
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
      const { error: authError } = await signUp(email, password)
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
    <main className="flex min-h-screen items-center justify-center p-4 text-slate-900 dark:text-gray-100">
      <section className="app-card w-full max-w-md p-6">
        <h1 className="serif-reading text-3xl text-[#302a4d] dark:text-gray-100">Create your journal</h1>
        <p className="mt-1 text-sm text-[#6a7385] dark:text-slate-300">Start your voice-first reflection ritual.</p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input id="signup-email" name="email" type="email" className="w-full rounded-2xl bg-[#f8f2ec] p-3 outline-none dark:border dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 dark:placeholder:text-slate-400" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input id="signup-password" name="password" className="w-full rounded-2xl bg-[#f8f2ec] p-3 outline-none dark:border dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 dark:placeholder:text-slate-400" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-[#af6b73] dark:text-rose-300">{error}</p>}
          <button className="premium-button w-full" disabled={submitting}>{submitting ? 'Creating account…' : 'Sign up'}</button>
        </form>
        <p className="mt-4 text-sm text-[#697083] dark:text-slate-300">Already have an account? <Link to="/login" className="text-[#4e478f] underline dark:text-[#b8b2ff]">Log in</Link></p>
      </section>
    </main>
  )
}
