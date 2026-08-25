import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from './database.types'

const publicConfigSchema = z.object({
  url: z.url(),
  anonKey: z.string().min(20),
})

const parsedConfig = publicConfigSchema.safeParse({
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
})

export const isSupabaseConfigured = parsedConfig.success

export const supabasePublicConfig = parsedConfig.success ? parsedConfig.data : null

export const supabase: SupabaseClient<Database> | null = parsedConfig.success
  ? createClient<Database>(parsedConfig.data.url, parsedConfig.data.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'treenikompassi.auth',
      },
    })
  : null
