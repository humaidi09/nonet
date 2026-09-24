// Board controls: the number pad, the action bar (undo/redo/erase/notes/hint),
// and the live timer. Sized for thumbs on mobile and keyboard-friendly on
// desktop. The number pad shows how many of each digit remain, so the player
// can see at a glance which numbers are nearly placed.

import { Undo2, Redo2, Eraser, Pencil, Lightbulb, Pause, Play as PlayIcon } from 'lucide-react'
import { remainingCount, elapsedMs } from '@/engine/game'
import { EMPTY } from '@/engine/sudoku'
import { formatTime } from '@/lib/format'
import { useNow } from '@/lib/hooks'
import { cx } from '@/components/ui'

/* --------------------------------------------------------------- NumberPad -- */

export function NumberPad({ game, onDigit, notesMode, showRemaining = true, disabled = false }) {
  // The digit sitting in the selected cell — its pad key lights up, so tapping a
  // cell visibly reaches the controls (and mirrors the board's same-number wash).
  const selectedValue =
    game.selected != null && game.selected >= 0 ? game.cells[game.selected] : EMPTY
  return (
    <div className="grid grid-cols-9 gap-1 sm:gap-1.5" role="group" aria-label="Number pad">
      {Array.from({ length: 9 }, (_, k) => {
        const d = k + 1
        const remaining = remainingCount(game, d)
        const done = remaining <= 0
        const active = d === selectedValue && !done
        return (
          <button
            key={d}
            type="button"
            onClick={() => !disabled && !done && onDigit(d)}
            disabled={disabled || done}
            aria-label={`Enter ${d}${notesMode ? ' as note' : ''}${done ? ' (all placed)' : `, ${remaining} left`}`}
            className={cx(
              'relative grid place-items-center rounded-xl border transition-colors',
              'aspect-square sm:aspect-auto sm:h-14',
              done
                ? 'border-line text-faint bg-surface-2/50'
                : notesMode
                  ? 'border-accent/40 bg-accent-soft/40 text-accent hover:bg-accent-soft'
                  : 'border-line bg-surface text-text hover:bg-surface-2 active:bg-surface-2',
              active && 'ring-2 ring-accent ring-inset border-accent/60',
            )}
          >
            <span className="font-display font-semibold text-xl sm:text-2xl leading-none">{d}</span>
            {showRemaining && !done && (
              <span className="absolute bottom-1 right-1.5 text-[10px] font-medium text-faint tnum hidden sm:block">
                {remaining}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* --------------------------------------------------------------- ActionBar -- */

function Action({ icon: Icon, label, onClick, disabled, active, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cx(
        'relative flex flex-col items-center justify-center gap-1 flex-1 h-16 rounded-xl border transition-colors',
        'disabled:opacity-40 disabled:pointer-events-none',
        active ? 'border-accent/50 bg-accent-soft text-accent' : 'border-line bg-surface text-muted hover:text-text hover:bg-surface-2',
      )}
    >
      <Icon size={20} strokeWidth={2} />
      <span className="text-[11px] font-medium">{label}</span>
      {badge != null && (
        <span className="absolute top-1 right-1.5 min-w-4 h-4 px-1 grid place-items-center rounded-full bg-accent text-accent-contrast text-[10px] font-semibold tnum">
          {badge}
        </span>
      )}
    </button>
  )
}

export function ActionBar({
  onUndo, onRedo, onErase, onToggleNotes, onHint, notesMode, canUndo, canRedo, disabled,
}) {
  return (
    <div className="flex items-stretch gap-1.5 sm:gap-2">
      <Action icon={Undo2} label="Undo" onClick={onUndo} disabled={disabled || !canUndo} />
      <Action icon={Redo2} label="Redo" onClick={onRedo} disabled={disabled || !canRedo} />
      <Action icon={Eraser} label="Erase" onClick={onErase} disabled={disabled} />
      <Action icon={Pencil} label="Notes" onClick={onToggleNotes} active={notesMode} disabled={disabled} />
      <Action icon={Lightbulb} label="Hint" onClick={onHint} disabled={disabled} />
    </div>
  )
}

/* ------------------------------------------------------------------- Timer -- */

export function Timer({ game, showControl = true, onPause, onResume }) {
  const running = game.status === 'playing'
  useNow(1000, running) // re-render each second while running
  const ms = elapsedMs(game)
  const paused = game.status === 'paused'

  return (
    <div className="inline-flex items-center gap-2">
      <span className={cx('font-display text-2xl tnum leading-none', paused && 'text-faint')}>
        {formatTime(ms)}
      </span>
      {showControl && game.status !== 'complete' && (
        <button
          type="button"
          onClick={paused ? onResume : onPause}
          className="grid place-items-center h-8 w-8 rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-colors"
          aria-label={paused ? 'Resume' : 'Pause'}
        >
          {paused ? <PlayIcon size={17} /> : <Pause size={17} />}
        </button>
      )}
    </div>
  )
}
