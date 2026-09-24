import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Play as PlayIcon, Flame, Gauge, Trophy, Target, ArrowRight, CalendarDays,
  Sparkles, RefreshCw, ChevronRight,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { createGame, inputDigit, select as selectCell, wrongCells, modeMeta } from '@/engine/game'
import { difficultyMeta } from '@/engine/sudoku'
import { computeSkill, computeStats, smartDifficulty, coachAnalysis, personalBest, recentResults } from '@/engine/analysis'
import { Board } from '@/components/board/Board'
import { NumberPad } from '@/components/board/Controls'
import { Button, Panel, Card, Stat, Badge, Sparkline, ProgressBar, cx } from '@/components/ui'
import Reveal from '@/components/ui/Reveal'
import { formatTime, formatPercent, formatRelativeDay, todayKey } from '@/lib/format'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Late night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/* ---------------------------------------------------- interactive preview -- */
// A local demo board — it is fully playable but never touches the saved game,
// so "Continue" stays intact. "Open full game" hands the same seed to Play.

function MiniBoard() {
  const settings = useStore((s) => s.settings)
  const [demo, setDemo] = useState(() => createGame({ mode: 'classic', difficulty: 'easy' }))
  const wrongSet = useMemo(() => wrongCells(demo), [demo])
  const solved = demo.status === 'complete'

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-accent" />
          <span className="text-sm font-medium">Warm up</span>
        </div>
        <button
          onClick={() => setDemo(createGame({ mode: 'classic', difficulty: 'easy' }))}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text transition-colors"
        >
          <RefreshCw size={13} /> New
        </button>
      </div>

      <Board
        game={demo}
        wrongSet={wrongSet}
        onSelect={(i) => setDemo((g) => selectCell(g, i))}
        settings={settings}
        interactive={!solved}
        maxWidth={340}
      />

      <div className="mt-3">
        <NumberPad
          game={demo}
          onDigit={(d) => setDemo((g) => inputDigit(g, g.selected, d, { autoClean: settings.autoNotes }))}
          showRemaining={false}
          disabled={solved}
        />
      </div>

      <Button variant="primary" full className="mt-3" as={Link} to={`/play?mode=classic&difficulty=easy&seed=${demo.seed}`}>
        <PlayIcon size={16} /> Open full game
      </Button>
    </Card>
  )
}

/* ------------------------------------------------------------------ cards -- */

function StatStrip({ streak, bestOverall, skill, solvedCount }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Panel className="py-4">
        <Stat label="Streak" value={streak.current} sub={streak.longest ? `Best ${streak.longest}` : 'days'} icon={Flame} tone={streak.current ? 'warn' : 'default'} />
      </Panel>
      <Panel className="py-4">
        <Stat label="Best time" value={bestOverall != null ? formatTime(bestOverall) : '—'} icon={Gauge} sub="all difficulties" />
      </Panel>
      <Panel className="py-4">
        <Stat label="Skill" value={skill.rating ?? '—'} sub={skill.tier} icon={Trophy} tone="accent" />
      </Panel>
      <Panel className="py-4">
        <Stat label="Solved" value={solvedCount} icon={Target} sub="puzzles" />
      </Panel>
    </div>
  )
}

export default function Home() {
  const profile = useStore((s) => s.profile)
  const history = useStore((s) => s.history)
  const currentGame = useStore((s) => s.currentGame)
  const daily = useStore((s) => s.daily)

  const skill = useMemo(() => computeSkill(history), [history])
  const stats = useMemo(() => computeStats(history), [history])
  const smart = useMemo(() => smartDifficulty(history), [history])
  const coach = useMemo(() => coachAnalysis(history), [history])
  const recent = useMemo(() => recentResults(history, 5), [history])
  const bestOverall = useMemo(() => personalBest(history), [history])

  const todaysDaily = daily[todayKey()]
  const hasContinue = currentGame && currentGame.status !== 'complete'
  const trend = stats.ratingSeries.slice(-14).map((r) => r.rating)

  return (
    <div className="space-y-6">
      {/* greeting */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold">
          {greeting()}, {profile.username}
        </h1>
        <p className="text-muted mt-1">
          {hasContinue ? 'You have a puzzle in progress.' : "Here's your studio. Start solving in seconds."}
        </p>
      </div>

      {/* hero: primary actions + interactive preview */}
      <div className="grid lg:grid-cols-[1fr_20rem] gap-5 items-start">
        <div className="space-y-4">
          {/* primary action */}
          {hasContinue ? (
            <Panel className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm text-muted">Continue puzzle</div>
                <div className="font-display text-xl font-semibold mt-0.5 capitalize">
                  {difficultyMeta(currentGame.difficulty).label} · {modeMeta(currentGame.mode).label}
                </div>
                <div className="text-sm text-muted mt-0.5">{currentGame.mistakes} mistakes so far</div>
              </div>
              <Button variant="primary" size="lg" as={Link} to="/play?resume=1">
                <PlayIcon size={18} /> Resume
              </Button>
            </Panel>
          ) : (
            <Panel className="flex items-center justify-between gap-4">
              <div>
                <div className="font-display text-xl font-semibold">Ready when you are</div>
                <div className="text-sm text-muted mt-0.5">Jump into a fresh puzzle at your level.</div>
              </div>
              <Button variant="primary" size="lg" as={Link} to={`/play?mode=classic&difficulty=${smart.recommended}`}>
                <PlayIcon size={18} /> Play
              </Button>
            </Panel>
          )}

          {/* today's challenge + recommended */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Reveal className="h-full">
              <Card className="p-5 h-full">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CalendarDays size={16} className="text-accent" /> Today's challenge
                </div>
                {todaysDaily?.completed ? (
                  <>
                    <div className="mt-3 font-display text-2xl">{formatTime(todaysDaily.timeMs)}</div>
                    <Badge tone="ok" className="mt-2">Completed</Badge>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted mt-2">A new shared puzzle every day. Keep your daily streak alive.</p>
                    <Button variant="secondary" className="mt-3" full as={Link} to="/daily">
                      Play today's <ArrowRight size={15} />
                    </Button>
                  </>
                )}
              </Card>
            </Reveal>

            <Reveal className="h-full" delay={0.06}>
              <Card className="p-5 h-full">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles size={16} className="text-accent" /> Recommended
                </div>
                <div className="mt-3">
                  <span className="font-display text-2xl">{difficultyMeta(smart.recommended).label}</span>
                </div>
                <p className="text-sm text-muted mt-1 line-clamp-2">{smart.reason}</p>
                <Button variant="ghost" className="mt-2 -ml-2" as={Link} to={`/play?mode=classic&difficulty=${smart.recommended}`}>
                  Start <ArrowRight size={15} />
                </Button>
              </Card>
            </Reveal>
          </div>
        </div>

        <MiniBoard />
      </div>

      {/* stat strip */}
      <Reveal>
        <StatStrip streak={profile.streak} bestOverall={bestOverall} skill={skill} solvedCount={stats.completed} />
      </Reveal>

      {/* skill + recent + coach teaser */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* skill progress */}
        <Reveal className="h-full">
          <Panel className="h-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted">Skill level</span>
              <Badge tone="accent">{skill.tier}</Badge>
            </div>
            {skill.rating != null ? (
              <>
                <div className="font-display text-3xl tnum">{skill.rating}</div>
                {skill.next && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted mb-1">
                      <span>{skill.tier}</span>
                      <span>{skill.next.name}</span>
                    </div>
                    <ProgressBar value={skill.progress} label="Progress to next tier" />
                  </div>
                )}
                {trend.length >= 2 && <Sparkline data={trend} width={260} height={40} className="w-full mt-4" />}
              </>
            ) : (
              <p className="text-sm text-muted mt-2">Complete {skill.needed ?? 'a few'} more puzzles to establish a rating.</p>
            )}
          </Panel>
        </Reveal>

        {/* recent performance */}
        <Reveal className="h-full" delay={0.06}>
          <Panel className="h-full">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted">Recent performance</span>
              <Link to="/stats" className="text-xs text-accent hover:underline">Stats</Link>
            </div>
            {recent.length ? (
              <ul className="space-y-2">
                {recent.map((r, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={cx('h-1.5 w-1.5 rounded-full shrink-0', r.mistakes === 0 ? 'bg-ok' : 'bg-warn')} />
                      <span className="capitalize truncate">{difficultyMeta(r.difficulty).label}</span>
                    </span>
                    <span className="flex items-center gap-3 text-muted tnum">
                      <span>{formatTime(r.timeMs)}</span>
                      <span className="text-xs text-faint w-16 text-right">{formatRelativeDay(r.date)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No games yet — your recent solves will appear here.</p>
            )}
          </Panel>
        </Reveal>

        {/* coach teaser */}
        <Reveal className="h-full" delay={0.12}>
          <Panel className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted">Your coach</span>
            </div>
            <div className="font-medium">{coach.headline}</div>
            <p className="text-sm text-muted mt-1 flex-1 line-clamp-4">{coach.detail}</p>
            <Button variant="secondary" className="mt-3" full as={Link} to="/profile">
              Open coach <ChevronRight size={15} />
            </Button>
          </Panel>
        </Reveal>
      </div>
    </div>
  )
}
