import { createClient } from '@supabase/supabase-js'

export type QueueRow = {
  id: number
  created_at: string
  name: string
  mail: string
  pin: number
  link: string
  failed_pin_attempts: number
}

export const supabase = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.VITE_SUPABASE_KEY as string,
)
