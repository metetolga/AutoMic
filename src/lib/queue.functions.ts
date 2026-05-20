import { createServerFn } from '@tanstack/react-start'
import { supabase, type QueueRow } from './supabase'

type InsertInput = {
  name: string
  mail: string
  pin: number
  link: string
  turnstileToken: string
}

export const addToQueue = createServerFn({ method: 'POST' })
  .inputValidator((data: InsertInput) => data)
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

    const { data: inserted, error } = await supabase
      .from('queue')
      .insert({ name: data.name, mail: data.mail, pin: data.pin, link: data.link })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return inserted as QueueRow
  })

type UpdateInput = {
  mail: string
  pin: number
  newLink: string
}

export const updateQueueLink = createServerFn({ method: 'POST' })
  .inputValidator((data: UpdateInput) => data)
  .handler(async ({ data }) => {
    const { data: entry, error: findError } = await supabase
      .from('queue')
      .select('id')
      .eq('mail', data.mail)
      .eq('pin', data.pin)
      .single()

    if (findError || !entry) throw new Error('No entry found for that email and PIN.')

    const { data: updated, error: updateError } = await supabase
      .from('queue')
      .update({ link: data.newLink })
      .eq('id', entry.id)
      .select()
      .single()

    if (updateError) throw new Error(updateError.message)
    return updated as QueueRow
  })
