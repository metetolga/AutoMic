import { createFileRoute, redirect, useNavigate, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { Mic2, Loader2, Trash2, Music2, Youtube, LogOut, ArrowLeft } from 'lucide-react'
import { supabase, type QueueRow } from '../../lib/supabase'
import { getAuthClient } from '../../lib/supabase.auth'
import { getYoutubeTitle } from '../../lib/youtube.util'

export const Route = createFileRoute('/admin/')({
  beforeLoad: async () => {
    const auth = getAuthClient()
    if (!auth) return // SSR — client-side navigation will enforce the check
    const { data: { session } } = await auth.auth.getSession()
    if (!session) throw redirect({ to: '/admin/login' })
  },
  component: AdminDashboard,
})

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

  async function handleDelete(id: number) {
    setDeleting(id)
    const { error } = await supabase.from('queue').delete().eq('id', id)
    if (!error) setQueue(prev => prev.filter(e => e.id !== id))
    setDeleting(null)
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
            <span className="text-[15px] font-semibold tracking-tight">händlebar</span>
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
                  <th className="h-10 px-4 text-left font-medium text-gray-500">Name</th>
                  <th className="h-10 px-4 text-left font-medium text-gray-500">Email</th>
                  <th className="h-10 w-32 px-4 text-left font-medium text-gray-500">Song</th>
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
                      <td className="px-4 py-3 font-medium text-gray-900">{entry.name}</td>
                      <td className="px-4 py-3">
                        <div className="group relative inline-block">
                          <button
                            onClick={() => handleCopyEmail(entry.mail, entry.id)}
                            className="text-xs text-gray-500 transition-colors hover:text-gray-900"
                          >
                            {entry.mail}
                          </button>
                          <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 rounded bg-gray-900 px-2 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                            {copied === entry.id ? 'Copied!' : 'Copy'}
                          </span>
                        </div>
                      </td>
                      <td className="w-28 px-4 py-3">
                        <a
                          href={entry.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setPlayingIndex(i)}
                          className="inline-flex w-full items-center gap-1.5 text-gray-500 transition-colors hover:text-gray-900"
                        >
                          <Youtube className="h-3.5 w-3.5 shrink-0 text-red-500" />
                          <span className="truncate text-xs">
                            {titles[entry.link] ?? entry.link}
                          </span>
                        </a>
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
