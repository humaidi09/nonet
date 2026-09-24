// useGame — the React binding around the pure game controller. It owns the live
// game object, mirrors it to the store for "Continue", commits exactly one
// result on completion, and derives the set of cells to flag as wrong from the
// player's mistake-detection setting (never fabricating completion).

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useStore } from '@/store/useStore'
import {
  inputDigit, eraseCell, undo as undoGame, redo as redoGame, select as selectCell,
  pause as pauseGame, resume as resumeGame, restart as restartGame, markHint,
  wrongCells,
} from '@/engine/game'
import { isComplete, findConflicts } from '@/engine/sudoku'
import { getHint } from '@/engine/hints'

export function useGame(initial, { onComplete } = {}) {
  const settings = useStore((s) => s.settings)
  const setCurrentGame = useStore((s) => s.setCurrentGame)
  const completeGame = useStore((s) => s.completeGame)

  const [game, setGame] = useState(initial)
  const [notesMode, setNotesMode] = useState(false)
  const [hintCell, setHintCell] = useState(null)
  const [lastHint, setLastHint] = useState(null)
  const completedRef = useRef(false)

  // Mirror the in-progress game to the store so a reload can resume it.
  useEffect(() => {
    if (game.status === 'complete') return
    // Drop the transient feedback event before persisting (keeps resume honest
    // and stops a resumed game re-firing an old placement's sound/animation).
    const { lastEvent, ...clean } = game
    void lastEvent
    setCurrentGame(clean)
  }, [game, setCurrentGame])

  // Commit the result exactly once when the board is genuinely solved.
  useEffect(() => {
    if (game.status === 'complete' && !completedRef.current) {
      completedRef.current = true
      const summary = completeGame(game)
      onComplete?.(summary, game)
    }
  }, [game.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const clearHint = () => {
    setHintCell(null)
    setLastHint(null)
  }

  const input = useCallback(
    (digit) => {
      setHintCell(null)
      setGame((g) => inputDigit(g, g.selected, digit, { notesMode, autoClean: settings.autoNotes }))
    },
    [notesMode, settings.autoNotes],
  )

  const erase = useCallback(() => setGame((g) => eraseCell(g, g.selected)), [])
  const undo = useCallback(() => setGame((g) => undoGame(g)), [])
  const redo = useCallback(() => setGame((g) => redoGame(g)), [])
  const select = useCallback((i) => setGame((g) => selectCell(g, i)), [])
  const pause = useCallback(() => setGame((g) => pauseGame(g)), [])
  const resume = useCallback(() => setGame((g) => resumeGame(g)), [])
  const toggleNotes = useCallback(() => setNotesMode((v) => !v), [])

  const restart = useCallback(() => {
    completedRef.current = false
    clearHint()
    setGame((g) => restartGame(g))
  }, [])

  const replace = useCallback((next) => {
    completedRef.current = false
    clearHint()
    setNotesMode(false)
    setGame(next)
  }, [])

  // Hint: reveal the human technique and its target cell, then place the digit.
  const hint = useCallback(() => {
    setGame((g) => {
      if (g.status !== 'playing') return g
      const h = getHint(g.cells, g.solution)
      if (!h || h.digit == null) return g
      setHintCell(h.cell)
      setLastHint(h)
      let ng = selectCell(g, h.cell)
      ng = markHint(ng)
      ng = inputDigit(ng, h.cell, h.digit, { notesMode: false, autoClean: settings.autoNotes, viaHint: true })
      return ng
    })
  }, [settings.autoNotes])

  // Which cells to flag, per mistake-detection mode.
  const wrongSet = useMemo(() => {
    if (settings.mistakeMode === 'off') return new Set()
    if (settings.mistakeMode === 'onComplete') {
      return isComplete(game.cells) ? wrongCells(game) : new Set()
    }
    return wrongCells(game) // 'onEntry'
  }, [game, settings.mistakeMode])

  // Cells that break a Sudoku rule right now — a digit repeated in its row,
  // column or box. Rule-based (independent of the solution) and gated by the same
  // mistake-detection mode, so turning mistakes off stays fully quiet.
  const conflictSet = useMemo(() => {
    if (settings.mistakeMode === 'off') return new Set()
    if (settings.mistakeMode === 'onComplete') {
      return isComplete(game.cells) ? findConflicts(game.cells) : new Set()
    }
    return findConflicts(game.cells)
  }, [game, settings.mistakeMode])

  return {
    game,
    notesMode,
    hintCell,
    lastHint,
    wrongSet,
    conflictSet,
    canUndo: game.undo.length > 0,
    canRedo: game.redo.length > 0,
    actions: { input, erase, undo, redo, select, pause, resume, toggleNotes, restart, hint, replace, clearHint },
  }
}
