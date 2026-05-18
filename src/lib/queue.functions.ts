import { createServerFn } from '@tanstack/react-start'
import { supabase, type QueueRow } from './supabase'

type InsertInput = {
  name: string
  mail: string
  pin: number
  link: string
}

export const addToQueue = createServerFn({ method: 'POST' })
  .inputValidator((data: InsertInput) => data)
  .handler(async ({ data }) => {
    const { data: inserted, error } = await supabase
      .from('queue')
      .insert(data)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return inserted as QueueRow
  })
