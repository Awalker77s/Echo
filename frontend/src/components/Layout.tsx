import { Link, Outlet, useLocation } from 'react-router-dom'

const links = ['/', '/checkin', '/history', '/analytics', '/settings']

export function Layout() {
  const { pathname } = useLocation()
  return (
    <div className="min-h-screen bg-background text-textPrimary">
      <main className="mx-auto max-w-5xl p-4 pb-20"><Outlet /></main>
      <nav className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-surface/95 p-3">
        <div className="mx-auto flex max-w-5xl justify-around text-sm">
          {links.map((l) => <Link key={l} to={l} className={pathname===l?'text-primary':'text-textSecondary'}>{l==='/'?'home':l.replace('/','')}</Link>)}
        </div>
      </nav>
    </div>
  )
}
