import { type PropsWithChildren, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { signOut } from '../lib/auth'

const navLinks = [
  { to: '/', label: 'Home', icon: '●' },
  { to: '/timeline', label: 'Timeline', icon: '◷' },
  { to: '/mood', label: 'Mood', icon: '◔' },
  { to: '/ideas', label: 'Ideas', icon: '✦' },
  { to: '/insights', label: 'Insights', icon: '◈' },
  { to: '/chapters', label: 'Chapters', icon: '❦' },
]

const mobileLinks = [
  { to: '/', label: 'Home', icon: '●' },
  { to: '/timeline', label: 'Timeline', icon: '◷' },
  { to: '/mood', label: 'Mood', icon: '◔' },
  { to: '/ideas', label: 'Ideas', icon: '✦' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

const menuItems = [
  { to: '/settings', label: 'Settings', icon: '⚙' },
  { to: '/subscription', label: 'Subscription', icon: '✧' },
]

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'))
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode)
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <div className="min-h-screen bg-slate-100 pb-20 text-slate-900 dark:bg-slate-900 dark:text-gray-100 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-[#e7e1da] bg-[var(--surface)]/85 backdrop-blur dark:border-gray-700 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#7f7b92] dark:text-slate-400">Echo Journal</p>
            <h1 className="serif-reading text-xl text-[#262138] dark:text-gray-100">Speak. Remember. Understand.</h1>
          </div>
          <div className="hidden items-center gap-2 text-sm md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`rounded-full px-3 py-2 transition ${
                  location.pathname === link.to
                    ? 'bg-[#e6e1fb] text-[#423b84] dark:bg-[#31295e] dark:text-[#b9b3ff]'
                    : 'text-[#616776] hover:bg-[#f1ece6] dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className={`rounded-full px-3 py-2 transition ${
                  menuOpen || ['/settings', '/subscription'].includes(location.pathname)
                    ? 'bg-[#e6e1fb] text-[#423b84] dark:bg-[#31295e] dark:text-[#b9b3ff]'
                    : 'text-[#616776] hover:bg-[#f1ece6] dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
                title="Menu"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor"><circle cx="9" cy="3.5" r="1.5"/><circle cx="9" cy="9" r="1.5"/><circle cx="9" cy="14.5" r="1.5"/></svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-11 z-30 min-w-[220px] rounded-xl border border-[#e7e1da] bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-slate-800">
                  {menuItems.map((item) => (
                    <button
                      key={item.to}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition ${
                        location.pathname === item.to ? 'bg-[#f1ecff] text-[#423b84] dark:bg-[#322f52] dark:text-[#c4bdff]' : 'text-[#4a4e5a] hover:bg-[#f7f2ed] dark:text-slate-200 dark:hover:bg-slate-700'
                      }`}
                      onClick={() => { navigate(item.to); setMenuOpen(false) }}
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}

                  <div className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2 text-sm text-[#4a4e5a] dark:text-slate-200">
                      <span>{isDarkMode ? '🌙' : '☀️'}</span>
                      <span>Dark Mode</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isDarkMode}
                      onClick={() => setIsDarkMode((value) => !value)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${isDarkMode ? 'border-[#6f6ac8] bg-[#6f6ac8]' : 'border-slate-300 bg-slate-200 dark:border-slate-500 dark:bg-slate-600'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${isDarkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <div className="my-1 border-t border-[#e7e1da] dark:border-gray-700" />

                  <button
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#5f2f3b] transition hover:bg-[#fdf0f0] dark:text-rose-300 dark:hover:bg-rose-950/30"
                    onClick={() => void signOut()}
                  >
                    <span>↪</span>
                    Log out
                  </button>
                </div>
              )}
            </div>
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

      <nav className="fixed bottom-3 left-1/2 z-30 w-[min(95%,480px)] -translate-x-1/2 rounded-3xl bg-[var(--surface)]/95 p-2 shadow-[0_12px_34px_rgba(42,36,74,0.18)] backdrop-blur dark:border dark:border-gray-700 md:hidden">
        <ul className="grid grid-cols-5 gap-1">
          {mobileLinks.map((link) => {
            const active = location.pathname === link.to
            return (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className={`flex flex-col items-center rounded-2xl px-2 py-2 text-[11px] transition ${
                    active ? 'bg-[#e9e4ff] text-[#453f87] dark:bg-[#31295e] dark:text-[#c4bdff]' : 'text-[#73798a] dark:text-slate-300'
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
