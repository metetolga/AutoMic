import { createClient } from '@supabase/supabase-js'

export type QueueRow = {
  id: number
  created_at: string
  name: string
  mail: string
  pin: number
  link: string
}

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_KEY as string,
)
