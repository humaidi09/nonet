import { useState } from 'react'
import { Palette, Gamepad2, User as UserIcon, Database, Trash2, RefreshCw, Check } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Button, Panel, Card, SectionHeader, Toggle, Segmented, Field, TextInput, Divider, Badge, ConfirmDialog, cx } from '@/components/ui'
import { sound } from '@/lib/sound'
import { haptics } from '@/lib/haptics'

/* ---------------------------------------------------------------- options -- */

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const MISTAKE_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'onEntry', label: 'On entry' },
  { value: 'onComplete', label: 'On finish' },
]

// Gameplay assists — order and copy kept intentional, not exhaustive.
const GAMEPLAY_TOGGLES = [
  { key: 'highlightPeers', label: 'Highlight peers', description: "Shade the selected cell's row, column and box." },
  { key: 'highlightSame', label: 'Highlight same number', description: 'Shade cells sharing the selected number.' },
  { key: 'autoNotes', label: 'Auto-remove candidates', description: "Remove a placed digit from peers' pencil marks." },
  { key: 'showRemaining', label: 'Show remaining counts', description: 'Number pad shows how many of each digit are left.' },
  { key: 'keyboardInput', label: 'Keyboard input', description: 'Type 1-9, arrows to move, and shortcuts.' },
  { key: 'confirmRestart', label: 'Confirm before restart' },
  { key: 'sound', label: 'Sound', description: 'Soft cues on placement, completion and milestones.' },
  { key: 'haptics', label: 'Haptic feedback', description: 'Vibrate on placement and completion (supported devices).' },
]

// Avatar swatches map to semantic theme tokens so they flip with the theme.
const AVATARS = [
  { value: 'indigo', label: 'Amber', swatch: 'bg-accent' },
  { value: 'jade', label: 'Jade', swatch: 'bg-ok' },
  { value: 'amber', label: 'Amber', swatch: 'bg-warn' },
  { value: 'slate', label: 'Slate', swatch: 'bg-line-strong' },
]

/* ------------------------------------------------------------------ bits --- */

function SectionTitle({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon size={18} strokeWidth={2} className="text-accent" />
      {children}
    </span>
  )
}

// Toggle wrapped for a little extra breathing room inside divided lists.
function ToggleRow(props) {
  return (
    <div className="py-1.5">
      <Toggle {...props} />
    </div>
  )
}

/* --------------------------------------------------------------- settings -- */

export default function Settings() {
  const settings = useStore((s) => s.settings)
  const profile = useStore((s) => s.profile)
  const history = useStore((s) => s.history)
  const setSetting = useStore((s) => s.setSetting)
  const setProfile = useStore((s) => s.setProfile)
  const resetData = useStore((s) => s.resetData)

  const [reseedOpen, setReseedOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)

  // Apply a gameplay toggle, previewing sound/haptics the moment they're enabled.
  const handleToggle = (key, value) => {
    setSetting(key, value)
    if (value && key === 'sound') {
      sound.unlock()
      sound.configure({ enabled: true, volume: settings.volume ?? 0.7 })
      sound.play('correct')
    }
    if (value && key === 'haptics') {
      haptics.configure({ enabled: true })
      haptics.buzz('medium')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold">Settings</h1>
        <p className="text-muted mt-1">Tune Nonet to the way you like to play.</p>
      </div>

      {/* Appearance ------------------------------------------------------- */}
      <Panel>
        <SectionHeader title={<SectionTitle icon={Palette}>Appearance</SectionTitle>} hint="How Nonet looks and feels." />
        <div className="space-y-5">
          <Field label="Theme">
            <Segmented
              options={THEME_OPTIONS}
              value={settings.theme}
              onChange={(v) => setSetting('theme', v)}
              aria-label="Theme"
              className="flex-wrap"
            />
          </Field>
          <Divider />
          <div className="divide-y divide-line">
            <ToggleRow
              id="largeText"
              label="Large text"
              description="Increase interface text size."
              checked={settings.largeText}
              onChange={(v) => setSetting('largeText', v)}
            />
            <ToggleRow
              id="animations"
              label="Animations"
              description="Subtle motion on placement and completion."
              checked={settings.animations}
              onChange={(v) => setSetting('animations', v)}
            />
          </div>
        </div>
      </Panel>

      {/* Gameplay --------------------------------------------------------- */}
      <Panel>
        <SectionHeader title={<SectionTitle icon={Gamepad2}>Gameplay</SectionTitle>} hint="Assists and rules while you solve." />
        <div className="space-y-5">
          <Field
            label="Mistake detection"
            hint="Off never flags; On entry flags a wrong number immediately; On finish only checks when the board is full."
          >
            <Segmented
              options={MISTAKE_OPTIONS}
              value={settings.mistakeMode}
              onChange={(v) => setSetting('mistakeMode', v)}
              aria-label="Mistake detection"
              className="flex-wrap"
            />
          </Field>
          <Divider />
          <div className="divide-y divide-line">
            {GAMEPLAY_TOGGLES.map((t) => (
              <ToggleRow
                key={t.key}
                id={t.key}
                label={t.label}
                description={t.description}
                checked={settings[t.key]}
                onChange={(v) => handleToggle(t.key, v)}
              />
            ))}
          </div>
          <Divider />
          <Field label="Master volume" hint="How loud sounds and cues play.">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={Math.round((settings.volume ?? 0.7) * 100)}
                onChange={(e) => setSetting('volume', Number(e.target.value) / 100)}
                onPointerUp={() => {
                  if (settings.sound) {
                    sound.unlock()
                    sound.play('button')
                  }
                }}
                disabled={!settings.sound}
                aria-label="Master volume"
                className="flex-1 accent-[var(--accent)] disabled:opacity-40"
              />
              <span className="w-11 text-right text-sm text-muted tnum">
                {Math.round((settings.volume ?? 0.7) * 100)}%
              </span>
            </div>
          </Field>
        </div>
      </Panel>

      {/* Profile ---------------------------------------------------------- */}
      <Panel>
        <SectionHeader title={<SectionTitle icon={UserIcon}>Profile</SectionTitle>} hint="How you appear across Nonet." />
        <div className="space-y-5">
          <Field label="Display name" htmlFor="username">
            <TextInput
              id="username"
              value={profile.username}
              onChange={(e) => setProfile({ username: e.target.value })}
              maxLength={24}
              placeholder="Your name"
            />
          </Field>
          <Field label="Avatar colour">
            <div className="flex items-center gap-3">
              {AVATARS.map((a) => {
                const selected = profile.avatar === a.value
                return (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setProfile({ avatar: a.value })}
                    aria-label={a.label}
                    aria-pressed={selected}
                    className={cx(
                      'grid place-items-center h-9 w-9 rounded-full text-white transition-transform',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                      a.swatch,
                      selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : 'hover:scale-105',
                    )}
                  >
                    {selected && <Check size={16} strokeWidth={2.6} />}
                  </button>
                )
              })}
            </div>
          </Field>
        </div>
      </Panel>

      {/* Data ------------------------------------------------------------- */}
      <Panel>
        <SectionHeader title={<SectionTitle icon={Database}>Data</SectionTitle>} hint="Puzzle data saved on this device." />
        <Card className="p-4 sm:p-5">
          <p className="text-sm text-muted">{`${history.length} games in your history.`}</p>
          <Divider className="my-4" />
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="secondary" onClick={() => setReseedOpen(true)} className="w-full sm:w-auto">
              <RefreshCw size={16} /> Reset &amp; reload demo data
            </Button>
            <Button variant="danger" onClick={() => setClearOpen(true)} className="w-full sm:w-auto">
              <Trash2 size={16} /> Clear all data
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted">
            Clearing data is <Badge tone="bad">permanent</Badge> and can&apos;t be undone.
          </p>
        </Card>
      </Panel>

      {/* confirmations ---------------------------------------------------- */}
      <ConfirmDialog
        open={reseedOpen}
        onClose={() => setReseedOpen(false)}
        onConfirm={() => resetData({ reseed: true })}
        title="Reset & reload demo data"
        confirmLabel="Reset data"
        cancelLabel="Cancel"
        tone="primary"
      >
        This replaces your current history with a fresh set of demo games so the studio feels lived-in. Your display name is kept.
      </ConfirmDialog>

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={() => resetData({ reseed: false })}
        title="Clear all data"
        confirmLabel="Clear everything"
        cancelLabel="Cancel"
        tone="danger"
      >
        This permanently erases all history, stats and achievements on this device. This cannot be undone.
      </ConfirmDialog>
    </div>
  )
}
