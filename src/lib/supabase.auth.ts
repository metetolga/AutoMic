import { createBrowserClient } from '@supabase/ssr'

let _client: ReturnType<typeof createBrowserClient> | null = null

export function getAuthClient() {
  if (typeof window === 'undefined') return null
  if (!_client) {
    _client = createBrowserClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      import.meta.env.VITE_SUPABASE_KEY as string,
    )
  }
  return _client
}
