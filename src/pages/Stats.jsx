// Statistics — a precise, honest read on the player's solving. Every figure is
// derived from real history via the analysis engine; nothing here is fabricated.
// Built entirely from the shared UI kit and semantic tokens, so it flips cleanly
// between light and dark.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3, Gauge, Target, Trophy, Flame, CheckCircle2, Lightbulb, Percent, Timer,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { computeStats, computeSkill } from '@/engine/analysis'
import { DIFFICULTIES } from '@/engine/sudoku'
import {
  Panel, SectionHeader, Stat, Badge, EmptyState, Button, Segmented,
  LineChart, BarChart, Donut, ActivityCalendar, DIFFICULTY_COLOR,
} from '@/components/ui'
import Reveal from '@/components/ui/Reveal'
import { formatTime, formatPercent, formatNumber, toDayKey, todayKey } from '@/lib/format'

export default function Stats() {
  const history = useStore((s) => s.history)
  const profile = useStore((s) => s.profile)

  // Scope every derived figure to one difficulty (or 'all'). Filtering the raw
  // history keeps the analysis engine the single source of truth — no figure is
  // recomputed by hand here.
  // Two independent filters, composed source → difficulty. `source` separates the
  // player's own solves from the first-run demo history (tagged `synthetic`), so
  // real progress is never hidden behind demo data; `scope` narrows to one level.
  const [source, setSource] = useState('all')
  const [scope, setScope] = useState('all')

  const realCount = useMemo(() => history.filter((g) => !g.synthetic).length, [history])
  const hasDemo = history.length > realCount
  const canSplit = hasDemo && realCount > 0
  const src = canSplit ? source : 'all' // ignore a stale 'mine' when there is nothing to split
  const demoInView = src === 'all' && hasDemo

  const scopeLabel = scope === 'all' ? 'All' : DIFFICULTIES.find((d) => d.id === scope)?.label ?? scope
  const sourced = useMemo(
    () => (src === 'mine' ? history.filter((g) => !g.synthetic) : history),
    [history, src],
  )
  const scoped = useMemo(
    () => (scope === 'all' ? sourced : sourced.filter((g) => g.difficulty === scope)),
    [sourced, scope],
  )
  const SCOPES = [{ value: 'all', label: 'All' }, ...DIFFICULTIES.map((d) => ({ value: d.id, label: d.label }))]

  const stats = useMemo(() => computeStats(scoped), [scoped])
  const skill = useMemo(() => computeSkill(scoped), [scoped])
  const counts = useMemo(
    () =>
      scoped.reduce((acc, g) => {
        const key = toDayKey(new Date(g.date))
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {}),
    [scoped],
  )

  const overview = [
    { label: 'Solved', value: stats.completed, icon: CheckCircle2 },
    { label: 'Completion rate', value: formatPercent(stats.completionRate), icon: Percent, tone: 'accent' },
    { label: 'Best time', value: formatTime(stats.bestTimeMs), icon: Gauge },
    { label: 'Avg time', value: formatTime(stats.avgTimeMs), icon: Timer },
    { label: 'Avg accuracy', value: formatPercent(stats.avgAccuracy), icon: Target },
    { label: 'Flawless solves', value: formatPercent(stats.flawlessRate), icon: Trophy, tone: 'ok' },
    { label: 'Hint-free', value: formatPercent(stats.hintFreeRate), icon: Lightbulb },
    ...(scope === 'all' && src === 'all'
      ? [{
          label: 'Current streak',
          value: profile.streak.current,
          sub: `Best ${profile.streak.longest}`,
          icon: Flame,
          tone: profile.streak.current ? 'warn' : 'default',
        }]
      : []),
  ]

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="space-y-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold">Statistics</h1>
            <p className="text-muted mt-1">
              {src === 'mine'
                ? scope === 'all'
                  ? 'Your own solves only — demo history set aside.'
                  : `Your own ${scopeLabel} solves.`
                : scope === 'all'
                  ? "How your solving is trending across every puzzle you've played."
                  : `Your solving on ${scopeLabel} puzzles.`}
            </p>
          </div>
          {history.length > 0 && (
            <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
              <Segmented
                size="sm"
                aria-label="Filter statistics by difficulty"
                options={SCOPES}
                value={scope}
                onChange={setScope}
              />
            </div>
          )}
        </div>

        {canSplit && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Segmented
              size="sm"
              aria-label="Filter statistics by data source"
              options={[{ value: 'all', label: 'All play' }, { value: 'mine', label: 'Mine' }]}
              value={src}
              onChange={setSource}
            />
            {demoInView && (
              <span className="text-xs text-faint">
                Includes {history.length - realCount} demo {history.length - realCount === 1 ? 'solve' : 'solves'} — switch to Mine for just yours.
              </span>
            )}
          </div>
        )}

        {!canSplit && hasDemo && realCount === 0 && (
          <p className="text-xs text-faint">
            Showing demo history so you can explore. Your own solves replace it as you play.
          </p>
        )}
      </div>

      {history.length === 0 ? (
        <Panel>
          <EmptyState
            icon={BarChart3}
            title="No stats yet"
            action={
              <Button variant="primary" as={Link} to="/play">
                Play a puzzle
              </Button>
            }
          >
            Play a puzzle and your performance will appear here.
          </EmptyState>
        </Panel>
      ) : scoped.length === 0 ? (
        <Panel>
          <EmptyState
            icon={BarChart3}
            title={`No ${scopeLabel} solves yet`}
            action={
              <Button variant="primary" as={Link} to={`/play?difficulty=${scope}`}>
                Play {scopeLabel}
              </Button>
            }
          >
            Complete a {scopeLabel} puzzle and its stats will appear here.
          </EmptyState>
        </Panel>
      ) : (
        <>
          {/* overview */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {overview.map((metric, i) => (
              <Reveal key={metric.label} className="h-full" delay={(i % 3) * 0.06}>
                <Panel className="h-full py-4">
                  <Stat
                    label={metric.label}
                    value={metric.value}
                    sub={metric.sub}
                    tone={metric.tone}
                    icon={metric.icon}
                  />
                </Panel>
              </Reveal>
            ))}
          </div>

          {/* skill trend */}
          <Reveal>
            <Panel>
              <SectionHeader
                title="Skill trend"
                hint="Demonstrated rating per solve"
                action={
                  skill.rating != null ? (
                    <Badge tone="accent" icon={Trophy}>{`${skill.rating} · ${skill.tier}`}</Badge>
                  ) : (
                    <Badge tone="neutral">{skill.tier}</Badge>
                  )
                }
              />
              {stats.ratingSeries.length >= 2 ? (
                <LineChart data={stats.ratingSeries.map((r) => r.rating)} height={200} formatY={(v) => v} />
              ) : (
                <p className="text-sm text-muted">Play a few more puzzles to see a trend.</p>
              )}
            </Panel>
          </Reveal>

          {/* distribution + best times — a cross-difficulty comparison, so it is
              only meaningful when viewing all levels together */}
          {scope === 'all' && (
            <div className="grid lg:grid-cols-2 gap-4">
            <Reveal className="h-full">
              <Panel className="h-full">
                <SectionHeader title="Puzzles by difficulty" />
                <BarChart
                  data={DIFFICULTIES.map((d) => ({
                    label: d.label,
                    value: stats.distribution[d.id] || 0,
                    color: DIFFICULTY_COLOR[d.id],
                  }))}
                  formatValue={formatNumber}
                />
              </Panel>
            </Reveal>

            <Reveal className="h-full" delay={0.06}>
              <Panel className="h-full">
                <SectionHeader title="Best time by difficulty" />
                <ul className="space-y-3">
                  {DIFFICULTIES.map((d) => (
                    <li key={d.id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: DIFFICULTY_COLOR[d.id] }}
                        />
                        <span className="truncate">{d.label}</span>
                      </span>
                      <span className="tnum text-muted">{formatTime(stats.bestByDifficulty[d.id])}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </Reveal>
            </div>
          )}

          {/* activity */}
          <Reveal>
            <Panel>
              <SectionHeader title="Activity" hint="Last 18 weeks" />
              <div className="overflow-x-auto no-scrollbar">
                <ActivityCalendar
                  counts={counts}
                  weeks={18}
                  toDayKey={toDayKey}
                  todayKey={todayKey}
                  className="max-w-full"
                />
              </div>
              <div className="flex items-center gap-1.5 mt-4 text-xs text-faint">
                <span>Less</span>
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: 'var(--surface-2)' }} />
                <span
                  className="h-3 w-3 rounded-sm"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 45%, transparent)' }}
                />
                <span
                  className="h-3 w-3 rounded-sm"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 72%, transparent)' }}
                />
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: 'var(--accent)' }} />
                <span>More</span>
              </div>
            </Panel>
          </Reveal>

          {/* accuracy */}
          <Reveal>
            <Panel>
              <SectionHeader title="Accuracy" hint="Flawless solves and where mistakes creep in" />
              <div className="grid sm:grid-cols-2 gap-6 items-center">
                <div className="grid place-items-center">
                  <Donut
                    segments={[
                      { value: stats.flawlessRate, color: 'var(--ok)', label: 'Flawless' },
                      { value: 1 - stats.flawlessRate, color: 'var(--surface-2)', label: 'With mistakes' },
                    ]}
                    size={132}
                  >
                    <div>
                      <div className="font-display text-2xl leading-none tnum">{formatPercent(stats.flawlessRate)}</div>
                      <div className="text-xs text-faint mt-1">flawless</div>
                    </div>
                  </Donut>
                </div>
                <div className="space-y-4">
                  <Stat label="Avg accuracy" value={formatPercent(stats.avgAccuracy)} tone="accent" icon={Target} />
                  <Stat label="Mistake rate" value={formatPercent(stats.mistakeRate)} icon={Percent} />
                  <Stat label="Avg hints" value={stats.avgHints.toFixed(1)} sub="per solve" icon={Lightbulb} />
                </div>
              </div>
            </Panel>
          </Reveal>
        </>
      )}
    </div>
  )
}
