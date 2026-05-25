import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { Music2, Clapperboard, AtSign, User, Hash, Loader2 } from 'lucide-react'
import { Navbar } from '../components/Navbar'
import { getSupabase, type QueueRow } from '../lib/supabase'
import { addToQueue, updateQueueLink, getTurnstileSiteKey, getAppState } from '../lib/queue.functions'
import { getYoutubeTitle } from '../lib/youtube.util'
import { AddToQueueSchema, ChangeSongSchema } from '../lib/schemas'

export const Route = createFileRoute('/')({
  component: Home,
  loader: async () => {
    const [siteKey, appState] = await Promise.all([getTurnstileSiteKey(), getAppState()])
    return { ...siteKey, ...appState }
  },
  staleTime: 0,
})

declare global {
  interface Window {
    turnstile: {
      render: (el: HTMLElement, opts: {
        sitekey: string
        callback: (token: string) => void
        'expired-callback': () => void
        'error-callback': () => void
      }) => string
      remove: (widgetId: string) => void
    }
  }
}

type FormState = {
  name: string
  email: string
  pin: string
  youtubeLink: string
}

type FieldError = Partial<Record<keyof FormState, string>>

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function statusForIndex(i: number): 'now-playing' | 'up-next' | 'waiting' {
  if (i === 0) return 'now-playing'
  if (i === 1) return 'up-next'
  return 'waiting'
}

const STATUS_LABEL = {
  'now-playing': 'Now Playing',
  'up-next':     'Up Next',
  'waiting':     'Waiting',
} as const

const STATUS_CLS = {
  'now-playing': 'bg-green-50 text-green-700 border border-green-200',
  'up-next':     'bg-amber-50 text-amber-700 border border-amber-200',
  'waiting':     'bg-gray-100 text-gray-600 border border-gray-200',
} as const

// ─── Sub-components ──────────────────────────────────────────────────────────

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-gray-700">
      {children}
    </label>
  )
}

function InputWrapper({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative" suppressHydrationWarning>
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
        {icon}
      </div>
      {children}
    </div>
  )
}

function ErrorMsg({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 text-xs text-red-500">{message}</p>
}

function QueueTable({ entries, loading, titles }: { entries: QueueRow[]; loading: boolean; titles: Record<string, string> }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-12 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white py-12 text-center shadow-sm">
        <Music2 className="mx-auto mb-2 h-8 w-8 text-gray-300" />
        <p className="text-sm text-gray-400">No songs in the queue yet.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="h-10 w-10 px-4 text-left font-medium text-gray-500">#</th>
            <th className="h-10 w-36 px-4 text-left font-medium text-gray-500">Name</th>
            <th className="h-10 px-4 text-left font-medium text-gray-500">Karaoke</th>
            <th className="h-10 px-4 text-right font-medium text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => {
            const status = statusForIndex(i)
            return (
              <tr
                key={entry.id}
                className="border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-50"
              >
                <td className="px-4 py-3 tabular-nums text-gray-400">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{trunc(entry.name, 18)}</td>
                <td className="max-w-xs px-4 py-3">
                  <div className="group relative">
                    <a
                      href={entry.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-gray-500 transition-colors hover:text-gray-900"
                    >
                      <Clapperboard className="h-3.5 w-3.5 shrink-0 text-red-500" />
                      <span className="text-xs">{trunc(titles[entry.link] || entry.link, 64)}</span>
                    </a>
                    {(titles[entry.link] || entry.link).length > 64 && (
                      <span className="pointer-events-none absolute left-0 top-0 z-50 whitespace-nowrap rounded-md bg-white pl-0 pr-2.5 py-1 text-xs text-gray-600 opacity-0 shadow-sm ring-1 ring-gray-200 transition-opacity group-hover:opacity-100">
                        {titles[entry.link] || entry.link}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={clsx(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                      STATUS_CLS[status],
                    )}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

type ChangeFormState = { email: string; pin: string; newLink: string }
type ChangeFieldError = Partial<Record<keyof ChangeFormState, string>>

function ChangeForm({ onUpdated, className, siteKey }: { onUpdated: (row: QueueRow) => void; className?: string; siteKey: string }) {
  const [form, setForm] = useState<ChangeFormState>({ email: '', pin: '', newLink: '' })
  const [errors, setErrors] = useState<ChangeFieldError>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileKey, setTurnstileKey] = useState(0)
  const [turnstileError, setTurnstileError] = useState(false)

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    const result = ChangeSongSchema.safeParse(form)
    if (!result.success) {
      const fe: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const k = String(issue.path[0])
        if (k && !fe[k]) fe[k] = issue.message
      }
      setErrors({ email: fe.email, pin: fe.pin, newLink: fe.newLink })
      return
    }
    if (!turnstileToken) { setTurnstileError(true); return }

    setSubmitting(true)
    setSubmitError(null)
    setSuccess(false)
    setTurnstileError(false)

    try {
      const updated = await updateQueueLink({
        data: { mail: result.data.email, pin: Number(result.data.pin), newLink: result.data.newLink, turnstileToken },
      })
      onUpdated(updated)
      setSuccess(true)
      setForm({ email: '', pin: '', newLink: '' })
      setTurnstileToken(null)
      setTurnstileKey(k => k + 1)
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : String(err))
      setTurnstileToken(null)
      setTurnstileKey(k => k + 1)
    } finally {
      setSubmitting(false)
    }
  }

  function handleChange(field: keyof ChangeFormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }))
      if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }))
      if (success) setSuccess(false)
    }
  }

  return (
    <div className={clsx('rounded-xl border border-gray-200 bg-white p-8 shadow-sm', className)}>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Change Your Song</h2>
      <p className="mb-6 text-sm text-gray-500">Already in the queue? Swap your karaoke track.</p>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <Label htmlFor="change-email">Email address</Label>
          <InputWrapper icon={<AtSign className="h-4 w-4" />}>
            <input
              id="change-email"
              type="email"
              placeholder="jane@example.com"
              value={form.email}
              onChange={handleChange('email')}
              className={clsx('input-base pl-9', errors.email && 'border-red-400 focus:border-red-400')}
              suppressHydrationWarning
            />
          </InputWrapper>
          <ErrorMsg message={errors.email} />
        </div>

        <div>
          <Label htmlFor="change-pin">4-digit PIN</Label>
          <InputWrapper icon={<Hash className="h-4 w-4" />}>
            <input
              id="change-pin"
              type="password"
              inputMode="numeric"
              placeholder="••••"
              maxLength={4}
              value={form.pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4)
                setForm(prev => ({ ...prev, pin: val }))
                if (errors.pin) setErrors(prev => ({ ...prev, pin: undefined }))
                if (success) setSuccess(false)
              }}
              className={clsx('input-base pl-9', errors.pin && 'border-red-400 focus:border-red-400')}
              suppressHydrationWarning
            />
          </InputWrapper>
          <ErrorMsg message={errors.pin} />
        </div>

        <div>
          <Label htmlFor="change-link">New karaoke link</Label>
          <InputWrapper icon={<Clapperboard className="h-4 w-4" />}>
            <input
              id="change-link"
              type="url"
              placeholder="https://youtube.com/watch?v=..."
              value={form.newLink}
              onChange={handleChange('newLink')}
              className={clsx('input-base pl-9', errors.newLink && 'border-red-400 focus:border-red-400')}
              suppressHydrationWarning
            />
          </InputWrapper>
          <ErrorMsg message={errors.newLink} />
        </div>

        {submitError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {submitError}
          </p>
        )}

        {success && (
          <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
            Song updated successfully!
          </p>
        )}

        <div>
          <TurnstileWidget
            key={turnstileKey}
            siteKey={siteKey}
            onToken={(t) => { setTurnstileToken(t); if (t) setTurnstileError(false) }}
          />
          {turnstileError && (
            <p className="mt-1.5 text-xs text-red-500">Please complete the security check.</p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700 active:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? 'Updating…' : 'Update Song'}
        </button>
      </form>
    </div>
  )
}

function TurnstileWidget({ siteKey, onToken }: { siteKey: string; onToken: (token: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken

  useEffect(() => {
    let widgetId: string | undefined
    let cancelled = false
    let pollId: ReturnType<typeof setInterval> | undefined

    function render() {
      if (cancelled || !containerRef.current || !window.turnstile) return
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (t: string) => onTokenRef.current(t),
        'expired-callback': () => onTokenRef.current(null),
        'error-callback': () => onTokenRef.current(null),
      })
    }

    if (window.turnstile) {
      render()
    } else {
      // Script is loaded in <head>; poll briefly until it initialises
      pollId = setInterval(() => {
        if (window.turnstile) { clearInterval(pollId); render() }
      }, 50)
    }

    return () => {
      cancelled = true
      if (pollId !== undefined) clearInterval(pollId)
      if (widgetId !== undefined && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [siteKey])

  return <div ref={containerRef} />
}

const COOLDOWN_MS = 25 * 60 * 1000
const COOLDOWN_KEY = 'automic_last_added'

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function useCooldown() {
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startCountdown(fromTs: number) {
    if (intervalRef.current) clearInterval(intervalRef.current)
    const initial = Math.ceil((COOLDOWN_MS - (Date.now() - fromTs)) / 1000)
    if (initial <= 0) return
    setRemainingSeconds(initial)
    intervalRef.current = setInterval(() => {
      const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - fromTs)) / 1000)
      if (remaining <= 0) {
        clearInterval(intervalRef.current!)
        intervalRef.current = null
        setRemainingSeconds(0)
        localStorage.removeItem(COOLDOWN_KEY)
      } else {
        setRemainingSeconds(remaining)
      }
    }, 1000)
  }

  useEffect(() => {
    const stored = localStorage.getItem(COOLDOWN_KEY)
    if (stored) {
      const ts = Number(stored)
      if (Date.now() - ts < COOLDOWN_MS) startCountdown(ts)
      else localStorage.removeItem(COOLDOWN_KEY)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  function startCooldown() {
    const ts = Date.now()
    localStorage.setItem(COOLDOWN_KEY, String(ts))
    startCountdown(ts)
  }

  return { cooldownActive: remainingSeconds > 0, remainingSeconds, startCooldown }
}

function useIsMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function Home() {
  const { turnstileSiteKey, isActive } = Route.useLoaderData()

  if (!isActive) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-6 text-center">
          <p className="mb-4 text-5xl">🎤</p>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">Karaoke Night is currently closed!</h2>
          <p className="max-w-sm text-gray-500">We'll see you at the next bar night. Check our Instagram for dates.</p>
        </div>
      </div>
    )
  }
  const mounted = useIsMounted()
  const { cooldownActive, remainingSeconds, startCooldown } = useCooldown()
  const [form, setForm] = useState<FormState>({ name: '', email: '', pin: '', youtubeLink: '' })
  const [errors, setErrors] = useState<FieldError>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileKey, setTurnstileKey] = useState(0)
  const [turnstileError, setTurnstileError] = useState(false)

  const [queue, setQueue] = useState<QueueRow[]>([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [titles, setTitles] = useState<Record<string, string>>({})

  async function fetchQueue() {
    const { data } = await getSupabase()
      .from('queue')
      .select('*')
      .order('created_at', { ascending: true })
    if (data) setQueue(data as QueueRow[])
  }

  useEffect(() => {
    fetchQueue().then(() => setQueueLoading(false))
  }, [])

  useEffect(() => {
    const missing = queue.map(e => e.link).filter(l => !(l in titles))
    if (missing.length === 0) return
    Promise.all(
      missing.map(link =>
        getYoutubeTitle(link)
          .then(title => ({ link, title }))
          .catch(() => ({ link, title: '' }))
      )
    ).then(results => {
      const updates: Record<string, string> = {}
      for (const r of results) updates[r.link] = r.title
      setTitles(prev => ({ ...prev, ...updates }))
    })
  }, [queue])

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    const result = AddToQueueSchema.safeParse(form)
    if (!result.success) {
      const fe: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const k = String(issue.path[0])
        if (k && !fe[k]) fe[k] = issue.message
      }
      setErrors({ name: fe.name, email: fe.email, pin: fe.pin, youtubeLink: fe.youtubeLink })
      return
    }
    if (!turnstileToken) { setTurnstileError(true); return }

    setSubmitting(true)
    setSubmitError(null)
    setTurnstileError(false)

    try {
      const inserted = await addToQueue({
        data: {
          name: result.data.name,
          mail: result.data.email,
          pin:  Number(result.data.pin),
          link: result.data.youtubeLink,
          turnstileToken,
        },
      })
      setQueue(prev => [...prev, inserted])
      setErrors({})
      setForm({ name: '', email: '', pin: '', youtubeLink: '' })
      setTurnstileToken(null)
      setTurnstileKey(k => k + 1)
      startCooldown()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setSubmitError(msg)
      if (msg.startsWith('Cooldown active')) startCooldown()
      setTurnstileToken(null)
      setTurnstileKey(k => k + 1)
    } finally {
      setSubmitting(false)
    }
  }

  function handleChange(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }))
      if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  function handleUpdated(updated: QueueRow) {
    setQueue(prev => prev.map(e => e.id === updated.id ? updated : e))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="mx-auto max-w-4xl px-6 py-16">
        {/* Hero */}
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-600 shadow-sm">
            <Music2 className="h-3.5 w-3.5" />
            Live queue · Open mic night
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Queue Your Song
          </h1>
          <p className="mt-3 text-base text-gray-500">
            Submit your song request and get ready to take the stage.
          </p>
        </div>

        {/* Forms — client-only to avoid SSR/extension hydration mismatch */}
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start">
          {!mounted ? (
            <>
              <div className="flex-1 rounded-xl border border-gray-200 bg-white p-8 shadow-sm h-115" />
              <div className="flex-1 rounded-xl border border-gray-200 bg-white p-8 shadow-sm h-100" />
            </>
          ) : (
            <>
              <div className="flex-1 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
                <h2 className="mb-1 text-lg font-semibold text-gray-900">Song Request</h2>
                <p className="mb-6 text-sm text-gray-500">Fill in your details and paste your karaoke track.</p>

                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                  <div>
                    <Label htmlFor="name">Your name</Label>
                    <InputWrapper icon={<User className="h-4 w-4" />}>
                      <input
                        id="name"
                        type="text"
                        placeholder="Jane Doe"
                        value={form.name}
                        onChange={handleChange('name')}
                        className={clsx('input-base pl-9', errors.name && 'border-red-400 focus:border-red-400')}
                        suppressHydrationWarning
                      />
                    </InputWrapper>
                    <ErrorMsg message={errors.name} />
                  </div>

                  <div>
                    <Label htmlFor="email">Email address</Label>
                    <InputWrapper icon={<AtSign className="h-4 w-4" />}>
                      <input
                        id="email"
                        type="email"
                        placeholder="jane@example.com"
                        value={form.email}
                        onChange={handleChange('email')}
                        className={clsx('input-base pl-9', errors.email && 'border-red-400 focus:border-red-400')}
                        suppressHydrationWarning
                      />
                    </InputWrapper>
                    <ErrorMsg message={errors.email} />
                  </div>

                  <div>
                    <Label htmlFor="pin">4-digit PIN</Label>
                    <InputWrapper icon={<Hash className="h-4 w-4" />}>
                      <input
                        id="pin"
                        type="password"
                        inputMode="numeric"
                        placeholder="••••"
                        maxLength={4}
                        value={form.pin}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 4)
                          setForm(prev => ({ ...prev, pin: val }))
                          if (errors.pin) setErrors(prev => ({ ...prev, pin: undefined }))
                        }}
                        className={clsx('input-base pl-9', errors.pin && 'border-red-400 focus:border-red-400')}
                        suppressHydrationWarning
                      />
                    </InputWrapper>
                    <ErrorMsg message={errors.pin} />
                  </div>

                  <div>
                    <Label htmlFor="youtubeLink">YouTube karaoke link</Label>
                    <InputWrapper icon={<Clapperboard className="h-4 w-4" />}>
                      <input
                        id="youtubeLink"
                        type="url"
                        placeholder="https://youtube.com/watch?v=..."
                        value={form.youtubeLink}
                        onChange={handleChange('youtubeLink')}
                        className={clsx('input-base pl-9', errors.youtubeLink && 'border-red-400 focus:border-red-400')}
                        suppressHydrationWarning
                      />
                    </InputWrapper>
                    <ErrorMsg message={errors.youtubeLink} />
                  </div>

                  {submitError && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                      {submitError}
                    </p>
                  )}

                  <div>
                    <TurnstileWidget
                      key={turnstileKey}
                      siteKey={turnstileSiteKey}
                      onToken={(t) => { setTurnstileToken(t); if (t) setTurnstileError(false) }}
                    />
                    {turnstileError && (
                      <p className="mt-1.5 text-xs text-red-500">Please complete the security check.</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || cooldownActive}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700 active:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {submitting ? 'Adding…' : cooldownActive ? `Wait ${formatTime(remainingSeconds)}` : 'Add to Queue'}
                  </button>
                </form>
              </div>

              <ChangeForm onUpdated={handleUpdated} className="flex-1" siteKey={turnstileSiteKey} />
            </>
          )}
        </div>

        {/* Queue table */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Current Queue</h2>
            {!queueLoading && (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {queue.length} {queue.length === 1 ? 'song' : 'songs'}
              </span>
            )}
          </div>
          <QueueTable entries={queue} loading={queueLoading} titles={titles} />
        </div>
      </main>
    </div>
  )
}
