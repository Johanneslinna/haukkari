import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import type { AuthApi } from './authApi'

export type AuthContextValue = {
  session: Session | null
  loading: boolean
  api: AuthApi
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth pitää kutsua AuthProviderin sisällä.')
  return context
}
