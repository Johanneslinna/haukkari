import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../infrastructure/supabase/client'
import type { Database } from '../../infrastructure/supabase/database.types'

export type AuthSubscription = { unsubscribe: () => void }

export type AuthApi = {
  getSession: () => Promise<Session | null>
  onAuthStateChange: (
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ) => AuthSubscription
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  exchangeCode: (code: string) => Promise<void>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<void>
}

const requireClient = (client: SupabaseClient<Database> | null) => {
  if (!client) {
    throw new Error('Supabase-yhteyttä ei ole määritetty.')
  }
  return client
}

const throwIfError = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

export const createAuthApi = (client: SupabaseClient<Database> | null): AuthApi => ({
  async getSession() {
    const { data, error } = await requireClient(client).auth.getSession()
    throwIfError(error)
    return data.session
  },

  onAuthStateChange(callback) {
    if (!client) return { unsubscribe: () => undefined }
    const { data } = client.auth.onAuthStateChange(callback)
    return data.subscription
  },

  async signIn(email, password) {
    const { error } = await requireClient(client).auth.signInWithPassword({
      email,
      password,
    })
    throwIfError(error)
  },

  async signUp(email, password, displayName) {
    const { error } = await requireClient(client).auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { display_name: displayName },
      },
    })
    throwIfError(error)
  },

  async sendPasswordReset(email) {
    const { error } = await requireClient(client).auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/salasana/uusi`,
    })
    throwIfError(error)
  },

  async updatePassword(password) {
    const { error } = await requireClient(client).auth.updateUser({ password })
    throwIfError(error)
  },

  async exchangeCode(code) {
    const { error } = await requireClient(client).auth.exchangeCodeForSession(code)
    throwIfError(error)
  },

  async signOut() {
    const { error } = await requireClient(client).auth.signOut({ scope: 'local' })
    throwIfError(error)
  },

  async deleteAccount() {
    const { error } = await requireClient(client).functions.invoke('delete-account', {
      body: { confirmation: 'POISTA' },
    })
    throwIfError(error)
  },
})

export const authApi = createAuthApi(supabase)
