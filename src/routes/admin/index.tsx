import { createFileRoute, redirect, useNavigate, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { Mic2, Loader2, Trash2, Music2, Clapperboard, LogOut, ArrowLeft, LockOpen, AtSign, Power, PowerOff } from 'lucide-react'
import { supabase, type QueueRow } from '../../lib/supabase'
import { getAuthClient } from '../../lib/supabase.auth'
import { getYoutubeTitle } from '../../lib/youtube.util'
import { unlockAccess, getAppState, setSessionActive } from '../../lib/queue.functions'

export const Route = createFileRoute('/admin/')({
  beforeLoad: async () => {
    const auth = getAuthClient()
    if (!auth) return // SSR — client-side navigation will enforce the check
    const { data: { session } } = await auth.auth.getSession()
    if (!session) throw redirect({ to: '/admin/login' })
  },
  component: AdminDashboard,
})

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function statusForEntry(i: number, playingIndex: number): 'played' | 'now-playing' | 'up-next' | 'waiting' {
  if (i < playingIndex) return 'played'
  if (i === playingIndex) return 'now-playing'
  if (i === playingIndex + 1) return 'up-next'
  return 'waiting'
}

const STATUS_LABEL = {
  'played':      'Played',
  'now-playing': 'Now Playing',
  'up-next':     'Up Next',
  'waiting':     'Waiting',
} as const

const STATUS_CLS = {
  'played':      'bg-rose-50 text-rose-400 border border-rose-200',
  'now-playing': 'bg-green-50 text-green-700 border border-green-200',
  'up-next':     'bg-amber-50 text-amber-700 border border-amber-200',
  'waiting':     'bg-gray-100 text-gray-600 border border-gray-200',
} as const

function AdminDashboard() {
  const navigate = useNavigate()
  const [queue, setQueue] = useState<QueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [copied, setCopied] = useState<number | null>(null)
  const [titles, setTitles] = useState<Record<string, string>>({})
  const [playingIndex, setPlayingIndex] = useState(0)
  const [unlockEmail, setUnlockEmail] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [unlockSuccess, setUnlockSuccess] = useState(false)

  const [isActive, setIsActive] = useState<boolean | null>(null)
  const [sessionWorking, setSessionWorking] = useState(false)
  const [sessionMsg, setSessionMsg] = useState<{ type: 'warning' | 'error'; text: string } | null>(null)

  async function handleCopyEmail(email: string, id: number) {
    await navigator.clipboard.writeText(email)
    setCopied(id)
    setTimeout(() => setCopied(prev => (prev === id ? null : prev)), 1500)
  }

  useEffect(() => {
    supabase
      .from('queue')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setQueue(data as QueueRow[])
        setLoading(false)
      })
    getAppState().then(({ isActive }) => setIsActive(isActive))
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

  async function handleDelete(id: number) {
    setDeleting(id)
    const { error } = await supabase.from('queue').delete().eq('id', id)
    if (!error) setQueue(prev => prev.filter(e => e.id !== id))
    setDeleting(null)
  }

  async function handleToggleSession() {
    if (isActive === null) return
    setSessionWorking(true)
    setSessionMsg(null)
    try {
      await setSessionActive({ data: { active: !isActive } })
      setIsActive(!isActive)
      if (isActive) {
        setQueue([])
        setTitles({})
        setPlayingIndex(0)
      }
    } catch (err: unknown) {
      setSessionMsg({ type: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setSessionWorking(false)
    }
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault()
    if (!unlockEmail.trim()) return
    setUnlocking(true)
    setUnlockError(null)
    setUnlockSuccess(false)
    try {
      await unlockAccess({ data: { mail: unlockEmail.trim() } })
      setUnlockSuccess(true)
      setUnlockEmail('')
    } catch (err: unknown) {
      setUnlockError(err instanceof Error ? err.message : String(err))
    } finally {
      setUnlocking(false)
    }
  }

  async function handleLogout() {
    const auth = getAuthClient()
    if (auth) await auth.auth.signOut()
    navigate({ to: '/admin/login' })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Mic2 className="h-4 w-4 text-white" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">AutoMic</span>
            <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
              admin
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Add Songs
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">

        {/* Session + Unlock cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2">

          {/* Session Management */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Session</h2>
                <p className="mt-0.5 text-sm text-gray-500">Control karaoke night availability.</p>
              </div>
              {isActive === null ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              ) : (
                <span className={clsx(
                  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                  isActive
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-gray-100 text-gray-500',
                )}>
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              )}
            </div>
            <div className="p-5">
              <button
                onClick={handleToggleSession}
                disabled={sessionWorking || isActive === null}
                className={clsx(
                  'flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                  isActive
                    ? 'border border-gray-200 text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
                    : 'bg-gray-900 text-white hover:bg-gray-700',
                )}
              >
                {sessionWorking
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                {isActive ? 'End Session' : 'Create Session'}
              </button>
            </div>
            {sessionMsg && (
              <div className="border-t border-gray-100 px-5 pb-4">
                <p className={clsx('text-xs', sessionMsg.type === 'error' ? 'text-red-500' : 'text-amber-600')}>
                  {sessionMsg.text}
                </p>
              </div>
            )}
          </div>

          {/* Unlock Access */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Unlock Access</h2>
              <p className="mt-0.5 text-sm text-gray-500">Reset the failed-attempt counter for a locked entry.</p>
            </div>
            <form onSubmit={handleUnlock} noValidate className="flex items-start gap-3 p-5">
              <div className="relative flex-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <AtSign className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  placeholder="jane@example.com"
                  value={unlockEmail}
                  onChange={(e) => { setUnlockEmail(e.target.value); setUnlockError(null); setUnlockSuccess(false) }}
                  className="input-base pl-9"
                  suppressHydrationWarning
                />
              </div>
              <button
                type="submit"
                disabled={unlocking || !unlockEmail.trim()}
                className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockOpen className="h-4 w-4" />}
                Unlock
              </button>
            </form>
            {(unlockError || unlockSuccess) && (
              <div className="border-t border-gray-100 px-5 pb-4">
                {unlockSuccess && <p className="text-xs text-green-700">Access unlocked successfully.</p>}
                {unlockError && <p className="text-xs text-red-500">{unlockError}</p>}
              </div>
            )}
          </div>

        </div>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Queue</h1>
            <p className="mt-0.5 text-sm text-gray-500">Remove entries to advance the queue.</p>
          </div>
          {!loading && (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
              {queue.length} {queue.length === 1 ? 'song' : 'songs'}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : queue.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
            <Music2 className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-400">Queue is empty.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="h-10 w-10 px-4 text-left font-medium text-gray-500">#</th>
                  <th className="h-10 w-48 px-4 text-left font-medium text-gray-500">Name</th>
                  <th className="h-10 w-48 px-4 text-left font-medium text-gray-500">Email</th>
                  <th className="h-10 w-88 px-4 text-left font-medium text-gray-500">Karaoke</th>
                  <th className="h-10 px-4 text-left font-medium text-gray-500">Status</th>
                  <th className="h-10 px-4" />
                </tr>
              </thead>
              <tbody>
                {queue.map((entry, i) => {
                  const status = statusForEntry(i, playingIndex)
                  return (
                    <tr
                      key={entry.id}
                      className={clsx(
                        'border-b border-gray-100 transition-colors last:border-0',
                        status === 'played' ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-gray-50',
                      )}
                    >
                      <td className="px-4 py-3 tabular-nums text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{trunc(entry.name, 18)}</td>
                      <td className="px-4 py-3">
                        <div className="group relative inline-block">
                          <button
                            onClick={() => handleCopyEmail(entry.mail, entry.id)}
                            className="text-xs text-gray-500 transition-colors hover:text-gray-900"
                          >
                            {trunc(entry.mail, 22)}
                          </button>
                          {entry.mail.length > 22 && (
                            <span className="pointer-events-none absolute left-0 top-0 z-50 whitespace-nowrap rounded-md bg-white pl-0 pr-2.5 py-1 text-xs text-gray-600 opacity-0 shadow-sm ring-1 ring-gray-200 transition-opacity group-hover:opacity-100">
                              {copied === entry.id ? 'Copied!' : entry.mail}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="group relative">
                          <a
                            href={entry.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setPlayingIndex(i)}
                            className="inline-flex items-center gap-1.5 text-gray-500 transition-colors hover:text-gray-900"
                          >
                            <Clapperboard className="h-3.5 w-3.5 shrink-0 text-red-500" />
                            <span className="text-xs">{trunc(titles[entry.link] || entry.link, 44)}</span>
                          </a>
                          {(titles[entry.link] || entry.link).length > 44 && (
                            <span className="pointer-events-none absolute left-0 top-0 z-50 whitespace-nowrap rounded-md bg-white pl-0 pr-2.5 py-1 text-xs text-gray-600 opacity-0 shadow-sm ring-1 ring-gray-200 transition-opacity group-hover:opacity-100">
                              {titles[entry.link] || entry.link}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                            STATUS_CLS[status],
                          )}
                        >
                          {STATUS_LABEL[status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(entry.id)}
                          disabled={deleting === entry.id}
                          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                        >
                          {deleting === entry.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
