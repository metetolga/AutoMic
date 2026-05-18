import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { Music2, Youtube, AtSign, User, Hash, Loader2 } from 'lucide-react'
import { Navbar } from '../components/Navbar'
import { supabase, type QueueRow } from '../lib/supabase'
import { addToQueue } from '../lib/queue.functions'
import { getYoutubeTitle } from '../lib/youtube.util'

export const Route = createFileRoute('/')({ component: Home })

type FormState = {
  name: string
  email: string
  pin: string
  youtubeLink: string
}

type FieldError = Partial<Record<keyof FormState, string>>

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
            <th className="h-10 px-4 text-left font-medium text-gray-500">Name</th>
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
                <td className="px-4 py-3 font-medium text-gray-900">{entry.name}</td>
                <td className="max-w-xs px-4 py-3">
                  <a
                    href={entry.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1.5 text-gray-500 transition-colors hover:text-gray-900"
                  >
                    <Youtube className="h-3.5 w-3.5 shrink-0 text-red-500" />
                    <span className="truncate text-xs">{titles[entry.link] ?? entry.link}</span>
                  </a>
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

function useIsMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function Home() {
  const mounted = useIsMounted()
  const [form, setForm] = useState<FormState>({ name: '', email: '', pin: '', youtubeLink: '' })
  const [errors, setErrors] = useState<FieldError>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [queue, setQueue] = useState<QueueRow[]>([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [titles, setTitles] = useState<Record<string, string>>({})

  async function fetchQueue() {
    const { data } = await supabase
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
          .catch(() => null)
      )
    ).then(results => {
      const updates: Record<string, string> = {}
      for (const r of results) if (r) updates[r.link] = r.title
      if (Object.keys(updates).length > 0) setTitles(prev => ({ ...prev, ...updates }))
    })
  }, [queue])

  function validate(): FieldError {
    const e: FieldError = {}
    if (!form.name.trim()) e.name = 'Name is required.'
    if (!form.email.trim()) e.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email.'
    if (!form.pin) e.pin = 'PIN is required.'
    else if (!/^\d{4}$/.test(form.pin)) e.pin = 'PIN must be exactly 4 digits.'
    if (!form.youtubeLink.trim()) e.youtubeLink = 'YouTube link is required.'
    else if (!form.youtubeLink.includes('youtube.com') && !form.youtubeLink.includes('youtu.be'))
      e.youtubeLink = 'Must be a valid YouTube link.'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const inserted = await addToQueue({
        data: {
          name: form.name,
          mail: form.email,
          pin:  Number(form.pin),
          link: form.youtubeLink,
        },
      })
      setQueue(prev => [...prev, inserted])
      setErrors({})
      setForm({ name: '', email: '', pin: '', youtubeLink: '' })
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : String(err))
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="mx-auto max-w-2xl px-6 py-16">
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

        {/* Form card — client-only to avoid SSR/extension hydration mismatch */}
        <div className="mx-auto mb-10 max-w-md">
          {!mounted ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm h-105" />
          ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
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
                <InputWrapper icon={<Youtube className="h-4 w-4" />}>
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

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700 active:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? 'Adding…' : 'Add to Queue'}
              </button>
            </form>
          </div>
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
