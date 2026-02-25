import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-xs uppercase tracking-[0.18em] text-[#7f778f]">404</p>
      <h1 className="serif-reading text-4xl text-[#302b4f]">Page not found</h1>
      <p className="text-sm text-[#697184]">This page may have moved, or the link is no longer valid.</p>
      <div className="flex gap-3">
        <Link to="/" className="premium-button">Go home</Link>
        <Link to="/timeline" className="soft-pill">Open timeline</Link>
      </div>
    </main>
  )
}
