// LearnLesson — a single lesson: explanation, then a practice sized to the
// technique. `single`/`notes` lessons carry a small, self-contained board (its own
// useState, never the saved game) so completing the drill marks the lesson done;
// `read` lessons ask the player to mark the pattern understood and try it for real.

import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, Lightbulb, GraduationCap, RotateCcw } from 'lucide-react'
import { lessonById, LESSONS } from '@/data/lessons'
import { useStore } from '@/store/useStore'
import { Board } from '@/components/board/Board'
import { NumberPad } from '@/components/board/Controls'
import { createGame, inputDigit, select as selectCell, wrongCells } from '@/engine/game'
import { getHint, allNakedSingles } from '@/engine/hints'
import { Button, Panel, Card, Badge, Callout, Divider, SectionHeader, cx } from '@/components/ui'

// Count set bits in a note bitmask (bits 0..8 = pencil marks 1..9).
const bitCount = (mask) => {
  let n = 0
  let x = mask
  while (x) {
    x &= x - 1
    n += 1
  }
  return n
}

export default function LearnLesson() {
  const { id } = useParams()
  const lesson = lessonById(id)

  if (!lesson) {
    return (
      <div className="flex flex-col items-center text-center py-20">
        <div className="mb-4 grid place-items-center h-14 w-14 rounded-2xl bg-surface-2 text-faint">
          <GraduationCap size={26} strokeWidth={1.8} />
        </div>
        <h1 className="text-xl font-semibold">Lesson not found</h1>
        <p className="text-muted mt-1.5">That lesson does not exist — it may have been renamed.</p>
        <Button variant="secondary" className="mt-5" as={Link} to="/learn">
          <ArrowLeft size={16} /> All lessons
        </Button>
      </div>
    )
  }

  // Remount on id change so the practice board + captured target reset per lesson.
  return <Lesson key={id} lesson={lesson} />
}

function Lesson({ lesson }) {
  const id = lesson.id
  const navigate = useNavigate()
  const settings = useStore((s) => s.settings)
  const lessonsCompleted = useStore((s) => s.lessonsCompleted)
  const completeLesson = useStore((s) => s.completeLesson)
  const done = !!lessonsCompleted[id]

  const idx = LESSONS.findIndex((l) => l.id === id)
  const prev = LESSONS[idx - 1]
  const next = LESSONS[idx + 1]

  const interactive = lesson.practice === 'single' || lesson.practice === 'notes'
  const seed = `lesson-${id}`

  // Local practice board — kept in useState, never the saved game. Same seed for the
  // live board and the captured target so their cell indices align.
  const [g, setG] = useState(() => createGame({ mode: 'practice', difficulty: 'easy', seed }))
  const [notesMode, setNotesMode] = useState(false)
  // Every cell that presents as a single in the starting position — placing ANY
  // of them correctly completes the drill, so a player who spots a different
  // valid single than we might have picked is still rewarded. Fall back to the
  // first hint so the lesson stays completable even without a naked single.
  const [targets] = useState(() => {
    const g0 = createGame({ mode: 'practice', difficulty: 'easy', seed })
    const singles = allNakedSingles(g0.cells)
    if (singles.length) return singles.map((s) => ({ cell: s.cell, digit: s.digit }))
    const h = getHint(g0.cells, g0.solution)
    return h ? [{ cell: h.cell, digit: h.digit }] : []
  })

  const hint = useMemo(() => getHint(g.cells, g.solution), [g])
  const noteCount = useMemo(() => g.notes.reduce((sum, mask) => sum + bitCount(mask), 0), [g])

  const solvedTarget = targets.some((t) => g.cells[t.cell] === t.digit)
  const reached =
    lesson.practice === 'single' ? solvedTarget : lesson.practice === 'notes' ? noteCount >= 3 : false

  // Completing the drill marks the lesson done, once. Keyed on the success boolean.
  useEffect(() => {
    if (reached && !done) completeLesson(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reached])

  const resetBoard = () => {
    setG(createGame({ mode: 'practice', difficulty: 'easy', seed }))
    setNotesMode(false)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        to="/learn"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-text transition-colors"
      >
        <ArrowLeft size={15} /> All lessons
      </Link>

      {/* header */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-semibold">{lesson.title}</h1>
          <Badge tone="neutral">{lesson.level}</Badge>
          <span className="text-sm text-muted">{lesson.minutes} min</span>
          {done && (
            <Badge tone="ok" icon={CheckCircle2}>
              Completed
            </Badge>
          )}
        </div>
        <p className="text-muted mt-2">{lesson.summary}</p>
      </div>

      {/* explanation */}
      <div className="space-y-5">
        {lesson.body.map((section, i) => (
          <section key={i}>
            <h3 className="font-display text-lg font-semibold">{section.h}</h3>
            <p className="text-muted leading-relaxed mt-1">{section.p}</p>
          </section>
        ))}
      </div>

      <Divider />

      {/* practice */}
      <Panel>
        <SectionHeader title="Practice" />

        {interactive && (
          <>
            <Callout tone="info" icon={Lightbulb}>
              {lesson.practice === 'single'
                ? `Find the cell that has only one option and place it. (Technique: ${hint?.meta?.label ?? 'single'})`
                : 'Toggle pencil marks: turn on Notes and tap numbers to record candidates.'}
            </Callout>

            <Card className={cx('p-4 mt-4 space-y-3', reached && 'ring-1 ring-ok/50')}>
              <Board
                game={g}
                wrongSet={wrongCells(g)}
                hintCell={null}
                onSelect={(i) => setG((x) => selectCell(x, i))}
                settings={settings}
                interactive
                maxWidth={380}
              />

              <div className="flex items-center gap-2">
                {lesson.practice === 'notes' && (
                  <Button
                    variant={notesMode ? 'soft' : 'secondary'}
                    size="sm"
                    aria-pressed={notesMode}
                    onClick={() => setNotesMode((v) => !v)}
                  >
                    Notes: {notesMode ? 'On' : 'Off'}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={resetBoard}>
                  <RotateCcw size={15} /> Reset
                </Button>
              </div>

              <NumberPad
                game={g}
                notesMode={notesMode}
                onDigit={(d) => setG((x) => inputDigit(x, x.selected, d, { notesMode, autoClean: true }))}
                showRemaining={false}
              />
            </Card>

            {reached && (
              <Callout tone="ok" icon={CheckCircle2} className="mt-4">
                {lesson.practice === 'single' ? 'Nicely spotted.' : 'Good — that is exactly how candidates work.'}
              </Callout>
            )}
          </>
        )}

        {lesson.practice === 'read' && (
          <>
            <Callout tone="info" icon={Lightbulb}>
              {lesson.summary}
            </Callout>

            {done && (
              <Callout tone="ok" icon={CheckCircle2} className="mt-4">
                You have marked this technique as understood.
              </Callout>
            )}

            <div className="flex flex-wrap gap-2 mt-4">
              {!done && (
                <Button variant="primary" onClick={() => completeLesson(id)}>
                  <CheckCircle2 size={16} /> Mark as understood
                </Button>
              )}
              <Button variant="secondary" as={Link} to="/play?mode=practice&difficulty=hard">
                Practice on a real puzzle <ArrowRight size={15} />
              </Button>
            </div>
          </>
        )}
      </Panel>

      {/* footer nav */}
      <Divider />
      <div className="flex items-center justify-between gap-3">
        {prev ? (
          <Button variant="secondary" onClick={() => navigate(`/learn/${prev.id}`)}>
            <ArrowLeft size={16} /> {prev.title}
          </Button>
        ) : (
          <span />
        )}
        {next ? (
          <Button variant="secondary" onClick={() => navigate(`/learn/${next.id}`)}>
            {next.title} <ArrowRight size={16} />
          </Button>
        ) : (
          <span />
        )}
      </div>
    </div>
  )
}
