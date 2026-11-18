import { createClient } from '@supabase/supabase-js'

// Reads the Supabase credentials from the environment (Vite exposes only
// variables prefixed with VITE_ to the browser). Real keys live in .env
// locally and in the Netlify site settings — never in code.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

// Placeholder values keep createClient from throwing when env vars are
// missing; the app shows a setup notice instead of crashing.
export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder-anon-key',
)
