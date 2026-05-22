import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { supabase, type QueueRow } from './supabase'

export const getTurnstileSiteKey = createServerFn({ method: 'GET' })
  .handler(() => ({ turnstileSiteKey: process.env.TURNSTILE_SITE_KEY ?? '' }))

export const getAppState = createServerFn({ method: 'GET' })
  .handler(async () => {
    const admin = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data } = await admin.from('app_state').select('is_active').single()
    return { isActive: (data?.is_active ?? false) as boolean }
  })

export const setSessionActive = createServerFn({ method: 'POST' })
  .inputValidator((data: { active: boolean }) => data)
  .handler(async ({ data }) => {
    const admin = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: rows, error } = await admin
      .from('app_state')
      .update({ is_active: data.active })
      .gte('id', 0)
      .select('id')

    if (error) throw new Error(error.message)
    if (!rows || rows.length === 0)
      throw new Error('No rows updated — check that the app_state table has at least one row.')

    if (!data.active) {
      const { error: clearError } = await admin.from('queue').delete().gte('id', 0)
      if (clearError) throw new Error(clearError.message)
    }
  })

type InsertInput = {
  name: string
  mail: string
  pin: number
  link: string
  turnstileToken: string
}

const COOLDOWN_MS = 25 * 60 * 1000

export const addToQueue = createServerFn({ method: 'POST' })
  .inputValidator((data: InsertInput) => data)
  .handler(async ({ data }) => {
    const admin = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: appState } = await admin.from('app_state').select('is_active').single()
    if (!appState?.is_active) throw new Error('Karaoke night is currently closed.')

    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY!,
        response: data.turnstileToken,
      }),
    })
    const verify = await verifyRes.json() as { success: boolean }
    if (!verify.success) throw new Error('Security check failed. Please try again.')

    const { data: activity } = await admin
      .from('user_activity')
      .select('last_song_added_at')
      .eq('email', data.mail)
      .maybeSingle()

    if (activity?.last_song_added_at) {
      const elapsed = Date.now() - new Date(activity.last_song_added_at).getTime()
      if (elapsed < COOLDOWN_MS) {
        const remainingMin = Math.ceil((COOLDOWN_MS - elapsed) / 60000)
        throw new Error(
          `Cooldown active. You can add another song in ${remainingMin} minute${remainingMin !== 1 ? 's' : ''}.`,
        )
      }
    }

    const { data: inserted, error } = await admin
      .from('queue')
      .insert({ name: data.name, mail: data.mail, pin: data.pin, link: data.link })
      .select()
      .single()

    if (error) {
      if (error.code === '23505')
        throw new Error('You already have a song in the queue. Edit your existing entry instead.')
      throw new Error(error.message)
    }

    await admin
      .from('user_activity')
      .upsert({ email: data.mail, last_song_added_at: new Date().toISOString() }, { onConflict: 'email' })

    return inserted as QueueRow
  })

type UpdateInput = {
  mail: string
  pin: number
  newLink: string
  turnstileToken: string
}

export const updateQueueLink = createServerFn({ method: 'POST' })
  .inputValidator((data: UpdateInput) => data)
  .handler(async ({ data }) => {
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY!,
        response: data.turnstileToken,
      }),
    })
    const verify = await verifyRes.json() as { success: boolean }
    if (!verify.success) throw new Error('Security check failed. Please try again.')

    const { data: entry, error: findError } = await supabase
      .from('queue')
      .select('id, pin, failed_pin_attempts')
      .eq('mail', data.mail)
      .single()

    if (findError || !entry) throw new Error('No entry found for that email.')

    if (entry.failed_pin_attempts >= 3)
      throw new Error('Too many failed attempts. Contact the host to unlock your entry.')

    if (entry.pin !== data.pin) {
      const newCount = entry.failed_pin_attempts + 1
      await supabase.from('queue').update({ failed_pin_attempts: newCount }).eq('id', entry.id)
      const remaining = 3 - newCount
      throw new Error(
        remaining === 0
          ? 'Incorrect PIN. Your entry is now locked — contact the host to unlock it.'
          : `Incorrect PIN. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`,
      )
    }

    const { data: updated, error: updateError } = await supabase
      .from('queue')
      .update({ link: data.newLink })
      .eq('id', entry.id)
      .select()
      .single()

    if (updateError) throw new Error(updateError.message)
    return updated as QueueRow
  })

export const unlockAccess = createServerFn({ method: 'POST' })
  .inputValidator((data: { mail: string }) => data)
  .handler(async ({ data }) => {
    const { error } = await supabase
      .from('queue')
      .update({ failed_pin_attempts: 0 })
      .eq('mail', data.mail)
    if (error) throw new Error(error.message)
  })
