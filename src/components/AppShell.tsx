import type { PropsWithChildren } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import { signOut } from '../lib/auth'

const links = [
  { to: '/', label: 'Home', icon: '●' },
  { to: '/timeline', label: 'Timeline', icon: '◷' },
  { to: '/mood', label: 'Mood', icon: '◔' },
  { to: '/ideas', label: 'Ideas', icon: '✦' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

const desktopLinks = [
  ...links,
  { to: '/insights', label: 'Insights', icon: '◈' },
  { to: '/chapters', label: 'Chapters', icon: '❦' },
  { to: '/subscription', label: 'Subscription', icon: '✧' },
  { to: '/memoir-print', label: 'Print', icon: '☰' },
]

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation()

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-[#e7e1da] bg-[var(--surface)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#7f7b92]">Echo Journal</p>
            <h1 className="serif-reading text-xl text-[#262138]">Speak. Remember. Understand.</h1>
          </div>
          <div className="hidden items-center gap-2 text-sm md:flex">
            {desktopLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`rounded-full px-3 py-2 transition ${
                  location.pathname === link.to
                    ? 'bg-[#e6e1fb] text-[#423b84]'
                    : 'text-[#616776] hover:bg-[#f1ece6]'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <button onClick={() => void signOut()} className="rounded-full border border-[#dbd4d2] px-3 py-2 text-[#616776]">
              Log out
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="mx-auto max-w-6xl px-4 py-6 md:px-6"
        >
          {children}
        </motion.div>
      </AnimatePresence>

      <nav className="fixed bottom-3 left-1/2 z-30 w-[min(95%,480px)] -translate-x-1/2 rounded-3xl bg-[var(--surface)]/95 p-2 shadow-[0_12px_34px_rgba(42,36,74,0.18)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-5 gap-1">
          {links.map((link) => {
            const active = location.pathname === link.to
            return (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className={`flex flex-col items-center rounded-2xl px-2 py-2 text-[11px] transition ${
                    active ? 'bg-[#e9e4ff] text-[#453f87]' : 'text-[#73798a]'
                  }`}
                >
                  <span className="text-base leading-none">{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
