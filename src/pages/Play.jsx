import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, RotateCcw, Plus, Lightbulb, Sparkles } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { createGame, reviveGame, resume as resumeGame, modeMeta, MODES } from '@/engine/game'
import { DIFFICULTIES, difficultyMeta } from '@/engine/sudoku'
import { TECHNIQUES } from '@/engine/hints'
import { useGame } from '@/lib/useGame'
import { useGameFeedback } from '@/lib/feedback'
import { sound } from '@/lib/sound'
import { haptics } from '@/lib/haptics'
import { useKeydown } from '@/lib/hooks'
import { Board } from '@/components/board/Board'
import { NumberPad, ActionBar, Timer } from '@/components/board/Controls'
import { Button, Panel, Segmented, Callout, Badge, ConfirmDialog, Modal, cx } from '@/components/ui'
import { formatTime } from '@/lib/format'

/* ----------------------------------------------------------------- setup --- */

const MODE_OPTIONS = ['classic', 'timed', 'practice', 'relaxed']

function PlaySetup({ currentGame }) {
  const navigate = useNavigate()
  const [difficulty, setDifficulty] = useState('medium')
  const [mode, setMode] = useState('classic')
  const [confirmNew, setConfirmNew] = useState(false)

  const hasProgress = currentGame && currentGame.status !== 'complete'
  const start = () => navigate(`/play?mode=${mode}&difficulty=${difficulty}`)
  // Starting fresh overwrites the saved in-progress game, so confirm first.
  const onStart = () => (hasProgress ? setConfirmNew(true) : start())

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold">New puzzle</h1>
      <p className="text-muted mt-1">Choose a difficulty and a mode, then solve.</p>

      {currentGame && currentGame.status !== 'complete' && (
        <Panel className="mt-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm text-muted">Continue where you left off</div>
            <div className="font-medium mt-0.5 capitalize">
              {difficultyMeta(currentGame.difficulty).label} · {modeMeta(currentGame.mode).label}
            </div>
          </div>
          <Button variant="primary" as={Link} to="/play?resume=1">
            Resume
          </Button>
        </Panel>
      )}

      <div className="mt-6 space-y-5">
        <div>
          <div className="text-sm font-medium mb-2">Difficulty</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                onClick={() => setDifficulty(d.id)}
                className={cx(
                  'rounded-xl border p-3 text-left transition-colors',
                  difficulty === d.id ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2',
                )}
              >
                <div className="font-display text-lg font-semibold">{d.label}</div>
                <div className="text-xs text-muted mt-0.5">{d.clues} clues</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium mb-2">Mode</div>
          <div className="grid grid-cols-2 gap-2">
            {MODE_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cx(
                  'rounded-xl border p-3 text-left transition-colors',
                  mode === m ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2',
                )}
              >
                <div className="font-medium">{MODES[m].label}</div>
                <div className="text-xs text-muted mt-0.5 leading-snug">{MODES[m].blurb}</div>
              </button>
            ))}
          </div>
        </div>

        <Button variant="primary" size="lg" full onClick={onStart}>
          Start puzzle
        </Button>
      </div>

      <ConfirmDialog
        open={confirmNew}
        onClose={() => setConfirmNew(false)}
        onConfirm={start}
        title="Start a new puzzle?"
        confirmLabel="Start new"
        cancelLabel="Keep playing"
      >
        You have a puzzle in progress. Starting a new one replaces it — this can&apos;t be undone.
      </ConfirmDialog>
    </div>
  )
}

/* ------------------------------------------------------------ playing ------ */

const ARROW_DELTA = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }

function PlayGame({ params }) {
  const navigate = useNavigate()
  const settings = useStore((s) => s.settings)
  const storedGame = useStore((s) => s.currentGame)

  // Build the initial game once, from the route (or resume the stored one).
  const [initial] = useState(() => {
    if (params.get('resume') === '1' && storedGame) {
      const revived = reviveGame(storedGame)
      return revived ? resumeGame(revived) : createGame({ difficulty: 'medium' })
    }
    return createGame({
      mode: params.get('mode') || 'classic',
      difficulty: params.get('difficulty') || 'medium',
      seed: params.get('seed') || undefined,
      id: params.get('id') || undefined,
    })
  })

  const { game, notesMode, hintCell, lastHint, wrongSet, conflictSet, canUndo, canRedo, actions } = useGame(initial, {
    onComplete: (summary) => {
      // The big completion moment lives here (it holds the richer summary): play
      // a best/complete cue, buzz, and chime again if an achievement unlocked.
      const isBest = summary.prevBest == null || summary.result.timeMs < summary.prevBest.timeMs
      sound.play(isBest ? 'best' : 'complete')
      haptics.buzz('success')
      if (summary.newAchievements?.length) setTimeout(() => sound.play('achievement'), 520)
      // Let the completion moment land, then move to the analysis page.
      setTimeout(() => navigate('/result', { state: summary }), 900)
    },
  })

  const { flash } = useGameFeedback(game, settings)

  const [showRestart, setShowRestart] = useState(false)
  const meta = difficultyMeta(game.difficulty)
  const mode = modeMeta(game.mode)
  const paused = game.status === 'paused'
  const complete = game.status === 'complete'

  // Keyboard control.
  useKeydown((e) => {
    if (!settings.keyboardInput) return
    // Space toggles pause — and must work while paused, so it comes before the
    // guard below that blocks play input on a paused or finished board.
    if (e.key === ' ') {
      e.preventDefault()
      if (complete) return
      paused ? actions.resume() : actions.pause()
      return
    }
    if (complete || paused) return
    if (e.key >= '1' && e.key <= '9') {
      e.preventDefault()
      actions.input(Number(e.key))
    } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      e.preventDefault()
      actions.erase()
    } else if (ARROW_DELTA[e.key] != null) {
      e.preventDefault()
      const cur = game.selected == null ? 0 : game.selected
      const next = cur + ARROW_DELTA[e.key]
      if (next >= 0 && next < 81) {
        if ((e.key === 'ArrowLeft' && cur % 9 === 0) || (e.key === 'ArrowRight' && cur % 9 === 8)) return
        actions.select(next)
      }
    } else if (e.key === 'n' || e.key === 'N') {
      actions.toggleNotes()
    } else if (e.key === 'h' || e.key === 'H') {
      actions.hint()
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault()
      actions.undo()
    } else if (((e.ctrlKey || e.metaKey) && e.key === 'y') || (e.shiftKey && (e.ctrlKey || e.metaKey) && e.key === 'z')) {
      e.preventDefault()
      actions.redo()
    }
  }, settings.keyboardInput)

  // Auto-pause the clock when the tab is hidden, so time spent away never
  // inflates a solve. Resume on return only if we were the one who paused — a
  // manual pause (the Timer button or Space) stays paused until the player acts.
  const autoPausedRef = useRef(false)
  const gameRef = useRef(game)
  gameRef.current = game
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        if (gameRef.current.status === 'playing') {
          actionsRef.current.pause()
          autoPausedRef.current = true
        }
      } else if (autoPausedRef.current) {
        autoPausedRef.current = false
        if (gameRef.current.status === 'paused') actionsRef.current.resume()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const timerVisible = mode.timer

  return (
    <div>
      {/* header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <Link
          to="/play"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors"
        >
          <ArrowLeft size={16} /> New
        </Link>
        <div className="flex items-center gap-2">
          <Badge tone="accent">{meta.label}</Badge>
          <Badge tone="neutral">{mode.label}</Badge>
        </div>
        {timerVisible ? (
          <Timer game={game} onPause={actions.pause} onResume={actions.resume} />
        ) : (
          <span className="text-sm text-muted">No timer</span>
        )}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem] gap-6 lg:gap-8 items-start">
        {/* board column */}
        <div className="max-w-xl w-full mx-auto lg:mx-0">
          <div className={cx('relative rounded-xl', complete && settings.animations && 'animate-board-glow')}>
            <Board
              game={game}
              wrongSet={wrongSet}
              conflictSet={conflictSet}
              hintCell={hintCell}
              onSelect={actions.select}
              settings={settings}
              interactive={!paused && !complete}
              maxWidth={560}
              flash={flash}
            />
            {paused && (
              <div className="absolute inset-0 grid place-items-center rounded-xl bg-surface/80 backdrop-blur-sm">
                <div className="text-center">
                  <div className="text-muted text-sm">Paused</div>
                  <Button variant="primary" className="mt-3" onClick={actions.resume}>
                    Resume
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* controls (mobile + shared) */}
          <div className="mt-4 space-y-3">
            {lastHint && (
              <Callout tone="info" icon={Lightbulb} title={lastHint.meta?.label} className="lg:hidden">
                {lastHint.meta?.blurb}
              </Callout>
            )}
            <ActionBar
              onUndo={actions.undo}
              onRedo={actions.redo}
              onErase={actions.erase}
              onToggleNotes={actions.toggleNotes}
              onHint={actions.hint}
              notesMode={notesMode}
              canUndo={canUndo}
              canRedo={canRedo}
              disabled={paused || complete}
            />
            <NumberPad
              game={game}
              onDigit={actions.input}
              notesMode={notesMode}
              showRemaining={settings.showRemaining}
              disabled={paused || complete}
            />
          </div>
        </div>

        {/* side rail (desktop) */}
        <aside className="hidden lg:block space-y-4">
          <Panel>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Mistakes</span>
              <span className={cx('font-display text-xl tnum', game.mistakes > 0 ? 'text-bad' : 'text-text')}>
                {game.mistakes}
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-muted">Hints used</span>
              <span className="font-display text-xl tnum">{game.hintsUsed}</span>
            </div>
          </Panel>

          {lastHint && (
            <Callout tone="info" icon={Lightbulb} title={lastHint.meta?.label}>
              {lastHint.meta?.blurb}
            </Callout>
          )}

          <Panel className="space-y-2">
            <Button variant="secondary" full onClick={() => (settings.confirmRestart ? setShowRestart(true) : actions.restart())}>
              <RotateCcw size={16} /> Restart puzzle
            </Button>
            <Button variant="ghost" full as={Link} to="/play">
              <Plus size={16} /> New puzzle
            </Button>
          </Panel>

          <p className="text-xs text-faint leading-relaxed px-1">
            Keyboard: 1–9 to place, 0/⌫ to erase, arrows to move, N notes, H hint, Space pause.
          </p>
        </aside>
      </div>

      {/* mobile restart access */}
      <div className="lg:hidden mt-4 flex gap-2">
        <Button
          variant="secondary"
          full
          onClick={() => (settings.confirmRestart ? setShowRestart(true) : actions.restart())}
        >
          <RotateCcw size={16} /> Restart
        </Button>
        <Button variant="ghost" full as={Link} to="/play">
          <Plus size={16} /> New
        </Button>
      </div>

      <ConfirmDialog
        open={showRestart}
        onClose={() => setShowRestart(false)}
        onConfirm={actions.restart}
        title="Restart this puzzle?"
        confirmLabel="Restart"
      >
        Your progress on this puzzle will be cleared and the timer reset. The puzzle itself stays the same.
      </ConfirmDialog>

      {/* brief completion moment before the result page */}
      <Modal open={complete} onClose={() => {}} dismissable={false} size="sm">
        <div className="text-center py-2">
          <div className="mx-auto mb-3 grid place-items-center h-12 w-12 rounded-2xl bg-accent-soft text-accent animate-settle">
            <Sparkles size={24} />
          </div>
          <h2 className="text-lg font-semibold">Solved</h2>
          <p className="text-sm text-muted mt-1">
            {formatTime(game.elapsedMs)} · {game.mistakes} mistakes · analysing your solve…
          </p>
        </div>
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------------ page --- */

export default function Play() {
  const [params] = useSearchParams()
  const currentGame = useStore((s) => s.currentGame)
  const difficulty = params.get('difficulty')
  const resume = params.get('resume')

  if (!difficulty && !(resume === '1' && currentGame)) {
    return <PlaySetup currentGame={currentGame} />
  }

  const key =
    resume === '1'
      ? 'resume'
      : `${params.get('mode')}:${difficulty}:${params.get('seed') || ''}:${params.get('id') || ''}`
  return <PlayGame key={key} params={params} />
}
