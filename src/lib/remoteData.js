// Central content, fetched from the portfolio admin DB.
//
// The owner edits this app's Learning Centre lessons and hint copy from one admin
// panel; this module pulls that data so edits show up without a rebuild. The
// bundled data (data/lessons, engine/hints) is always the instant first paint and
// the offline/failure fallback — the network is strictly best-effort, so the app
// is fully usable with no connection and can never be blanked by a bad response.

const API_BASE = (import.meta.env.VITE_API_URL || 'https://portfolio-api-y7vm.onrender.com').replace(/\/+$/, '')
const APP = 'nonet'
const CACHE_KEY = `appdata.${APP}.v1`
// Generous, because the API is on a free tier that cold-starts in ~50s. This is
// a detached background request, so a long wait costs the user nothing; a first
// visit that cold-starts may fall back to bundled data and pick up edits on the
// next load (once the API is warm), which is the right trade for a demo.
const TIMEOUT_MS = 20000

/** Last good payload from localStorage, or null. Never throws. */
export function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCache(datasets) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(datasets))
  } catch {
    // storage full or disabled — we still hold the data in memory this session
  }
}

/**
 * Turn the API's array of dataset docs into a { [slug]: data } map, where each
 * value is the row array (a list) or the object (a singleton) the engine wants.
 */
export function indexBySlug(datasets) {
  const out = {}
  for (const ds of datasets || []) {
    if (ds && ds.slug) out[ds.slug] = ds.data
  }
  return out
}

/** A stable signature of a payload, so we only re-render when data truly changed. */
export function signature(datasets) {
  return JSON.stringify(datasets ?? null)
}

/**
 * Fetch this app's datasets. Resolves to the datasets array, or null on any
 * failure/timeout (the caller then keeps the cached or bundled data). Caches on
 * success so the next load paints the latest data immediately.
 */
export async function fetchRemoteData() {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}/api/app-data/${APP}`, {
      signal: ctrl.signal,
      cache: 'no-store',
    })
    if (!res.ok) return null
    const datasets = await res.json()
    if (!Array.isArray(datasets)) return null
    writeCache(datasets)
    return datasets
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
