// Profile — the home of the Personal Coach. The Coach is the hero here: a plain-
// language read of how you've been solving lately, the specific patterns behind
// it, and one concrete thing to do next. Everything is derived from real history
// (see engine/analysis); with too few games it says so rather than inventing a
// score. Skill, recent solves (each linking to its Replay), and an achievements
// peek round out the page.

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import * as Icons from 'lucide-react'
import {
  Sparkles, GraduationCap, Timer, Dumbbell, TrendingUp, Play as PlayIcon, ArrowRight,
  ChevronRight, Trophy, Target, Gauge, CheckCircle2, Info, AlertTriangle, Film,
  Flame, Award, Percent, Settings as SettingsIcon,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import {
  coachAnalysis, computeSkill, computeStats, smartDifficulty, recentResults, personalBest,
} from '@/engine/analysis'
import { ACHIEVEMENTS } from '@/engine/achievements'
import { difficultyMeta } from '@/engine/sudoku'
import { Avatar } from '@/components/layout/AppShell'
import { Button, Panel, Card, Stat, Badge, Callout, ProgressBar, LineChart, Divider, cx } from '@/components/ui'
import { formatTime, formatPercent, formatDate, formatRelativeDay } from '@/lib/format'

/* Map a pattern's tone to a Callout tone + icon (never colour alone). */
const PATTERN_ICON = { warn: AlertTriangle, info: Info, ok: CheckCircle2 }

/* Turn the Coach's recommendation action into a real, routed CTA. */
function recTarget(rec, smart) {
  const d = smart.recommended
  switch (rec.action) {
    case 'practice':
      return { to: `/play?mode=practice&difficulty=${d}`, label: 'Start a practice run', icon: Dumbbell }
    case 'timed':
      return { to: `/play?mode=timed&difficulty=${d}`, label: 'Start a timed run', icon: Timer }
    case 'learn':
      return { to: `/learn/${rec.lessonId || ''}`, label: 'Open the lesson', icon: GraduationCap }
    case 'harder':
      return { to: `/play?mode=classic&difficulty=${d}`, label: `Step up to ${difficultyMeta(d).label}`, icon: TrendingUp }
    case 'play':
    default:
      return { to: `/play?mode=classic&difficulty=${d}`, label: 'Play a puzzle', icon: PlayIcon }
  }
}

/* ------------------------------------------------------------------ coach -- */

function CoachPanel({ coach, smart }) {
  const rec = coach.recommendation
  const cta = recTarget(rec, smart)
  const CtaIcon = cta.icon
  const m = coach.metrics

  return (
    <Panel className="relative overflow-hidden">
      <div className="flex items-center gap-2 text-sm font-medium text-muted">
        <span className="grid place-items-center h-7 w-7 rounded-lg bg-accent-soft text-accent">
          <Sparkles size={16} />
        </span>
        Your coach
        {coach.ready && <Badge tone="neutral" className="ml-auto">Last {m?.games} solves</Badge>}
      </div>

      <h2 className="font-display text-2xl font-semibold mt-4">{coach.headline}</h2>
      <p className="text-muted mt-1.5 leading-relaxed">{coach.detail}</p>

      {/* quick read of the numbers behind it */}
      {coach.ready && m && (
        <div className="grid grid-cols-3 gap-3 mt-5">
          <Stat label="Accuracy" value={formatPercent(m.avgAccuracy)} tone={m.avgAccuracy >= 0.95 ? 'ok' : m.avgAccuracy < 0.85 ? 'warn' : 'default'} />
          <Stat label="Pace vs par" value={`${Math.round(m.medSpeed * 100)}%`} sub={m.medSpeed <= 1 ? 'at or under par' : 'over par'} tone={m.medSpeed <= 1 ? 'ok' : 'default'} />
          <Stat label="Hints / solve" value={m.avgHints.toFixed(1)} tone={m.avgHints > 2 ? 'warn' : 'default'} />
        </div>
      )}

      {/* detected patterns */}
      {coach.patterns.length > 0 && (
        <div className="mt-5 space-y-2">
          {coach.patterns.map((p) => (
            <Callout key={p.id} tone={p.tone} icon={PATTERN_ICON[p.tone] || Info} title={p.title}>
              {p.detail}
            </Callout>
          ))}
        </div>
      )}

      {/* the one thing to do next */}
      <div className="mt-5 rounded-xl border border-accent/30 bg-accent-soft/50 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-accent">Recommended next</div>
        <p className="text-sm mt-1">{rec.text}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" as={Link} to={cta.to}>
            <CtaIcon size={16} /> {cta.label}
          </Button>
          {rec.lessonId && rec.action !== 'learn' && (
            <Button variant="ghost" as={Link} to={`/learn/${rec.lessonId}`}>
              <GraduationCap size={16} /> Learn the technique
            </Button>
          )}
        </div>
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------------------ page --- */

export default function Profile() {
  const profile = useStore((s) => s.profile)
  const history = useStore((s) => s.history)
  const unlocked = useStore((s) => s.achievements)

  const coach = useMemo(() => coachAnalysis(history), [history])
  const smart = useMemo(() => smartDifficulty(history), [history])
  const skill = useMemo(() => computeSkill(history), [history])
  const stats = useMemo(() => computeStats(history), [history])
  const recent = useMemo(() => recentResults(history, 6), [history])
  const bestOverall = useMemo(() => personalBest(history), [history])

  const ratingSeries = stats.ratingSeries.map((r) => r.rating)
  const unlockedList = ACHIEVEMENTS.filter((a) => unlocked[a.id])

  return (
    <div className="space-y-6">
      {/* identity header */}
      <div className="flex items-center gap-4">
        <Avatar size={64} className="shadow-sm" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-semibold truncate">{profile.username}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted mt-1">
            <span>Member since {formatDate(profile.createdAt)}</span>
            {profile.streak.current > 0 && (
              <span className="inline-flex items-center gap-1 text-warn font-medium">
                <Flame size={14} /> {profile.streak.current}-day streak
              </span>
            )}
            <Badge tone="accent">{skill.tier}</Badge>
          </div>
        </div>
        <Button variant="secondary" size="sm" as={Link} to="/settings" className="shrink-0">
          <SettingsIcon size={16} /> <span className="hidden sm:inline">Edit profile</span>
        </Button>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem] gap-6 items-start">
        {/* left: coach is the hero */}
        <div className="space-y-6">
          <CoachPanel coach={coach} smart={smart} />

          {/* recent solves -> replay */}
          <Panel>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted">Recent solves</span>
              <Link to="/stats" className="text-xs text-accent hover:underline">All statistics</Link>
            </div>
            {recent.length ? (
              <ul className="divide-y divide-line -my-1">
                {recent.map((r) => (
                  <li key={r.id + r.date}>
                    <Link
                      to={`/replay/${encodeURIComponent(r.id)}`}
                      className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg hover:bg-surface-2 transition-colors"
                    >
                      <span className={cx('h-2 w-2 rounded-full shrink-0', r.mistakes === 0 ? 'bg-ok' : 'bg-warn')} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium capitalize truncate">
                          {difficultyMeta(r.difficulty).label} · {r.mode}
                        </span>
                        <span className="block text-xs text-faint">
                          {formatRelativeDay(r.date)} · {r.mistakes === 0 ? 'clean' : `${r.mistakes} mistake${r.mistakes > 1 ? 's' : ''}`}
                        </span>
                      </span>
                      <span className="tnum text-sm text-muted">{formatTime(r.timeMs)}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-accent shrink-0">
                        <Film size={14} /> Replay
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Your solves will appear here once you complete a puzzle.</p>
            )}
          </Panel>
        </div>

        {/* right rail: skill + achievements */}
        <div className="space-y-6">
          <Panel>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted">Skill rating</span>
              <Badge tone="accent" icon={Trophy}>{skill.tier}</Badge>
            </div>
            {skill.rating != null ? (
              <>
                <div className="font-display text-4xl tnum leading-none">{skill.rating}</div>
                {skill.next && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted mb-1">
                      <span>{skill.tier}</span>
                      <span>{skill.next.name} · {skill.next.min}</span>
                    </div>
                    <ProgressBar value={skill.progress} label={`Progress to ${skill.next.name}`} />
                  </div>
                )}
                {ratingSeries.length >= 2 ? (
                  <div className="mt-4">
                    <LineChart data={ratingSeries} height={140} formatY={(v) => v} />
                  </div>
                ) : (
                  <p className="text-xs text-faint mt-3">A rating trend appears as you play more.</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted mt-1">
                Complete {skill.needed ?? 'a few'} more {skill.needed === 1 ? 'puzzle' : 'puzzles'} to establish a rating.
              </p>
            )}
          </Panel>

          {/* quick stats */}
          <Panel>
            <div className="text-sm font-medium text-muted mb-4">At a glance</div>
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Solved" value={stats.completed} icon={Target} />
              <Stat label="Best time" value={bestOverall != null ? formatTime(bestOverall) : '—'} icon={Gauge} />
              <Stat label="Accuracy" value={formatPercent(stats.avgAccuracy)} icon={Percent} tone={stats.avgAccuracy >= 0.95 ? 'ok' : 'default'} />
              <Stat label="Flawless" value={formatPercent(stats.flawlessRate)} icon={CheckCircle2} />
            </div>
          </Panel>

          {/* achievements peek */}
          <Panel>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted">Achievements</span>
              <Link to="/achievements" className="text-xs text-accent hover:underline inline-flex items-center gap-0.5">
                View all <ChevronRight size={13} />
              </Link>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl tnum">{unlockedList.length}</span>
              <span className="text-sm text-faint">/ {ACHIEVEMENTS.length} unlocked</span>
            </div>
            {unlockedList.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-3">
                {unlockedList.slice(0, 8).map((a) => {
                  const Icon = Icons[a.icon] || Award
                  return (
                    <span
                      key={a.id}
                      title={a.name}
                      className="grid place-items-center h-9 w-9 rounded-xl bg-accent-soft text-accent"
                    >
                      <Icon size={17} />
                    </span>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted mt-2">Solve puzzles to start unlocking achievements.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
