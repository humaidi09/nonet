import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays, Flame, Trophy, Medal, Clock, Target, CheckCircle2, ArrowRight,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { seedDailyLeaderboard } from '@/engine/seed'
import { Button, Panel, Card, Stat, Badge, Callout, SectionHeader, EmptyState, cx } from '@/components/ui'
import { formatTime, formatPercent, todayKey, fromDayKey, formatDayKeyLong } from '@/lib/format'

// The daily is always Medium — everyone plays the same board.
const DIFFICULTY = 'medium'
const DAY = 86400000

// Gold / silver / bronze tint for the top three ranks. Colour is decorative:
// the rank is also carried by list order and the medal's aria-label, so it is
// never conveyed by colour alone.
function medalStyle(rank) {
  if (rank === 0) return { color: 'var(--warn)' } // gold
  if (rank === 1) return { color: 'var(--faint)' } // silver
  return { color: 'var(--warn)', opacity: 0.65 } // bronze-ish
}

export default function Daily() {
  const daily = useStore((s) => s.daily)
  const profile = useStore((s) => s.profile)

  const today = todayKey() // 'YYYY-MM-DD'
  const todays = daily[today] // undefined | { completed, timeMs, mistakes, difficulty, accuracy, id }
  const playLink = `/play?mode=daily&difficulty=${DIFFICULTY}&seed=${today}&id=${encodeURIComponent('daily:' + today)}`

  // Consecutive-day streak, counted from completed dailies ending today/yesterday.
  const streak = useMemo(() => {
    const days = Object.keys(daily)
      .filter((k) => daily[k]?.completed)
      .sort((a, b) => fromDayKey(b) - fromDayKey(a))
    if (!days.length) return { current: 0 }
    const t = fromDayKey(today)
    let current = 0
    if (days[0] === today || fromDayKey(days[0]) === t - DAY) {
      current = 1
      for (let i = 1; i < days.length; i++) {
        if (fromDayKey(days[i - 1]) - fromDayKey(days[i]) === DAY) current++
        else break
      }
    }
    return { current }
  }, [daily, today])

  const daysPlayed = Object.values(daily).filter((d) => d.completed).length

  const bestDaily = useMemo(() => {
    const times = Object.values(daily)
      .filter((d) => d.completed)
      .map((d) => d.timeMs)
    return times.length ? Math.min(...times) : null
  }, [daily])

  // Demo field for the day + the player's real time, ranked together by time.
  const board = useMemo(() => {
    let rows = seedDailyLeaderboard(today, DIFFICULTY)
    if (todays?.completed) {
      rows = [...rows, { name: profile.username, timeMs: todays.timeMs, mistakes: todays.mistakes, you: true }]
    }
    return rows.sort((a, b) => a.timeMs - b.timeMs)
  }, [today, todays, profile.username])

  // Completed dailies, newest first, capped for a tidy list.
  const past = useMemo(
    () =>
      Object.entries(daily)
        .filter(([, v]) => v.completed)
        .sort(([a], [b]) => fromDayKey(b) - fromDayKey(a))
        .slice(0, 10),
    [daily],
  )

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold">Daily Challenge</h1>
          <p className="text-muted mt-1">One puzzle. Everyone plays the same board.</p>
        </div>
        <Badge tone="neutral" icon={CalendarDays} className="shrink-0 mt-1">
          {formatDayKeyLong(today)}
        </Badge>
      </div>

      {/* hero: today's result, or the call to play */}
      <Panel>
        {todays?.completed ? (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">Today's result</span>
                <Badge tone="ok" icon={CheckCircle2}>Completed</Badge>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4 sm:gap-8">
                <Stat label="Time" value={formatTime(todays.timeMs)} />
                <Stat label="Mistakes" value={todays.mistakes} tone={todays.mistakes === 0 ? 'ok' : 'bad'} />
                <Stat label="Accuracy" value={formatPercent(todays.accuracy)} />
              </div>
            </div>
            <Button variant="ghost" as={Link} to={`/replay/${encodeURIComponent(todays.id)}`} className="shrink-0 -mr-2">
              Review solve <ArrowRight size={16} />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-display text-xl font-semibold">Today's puzzle is ready</div>
                <p className="text-sm text-muted mt-1">Medium difficulty · keep your daily streak alive</p>
              </div>
              <Button variant="primary" size="lg" as={Link} to={playLink} className="shrink-0">
                <CalendarDays size={18} /> Play today's challenge
              </Button>
            </div>
            {streak.current > 0 && (
              <Callout tone="info" icon={Flame} className="mt-4">
                You're on a {streak.current}-day daily streak. Solve today's board to keep it going.
              </Callout>
            )}
          </>
        )}
      </Panel>

      {/* stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <Stat label="Daily streak" value={streak.current} sub="days in a row" icon={Flame} tone={streak.current ? 'warn' : 'default'} />
        </Card>
        <Card className="p-4">
          <Stat label="Days played" value={daysPlayed} sub="dailies solved" icon={Target} />
        </Card>
        <Card className="p-4">
          <Stat label="Best daily time" value={bestDaily != null ? formatTime(bestDaily) : '—'} sub="medium" icon={Clock} />
        </Card>
      </div>

      {/* leaderboard */}
      <Panel>
        <SectionHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Trophy size={18} className="text-accent" /> Leaderboard
            </span>
          }
          hint="Demo field + your time"
        />
        <ol className="space-y-1">
          {board.map((row, i) => (
            <li
              key={`${row.name}-${i}`}
              className={cx('flex items-center gap-3 rounded-lg px-2 py-2', row.you && 'bg-accent-soft')}
            >
              <span className="flex w-6 shrink-0 justify-center">
                {i < 3 ? (
                  <Medal size={18} role="img" aria-label={`Rank ${i + 1}`} style={medalStyle(i)} />
                ) : (
                  <span className="text-sm text-faint tnum">{i + 1}</span>
                )}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-semibold">{row.name}</span>
                {row.you && <Badge tone="accent">You</Badge>}
              </span>
              <span className="ml-auto flex items-center gap-3 tnum">
                <span className="text-sm font-medium">{formatTime(row.timeMs)}</span>
                <span className="whitespace-nowrap text-xs text-faint">
                  {row.mistakes} {row.mistakes === 1 ? 'mistake' : 'mistakes'}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </Panel>

      {/* history */}
      <Panel>
        <SectionHeader title="History" hint="Your completed dailies, newest first" />
        {past.length ? (
          <ul className="divide-y divide-line">
            {past.map(([key, v]) => (
              <li key={key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="min-w-0 flex-1 truncate font-medium">{formatDayKeyLong(key)}</span>
                <Badge tone="neutral" className="capitalize">{v.difficulty}</Badge>
                <span className="tnum text-sm text-muted">{formatTime(v.timeMs)}</span>
                <Link
                  to={`/replay/${encodeURIComponent(v.id)}`}
                  className="inline-flex shrink-0 items-center gap-1 text-sm text-accent hover:underline"
                >
                  Review <ArrowRight size={14} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={CalendarDays} title="No daily challenges completed yet.">
            Play today's board to start your history and daily streak.
          </EmptyState>
        )}
      </Panel>
    </div>
  )
}
