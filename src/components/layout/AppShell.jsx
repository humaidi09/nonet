// App shell + navigation. Desktop gets a persistent left rail; tablet and mobile
// get a slim top bar plus a bottom tab bar with the primary destinations and a
// "More" sheet for the rest. A clear link returns to the portfolio ecosystem.

import { useState } from 'react'
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom'
import {
  Home, Grid3x3, CalendarDays, LibraryBig, BarChart3, GraduationCap,
  Trophy, User, Settings, Sun, Moon, Monitor, ArrowLeft, Menu, Flame,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Modal, Toaster, cx } from '@/components/ui'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { useFeedbackConfig } from '@/lib/feedback'

// Nonet is served under the portfolio (humaidi.me/nonet); the back-link points
// at the site root so it returns to the portfolio home on the same origin.
const PORTFOLIO_URL = '/'

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/play', label: 'Play', icon: Grid3x3 },
  { to: '/daily', label: 'Daily', icon: CalendarDays },
  { to: '/library', label: 'Library', icon: LibraryBig },
  { to: '/stats', label: 'Statistics', icon: BarChart3 },
  { to: '/learn', label: 'Learn', icon: GraduationCap },
  { to: '/achievements', label: 'Achievements', icon: Trophy },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const BOTTOM = [NAV[0], NAV[1], NAV[2], NAV[4], NAV[5]] // Home, Play, Daily, Stats, Learn

/* ------------------------------------------------------------------ brand -- */

export function Brandmark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="8" fill="var(--ink, #0a1420)" />
      <g fill="none" stroke="#4d9bf2" strokeWidth="1.4" opacity="0.9">
        <path d="M11.5 5v22M20.5 5v22M5 11.5h22M5 20.5h22" />
      </g>
      <rect x="20.5" y="20.5" width="6.5" height="6.5" fill="#4d9bf2" />
    </svg>
  )
}

function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent rounded-lg">
      <Brandmark />
      <span className="font-display text-xl font-semibold tracking-tight">Nonet</span>
    </Link>
  )
}

/* ------------------------------------------------------------ theme toggle -- */

const THEME_CYCLE = { system: 'light', light: 'dark', dark: 'system' }
const THEME_ICON = { system: Monitor, light: Sun, dark: Moon }

function ThemeToggle({ className }) {
  const theme = useStore((s) => s.settings.theme)
  const setSetting = useStore((s) => s.setSetting)
  const Icon = THEME_ICON[theme]
  return (
    <button
      onClick={() => setSetting('theme', THEME_CYCLE[theme])}
      className={cx(
        'inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm text-muted hover:text-text hover:bg-surface-2 transition-colors capitalize',
        className,
      )}
      aria-label={`Theme: ${theme}. Switch to ${THEME_CYCLE[theme]}.`}
      title={`Theme: ${theme}`}
    >
      <Icon size={17} />
      <span className="lg:inline">{theme}</span>
    </button>
  )
}

/* ---------------------------------------------------------------- avatar --- */

const AVATAR_BG = {
  indigo: 'bg-accent text-accent-contrast',
  jade: 'bg-ok text-white',
  amber: 'bg-warn text-white',
  slate: 'bg-line-strong text-text',
}

export function Avatar({ size = 36, className }) {
  const profile = useStore((s) => s.profile)
  const letter = (profile.username || '?').trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      className={cx('inline-grid place-items-center rounded-full font-display font-semibold', AVATAR_BG[profile.avatar] || AVATAR_BG.indigo, className)}
      style={{ width: size, height: size, fontSize: size * 0.44 }}
      aria-hidden="true"
    >
      {letter}
    </span>
  )
}

function StreakPill() {
  const streak = useStore((s) => s.profile.streak.current)
  if (!streak) return null
  return (
    <span className="inline-flex items-center gap-1 h-8 px-2.5 rounded-full bg-warn-soft text-warn text-sm font-semibold tnum">
      <Flame size={15} strokeWidth={2.4} />
      {streak}
    </span>
  )
}

/* --------------------------------------------------------------- sidebar --- */

function SidebarLink({ item }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cx(
          'flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-medium transition-colors',
          isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:text-text hover:bg-surface-2',
        )
      }
    >
      <Icon size={18} strokeWidth={2} />
      {item.label}
    </NavLink>
  )
}

function Sidebar() {
  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[248px] flex-col border-r border-line bg-surface/60 bar-blur px-4 py-5 z-30">
      <div className="px-2 mb-6">
        <Wordmark />
      </div>
      <nav className="flex-1 space-y-1">
        {NAV.map((item) => (
          <SidebarLink key={item.to} item={item} />
        ))}
      </nav>
      <div className="mt-4 pt-4 border-t border-line space-y-2">
        <Link
          to="/profile"
          className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-surface-2 transition-colors"
        >
          <Avatar size={34} />
          <ProfileSummary />
        </Link>
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <a
            href={PORTFOLIO_URL}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            <ArrowLeft size={16} />
            Portfolio
          </a>
        </div>
      </div>
    </aside>
  )
}

function ProfileSummary() {
  const username = useStore((s) => s.profile.username)
  return (
    <span className="min-w-0">
      <span className="block text-sm font-medium truncate">{username}</span>
      <span className="block text-xs text-muted">View profile</span>
    </span>
  )
}

/* ---------------------------------------------------------------- top bar -- */

function TopBar({ onOpenMore }) {
  return (
    <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 border-b border-line bar-blur">
      <Wordmark />
      <div className="flex items-center gap-1.5">
        <StreakPill />
        <ThemeToggle className="px-2" />
        <button
          onClick={onOpenMore}
          className="grid place-items-center h-9 w-9 rounded-lg text-muted hover:text-text hover:bg-surface-2"
          aria-label="More"
        >
          <Menu size={20} />
        </button>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------ bottom tabs -- */

function BottomTabs() {
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-5 border-t border-line bar-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {BOTTOM.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cx(
                'flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors',
                isActive ? 'text-accent' : 'text-muted',
              )
            }
          >
            <Icon size={21} strokeWidth={2} />
            {item.label}
          </NavLink>
        )
      })}
    </nav>
  )
}

/* ---------------------------------------------------------------- shell ---- */

export function AppShell() {
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()
  useFeedbackConfig() // keep sound + haptics synced to settings; unlock audio on first gesture

  return (
    <div className="min-h-dvh">
      <Sidebar />
      <div className="lg:pl-[248px]">
        <TopBar onOpenMore={() => setMoreOpen(true)} />
        <main className="mx-auto w-full max-w-6xl 3xl:max-w-[88rem] px-4 sm:px-6 lg:px-10 py-6 pb-28 lg:pb-12">
          {/* Keyed on the path so navigating to another page clears a crashed
              screen — the sidebar and nav stay usable throughout. */}
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <BottomTabs />

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Menu" size="sm">
        <div className="grid grid-cols-2 gap-2">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className={cx(
                  'flex items-center gap-2.5 h-12 px-3 rounded-xl border text-sm font-medium transition-colors',
                  active ? 'border-accent/40 bg-accent-soft text-accent' : 'border-line hover:bg-surface-2',
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </div>
        <a
          href={PORTFOLIO_URL}
          className="mt-3 flex items-center justify-center gap-2 h-11 rounded-xl border border-line text-sm font-medium text-muted hover:text-text hover:bg-surface-2"
        >
          <ArrowLeft size={16} />
          Back to portfolio
        </a>
      </Modal>

      <Toaster />
    </div>
  )
}
