import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LibraryBig, Search, Play as PlayIcon, Film, CheckCircle2, Circle, Sparkles, Filter,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { DIFFICULTIES, difficultyMeta } from '@/engine/sudoku'
import { smartDifficulty, personalBest } from '@/engine/analysis'
import {
  Button, Panel, Card, Badge, Callout, SectionHeader, EmptyState, Segmented, Select, TextInput, Field, cx,
} from '@/components/ui'
import Reveal from '@/components/ui/Reveal'
import { formatTime, formatRelativeDay } from '@/lib/format'

const DIFFICULTY_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'expert', label: 'Expert' },
]

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unsolved', label: 'Unsolved' },
  { value: 'solved', label: 'Solved' },
]

const SORT_OPTIONS = [
  { value: 'difficulty', label: 'Difficulty ↑' },
  { value: 'difficulty-desc', label: 'Difficulty ↓' },
  { value: 'number', label: 'Number' },
]

// Difficulty reads as a text label plus a coloured dot — the dot is only a hint,
// never the sole signal, so the label carries meaning without relying on colour.
const DIFFICULTY_DOT = { easy: 'bg-ok', medium: 'bg-accent', hard: 'bg-warn', expert: 'bg-bad' }

const diffIndex = (id) => DIFFICULTIES.findIndex((d) => d.id === id)

export default function Library() {
  const history = useStore((s) => s.history)

  // A stable, generation-free catalogue. Play generates the real board on demand
  // from (difficulty, seed), so the same seed always reproduces the same puzzle.
  const catalogue = useMemo(
    () =>
      DIFFICULTIES.flatMap((d) =>
        Array.from({ length: 12 }, (_, k) => ({
          id: `${d.id}:lib-${d.id}-${k + 1}`,
          difficulty: d.id,
          label: d.label,
          clues: d.clues,
          seed: `lib-${d.id}-${k + 1}`,
          num: k + 1,
        })),
      ),
    [],
  )

  // Solved status + best time are read straight from real history (min timeMs per
  // id). solvedOn keeps the latest solve date so cards can say when it was solved.
  const { bestMap, solvedOn } = useMemo(() => {
    const bestMap = new Map()
    const solvedOn = new Map()
    for (const h of history) {
      const prev = bestMap.get(h.id)
      if (prev == null || h.timeMs < prev) bestMap.set(h.id, h.timeMs)
      const day = solvedOn.get(h.id)
      if (!day || new Date(h.date) > new Date(day)) solvedOn.set(h.id, h.date)
    }
    return { bestMap, solvedOn }
  }, [history])

  const [difficulty, setDifficulty] = useState('all')
  const [status, setStatus] = useState('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('difficulty')

  const smart = useMemo(() => smartDifficulty(history), [history])
  const rec = smart.recommended
  const recMeta = difficultyMeta(rec)
  const recBest = useMemo(() => personalBest(history, rec), [history, rec])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = catalogue.filter((entry) => {
      if (difficulty !== 'all' && entry.difficulty !== difficulty) return false
      const solved = bestMap.has(entry.id)
      if (status === 'solved' && !solved) return false
      if (status === 'unsolved' && solved) return false
      if (q && !entry.seed.toLowerCase().includes(q) && !entry.id.toLowerCase().includes(q)) return false
      return true
    })
    return list.sort((a, b) => {
      if (sort === 'number') return a.num - b.num || diffIndex(a.difficulty) - diffIndex(b.difficulty)
      if (sort === 'difficulty-desc') return diffIndex(b.difficulty) - diffIndex(a.difficulty) || a.num - b.num
      return diffIndex(a.difficulty) - diffIndex(b.difficulty) || a.num - b.num
    })
  }, [catalogue, difficulty, status, query, sort, bestMap])

  const resetFilters = () => {
    setDifficulty('all')
    setStatus('all')
    setQuery('')
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div>
        <div className="flex items-center gap-2">
          <LibraryBig size={24} className="text-accent" />
          <h1 className="text-2xl sm:text-3xl font-semibold">Puzzle Library</h1>
        </div>
        <p className="text-muted mt-1">Browse and jump into any puzzle. Your solved ones are marked.</p>
      </div>

      {/* recommended */}
      <Callout tone="info" icon={Sparkles}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            Recommended for you: <span className="font-medium text-text">{recMeta.label}</span>
            {recBest != null && <span className="text-faint"> · your best {formatTime(recBest)}</span>}
          </span>
          <Button variant="soft" size="sm" as={Link} to={`/play?difficulty=${rec}&seed=lib-${rec}-1`}>
            <PlayIcon size={14} /> Play {recMeta.label}
          </Button>
        </div>
      </Callout>

      {/* controls */}
      <Panel>
        <div className="flex items-center gap-2 mb-4 text-sm font-medium text-muted">
          <Filter size={15} /> Filter &amp; sort
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <Field label="Difficulty">
            <Segmented
              size="sm"
              aria-label="Filter by difficulty"
              options={DIFFICULTY_FILTERS}
              value={difficulty}
              onChange={setDifficulty}
            />
          </Field>
          <Field label="Status">
            <Segmented
              size="sm"
              aria-label="Filter by status"
              options={STATUS_FILTERS}
              value={status}
              onChange={setStatus}
            />
          </Field>
          <Field label="Sort" htmlFor="lib-sort">
            <Select
              id="lib-sort"
              aria-label="Sort puzzles"
              options={SORT_OPTIONS}
              value={sort}
              onChange={setSort}
            />
          </Field>
          <Field label="Search" htmlFor="lib-search" className="w-full sm:w-64 sm:ml-auto">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
              <TextInput
                id="lib-search"
                aria-label="Search puzzles"
                className="pl-9"
                placeholder="Search by seed…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </Field>
        </div>
      </Panel>

      {/* results */}
      <div>
        <SectionHeader title="Catalogue" hint={`${filtered.length} puzzles`} />
        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={Search}
              title="No puzzles match"
              action={
                <Button variant="secondary" onClick={resetFilters}>
                  Clear filters
                </Button>
              }
            >
              Try clearing the search or changing filters.
            </EmptyState>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((entry, i) => {
              const meta = difficultyMeta(entry.difficulty)
              const solved = bestMap.has(entry.id)
              const playLink = `/play?difficulty=${entry.difficulty}&seed=${entry.seed}`
              const reviewLink = `/replay/${encodeURIComponent(entry.id)}`
              return (
                <Reveal key={entry.id} className="h-full" delay={(i % 3) * 0.06}>
                  <Card className="p-4 flex flex-col h-full">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="neutral">
                        <span className={cx('h-1.5 w-1.5 rounded-full', DIFFICULTY_DOT[meta.id])} />
                        {meta.label}
                      </Badge>
                      {solved ? (
                        <span className="inline-flex items-center gap-1 text-ok text-xs">
                          <CheckCircle2 size={14} /> Solved
                        </span>
                      ) : (
                        <span className="text-faint text-xs inline-flex items-center gap-1">
                          <Circle size={14} /> Unsolved
                        </span>
                      )}
                    </div>

                    <div className="mt-3">
                      <div className="font-display text-lg leading-tight">Puzzle #{entry.num}</div>
                      <div className="text-sm text-muted mt-0.5">{entry.clues} clues</div>
                      {solved && (
                        <div className="text-sm text-muted mt-0.5">
                          Best {formatTime(bestMap.get(entry.id))}
                          <span className="text-faint"> · {formatRelativeDay(solvedOn.get(entry.id))}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 mt-auto pt-4">
                      <Button variant="primary" size="sm" as={Link} to={playLink}>
                        <PlayIcon size={14} /> Play
                      </Button>
                      {solved && (
                        <Button variant="ghost" size="sm" as={Link} to={reviewLink}>
                          <Film size={14} /> Review
                        </Button>
                      )}
                    </div>
                  </Card>
                </Reveal>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
