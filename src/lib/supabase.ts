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

// Browser-only — import.meta.env.VITE_* is baked into the client bundle at build time.
// Never call this on the server; server functions create their own clients via process.env.
let _client: ReturnType<typeof createClient> | null = null
export function getSupabase() {
  return (_client ??= createClient(
    import.meta.env.VITE_SUPABASE_URL as string,
    import.meta.env.VITE_SUPABASE_KEY as string,
  ))
}
