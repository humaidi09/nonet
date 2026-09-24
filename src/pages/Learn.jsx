// Learn — the Learning Centre index. Groups the technique lessons by level, shows
// overall progress, and links each card through to its lesson + practice.

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, CheckCircle2, Circle, Clock, ArrowRight } from 'lucide-react'
import { LESSONS } from '@/data/lessons'
import { useStore } from '@/store/useStore'
import { Panel, Card, Badge, ProgressBar, SectionHeader, cx } from '@/components/ui'
import Reveal from '@/components/ui/Reveal'

const LEVELS = ['Beginner', 'Intermediate', 'Advanced']

export default function Learn() {
  const lessonsCompleted = useStore((s) => s.lessonsCompleted)
  const completed = LESSONS.filter((l) => lessonsCompleted[l.id]).length

  const groups = useMemo(
    () =>
      LEVELS.map((level) => ({ level, lessons: LESSONS.filter((l) => l.level === level) })).filter(
        (group) => group.lessons.length,
      ),
    [],
  )

  return (
    <div className="space-y-6">
      {/* header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
          <GraduationCap size={26} className="text-accent" /> Learn
        </h1>
        <p className="text-muted mt-1">Techniques from first scan to X-Wing. Each one has a quick practice.</p>
      </div>

      {/* progress */}
      <Reveal>
        <Panel>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-sm font-medium text-muted">Your progress</span>
            <span className="text-sm tnum">
              {completed} / {LESSONS.length} lessons
            </span>
          </div>
          <ProgressBar value={completed / LESSONS.length} label={`${completed} of ${LESSONS.length} lessons complete`} />
        </Panel>
      </Reveal>

      {/* lessons by level */}
      {groups.map((group) => (
        <section key={group.level}>
          <SectionHeader title={group.level} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.lessons.map((l, i) => {
              const done = !!lessonsCompleted[l.id]
              return (
                <Reveal key={l.id} className="h-full" delay={(i % 3) * 0.06}>
                  <Card
                    as={Link}
                    to={`/learn/${l.id}`}
                    className="p-4 hover:bg-surface-2 transition-colors block h-full"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="neutral">{l.level}</Badge>
                      <span className={cx('inline-flex items-center gap-1 text-xs', done ? 'text-ok' : 'text-faint')}>
                        {done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                        {done ? 'Done' : 'Not started'}
                      </span>
                    </div>
                    <h3 className="font-display text-lg mt-3">{l.title}</h3>
                    <p className="text-sm text-muted mt-1">{l.summary}</p>
                    <div className="flex items-center justify-between mt-4 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={13} /> {l.minutes} min
                      </span>
                      <ArrowRight size={15} className="text-faint" />
                    </div>
                  </Card>
                </Reveal>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
