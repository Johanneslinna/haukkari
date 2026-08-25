import type { Session } from '@supabase/supabase-js'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi, type AuthApi } from './authApi'
import { AuthContext } from './authContextValue'

export function AuthProvider({
  children,
  api = authApi,
}: {
  children: ReactNode
  api?: AuthApi
}) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void api
      .getSession()
      .then((nextSession) => {
        if (active) setSession(nextSession)
      })
      .catch(() => {
        if (active) setSession(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const subscription = api.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [api])

  const value = useMemo(() => ({ session, loading, api }), [api, loading, session])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
