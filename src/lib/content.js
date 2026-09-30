// Single entry point that applies the portfolio admin's edits to this app's two
// editable surfaces: the Learning Centre lessons (data/lessons) and the hint copy
// (engine/hints). Each of those modules owns the reassignment of its own exported
// binding (an ESM `let` can only be reassigned from within its module), so this
// just routes each dataset to the right setter. Guards live in the setters, so a
// missing or malformed dataset is a safe no-op that keeps the bundled content.

import { applyLessons } from '@/data/lessons'
import { applyTechniques } from '@/engine/hints'

export function applyRemoteData(datasets) {
  if (!datasets || typeof datasets !== 'object') return
  applyLessons(datasets.lessons)
  applyTechniques(datasets.techniques)
}
