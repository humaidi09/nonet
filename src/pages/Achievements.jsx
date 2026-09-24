// Achievements — a calm ledger of milestones earned through real play. Unlocked
// entries surface first; locked ones stay quiet and, where a goal is measurable,
// show honest progress derived from history. Never colour alone (a11y): every
// state carries an icon and a text label.

import { useMemo } from 'react'
import * as Icons from 'lucide-react' // dynamic icon by name
import { Trophy, Lock, Check } from 'lucide-react'
import { ACHIEVEMENTS } from '@/engine/achievements'
import { useStore } from '@/store/useStore'
import { Panel, Card, Badge, ProgressBar, SectionHeader, Stat, cx } from '@/components/ui'
import Reveal from '@/components/ui/Reveal'
import { formatDate } from '@/lib/format'

export default function Achievements() {
  const unlockedMap = useStore((s) => s.achievements)
  const history = useStore((s) => s.history)
  const profile = useStore((s) => s.profile)

  // Real completion counts — the basis for every measurable progress bar.
  const counts = useMemo(() => {
    const done = history.filter((g) => g.result === 'completed')
    const byDifficulty = {}
    done.forEach((g) => (byDifficulty[g.difficulty] = (byDifficulty[g.difficulty] || 0) + 1))
    return { completed: done.length, byDifficulty }
  }, [history])

  const streakLong = profile.streak.longest

  // Unlocked first (newest unlock at the top), then locked in definition order.
  const sorted = useMemo(() => {
    return [...ACHIEVEMENTS].sort((a, b) => {
      const ua = unlockedMap[a.id]
      const ub = unlockedMap[b.id]
      if (ua && ub) return new Date(ub.at) - new Date(ua.at)
      if (ua) return -1
      if (ub) return 1
      return 0
    })
  }, [unlockedMap])

  const total = ACHIEVEMENTS.length
  const unlockedCount = ACHIEVEMENTS.filter((a) => unlockedMap[a.id]).length
  const pct = Math.round((unlockedCount / total) * 100)

  // Progress for the measurable achievements only; everything else returns null.
  function progressFor(id) {
    const { completed, byDifficulty } = counts
    switch (id) {
      case 'ten-solved':
        return { value: Math.min(completed / 10, 1), text: `${Math.min(completed, 10)} / 10` }
      case 'fifty-solved':
        return { value: completed / 50, text: `${Math.min(completed, 50)} / 50` }
      case 'streak-3':
        return { value: Math.min(streakLong / 3, 1), text: `${Math.min(streakLong, 3)} / 3` }
      case 'streak-7':
        return { value: streakLong / 7, text: `${Math.min(streakLong, 7)} / 7` }
      case 'streak-30':
        return { value: streakLong / 30, text: `${Math.min(streakLong, 30)} / 30` }
      case 'all-difficulties': {
        const distinct = ['easy', 'medium', 'hard', 'expert'].filter(
          (d) => (byDifficulty[d] || 0) > 0,
        ).length
        return { value: distinct / 4, text: `${distinct} / 4` }
      }
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold">Achievements</h1>
        <p className="text-muted mt-1.5">
          Milestones earned through real solves — each one reflects something you actually did.
        </p>
      </div>

      {/* summary */}
      <Reveal>
        <Panel>
          <div className="flex items-start justify-between gap-4">
            <Stat label="Unlocked" value={`${unlockedCount} / ${total}`} icon={Trophy} />
            <Badge tone="accent">{pct}%</Badge>
          </div>
          <ProgressBar
            value={unlockedCount / total}
            label="Achievements unlocked"
            className="mt-4"
          />
        </Panel>
      </Reveal>

      {/* full list */}
      <div>
        <SectionHeader
          title="All achievements"
          hint="Unlocked first, newest at the top. Measurable goals show your progress."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((a, i) => {
            const entry = unlockedMap[a.id]
            const unlocked = Boolean(entry)
            const Icon = Icons[a.icon] || Icons.Trophy
            const progress = unlocked ? null : progressFor(a.id)
            return (
              <Reveal key={a.id} className="h-full" delay={(i % 3) * 0.06}>
                <Card
                  className={cx('flex gap-3 p-4 h-full', unlocked ? 'border-accent/30' : 'border-line opacity-90')}
                >
                  <div
                    className={cx(
                      'h-11 w-11 shrink-0 rounded-xl grid place-items-center',
                      unlocked ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-faint',
                    )}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={cx('font-semibold', !unlocked && 'text-muted')}>{a.name}</div>
                    <p className="text-sm text-muted mt-0.5">{a.description}</p>
                    {unlocked ? (
                      <div className="mt-2 flex items-center gap-1.5 text-xs">
                        <Check size={13} className="text-ok shrink-0" />
                        <span className="font-medium">Unlocked</span>
                        <span className="text-faint">· {formatDate(entry.at)}</span>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted">
                          <Lock size={13} className="shrink-0" />
                          <span className="font-medium">Locked</span>
                        </div>
                        {progress && (
                          <div className="mt-2">
                            <ProgressBar value={progress.value} label={`Progress toward ${a.name}`} />
                            <div className="mt-1 text-xs text-faint tnum">{progress.text}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              </Reveal>
            )
          })}
        </div>
      </div>
    </div>
  )
}
