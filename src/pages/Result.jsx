import { useMemo } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import {
  Sparkles, Trophy, Target, Gauge, Lightbulb, ArrowRight, RotateCcw, Film, GraduationCap, Flame,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { computeStats, smartDifficulty, coachAnalysis, PAR_SECONDS } from '@/engine/analysis'
import { difficultyMeta, DIFFICULTIES } from '@/engine/sudoku'
import { modeMeta } from '@/engine/game'
import { achievementById } from '@/engine/achievements'
import * as Icons from 'lucide-react'
import { Button, Panel, Stat, Badge, Callout, Sparkline, ProgressBar, cx } from '@/components/ui'
import { formatTime, formatPercent, formatDuration } from '@/lib/format'

/** One or two honest, specific observations about this solve. */
function observations(result, prevBest, stats) {
  const out = []
  const parMs = (PAR_SECONDS[result.difficulty] || 480) * 1000

  if (result.mistakes === 0 && result.hintsUsed === 0) {
    out.push({ tone: 'ok', text: 'A clean solve — no mistakes and no hints. That is the standard to repeat.' })
  } else if (result.accuracy >= 0.97) {
    out.push({ tone: 'ok', text: `High accuracy at ${formatPercent(result.accuracy)} — your placements are trustworthy.` })
  } else if (result.accuracy < 0.85) {
    out.push({ tone: 'warn', text: `Accuracy dipped to ${formatPercent(result.accuracy)}. Slowing down before committing will lift it.` })
  }

  if (prevBest != null && result.timeMs < prevBest) {
    // Base the delta on the seconds we actually display, so "N faster" always
    // matches the two times a player can see (a raw-ms delta can read 1s off).
    const deltaSec = Math.floor(prevBest / 1000) - Math.floor(result.timeMs / 1000)
    const label = difficultyMeta(result.difficulty).label
    out.push({
      tone: 'ok',
      text:
        deltaSec >= 1
          ? `New personal best for ${label} — ${formatDuration(deltaSec * 1000)} faster than before.`
          : `New personal best for ${label} — your fastest solve yet.`,
    })
  } else if (result.timeMs < parMs * 0.8) {
    out.push({ tone: 'info', text: 'Well under par pace — comfortably quick for this difficulty.' })
  } else if (result.timeMs > parMs * 1.4) {
    out.push({ tone: 'info', text: 'A patient solve. Scanning drills in Learn can build speed without hurting accuracy.' })
  }

  if (result.hintsUsed >= 3) {
    out.push({ tone: 'warn', text: `${result.hintsUsed} hints this round. Try the next one hint-free to test your reading.` })
  }
  return out.slice(0, 2)
}

export default function Result() {
  const location = useLocation()
  const navigate = useNavigate()
  const history = useStore((s) => s.history)
  const lastResultId = useStore((s) => s.lastResultId)
  const animations = useStore((s) => s.settings.animations)

  const summary = location.state
  const result = useMemo(() => {
    if (summary?.result) return summary.result
    return [...history].reverse().find((h) => h.id === lastResultId) || null
  }, [summary, history, lastResultId])

  const stats = useMemo(() => computeStats(history), [history])
  const smart = useMemo(() => smartDifficulty(history), [history])
  const coach = useMemo(() => coachAnalysis(history), [history])

  if (!result) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <h1 className="text-xl font-semibold">No recent result</h1>
        <p className="text-muted mt-1">Finish a puzzle to see your performance analysis.</p>
        <Button variant="primary" className="mt-5" as={Link} to="/play">
          Play a puzzle
        </Button>
      </div>
    )
  }

  const meta = difficultyMeta(result.difficulty)
  const prevBest = summary?.prevBest ?? null
  const isBest = prevBest != null && result.timeMs < prevBest
  const skillBefore = summary?.skillBefore
  const skillAfter = summary?.skillAfter
  const ratingDelta = skillBefore?.rating != null && skillAfter?.rating != null ? skillAfter.rating - skillBefore.rating : null
  const obs = observations(result, prevBest, stats)
  const newAchievements = summary?.newAchievements || []
  const streak = summary?.streak
  const isDaily = result.mode === 'daily'

  const ratingSeries = stats.ratingSeries.slice(-12).map((r) => r.rating)

  return (
    <div className="max-w-3xl mx-auto">
      {/* celebration header — the single orchestrated completion moment */}
      <div className="text-center pt-2 pb-6">
        <div className="mx-auto mb-4 grid place-items-center h-16 w-16 rounded-2xl bg-accent-soft text-accent animate-settle">
          {isBest ? <Trophy size={30} /> : <Sparkles size={30} />}
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold">
          {isBest ? 'New personal best' : isDaily ? 'Daily complete' : 'Puzzle solved'}
        </h1>
        <p className="text-muted mt-1.5">
          {meta.label} · {modeMeta(result.mode).label} · {formatTime(result.timeMs)}
        </p>
        {streak?.current >= 2 && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-warn/30 bg-warn-soft px-3 py-1 text-sm font-medium text-warn">
            <Flame size={15} aria-hidden="true" />
            {streak.current}-day streak{isDaily ? ' · come back tomorrow to keep it' : ''}
          </div>
        )}
      </div>

      {/* headline metrics */}
      <Panel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          <Stat label="Time" value={formatTime(result.timeMs)} icon={Gauge} sub={prevBest != null ? `Best ${formatTime(prevBest)}` : 'First at this level'} tone={isBest ? 'ok' : 'default'} />
          <Stat label="Accuracy" value={formatPercent(result.accuracy)} icon={Target} tone={result.accuracy >= 0.95 ? 'ok' : result.accuracy < 0.85 ? 'warn' : 'default'} />
          <Stat label="Mistakes" value={result.mistakes} tone={result.mistakes ? 'bad' : 'ok'} />
          <Stat label="Hints" value={result.hintsUsed} tone={result.hintsUsed ? 'warn' : 'ok'} />
        </div>
      </Panel>

      {/* skill movement + trend */}
      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        <Panel>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted">Skill</span>
            {skillAfter?.tier && <Badge tone="accent">{skillAfter.tier}</Badge>}
          </div>
          {skillAfter?.rating != null ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl tnum">{skillAfter.rating}</span>
                {ratingDelta != null && ratingDelta !== 0 && (
                  <span className={cx('text-sm font-semibold', ratingDelta > 0 ? 'text-ok' : 'text-bad')}>
                    {ratingDelta > 0 ? '+' : ''}{ratingDelta}
                  </span>
                )}
              </div>
              {skillAfter.next && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted mb-1">
                    <span>{skillAfter.tier}</span>
                    <span>{skillAfter.next.name}</span>
                  </div>
                  <ProgressBar value={skillAfter.progress} label="Progress to next tier" />
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">Play {skillAfter?.needed ?? 'a few'} more to establish a rating.</p>
          )}
        </Panel>

        <Panel>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted">Recent trend</span>
            <span className="text-xs text-faint">last {ratingSeries.length}</span>
          </div>
          {ratingSeries.length >= 2 ? (
            <Sparkline data={ratingSeries} width={280} height={56} className="w-full" />
          ) : (
            <p className="text-sm text-muted">Your trend appears as you complete more puzzles.</p>
          )}
        </Panel>
      </div>

      {/* observations */}
      {obs.length > 0 && (
        <div className="mt-4 space-y-2">
          {obs.map((o, i) => (
            <Callout key={i} tone={o.tone} icon={o.tone === 'warn' ? Lightbulb : Sparkles}>
              {o.text}
            </Callout>
          ))}
        </div>
      )}

      {/* achievements unlocked */}
      {newAchievements.length > 0 && (
        <Panel className="mt-4">
          <div className="text-sm font-medium mb-3 flex items-center gap-2">
            <Trophy size={16} className="text-warn" /> Unlocked
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {newAchievements.map((id, idx) => {
              const a = achievementById(id)
              if (!a) return null
              const Icon = Icons[a.icon] || Trophy
              return (
                <div
                  key={id}
                  className={cx(
                    'flex items-center gap-3 rounded-xl border border-warn/30 bg-warn-soft p-3',
                    animations && 'animate-pop-in',
                  )}
                  style={animations ? { animationDelay: `${idx * 90}ms`, animationFillMode: 'backwards' } : undefined}
                >
                  <Icon size={20} className="text-warn shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{a.name}</div>
                    <div className="text-xs text-muted truncate">{a.description}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      {/* recommended next action */}
      <Panel className="mt-4">
        <div className="flex items-start gap-3">
          <div className="grid place-items-center h-9 w-9 rounded-xl bg-accent-soft text-accent shrink-0">
            <ArrowRight size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">What to play next</div>
            <p className="text-sm text-muted mt-0.5">{smart.reason}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" as={Link} to={`/play?mode=${result.mode}&difficulty=${smart.recommended}`}>
            Play {difficultyMeta(smart.recommended).label}
          </Button>
          <Button variant="secondary" as={Link} to={`/play?mode=${result.mode}&difficulty=${result.difficulty}`}>
            <RotateCcw size={16} /> Another {meta.label}
          </Button>
          <Button variant="ghost" as={Link} to={`/replay/${encodeURIComponent(result.id)}`}>
            <Film size={16} /> Review solve
          </Button>
          {coach.recommendation?.lessonId && (
            <Button variant="ghost" as={Link} to={`/learn/${coach.recommendation.lessonId}`}>
              <GraduationCap size={16} /> Learn {coach.recommendation.lessonId.replace('-', ' ')}
            </Button>
          )}
        </div>
      </Panel>
    </div>
  )
}
