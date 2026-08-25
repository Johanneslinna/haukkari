import type { Session } from '@supabase/supabase-js'
import type { AuthApi } from '../features/auth/authApi'

const now = Math.floor(Date.now() / 1000)
const session = {
  access_token: 'local-app-harness-token',
  refresh_token: 'local-app-harness-refresh',
  expires_in: 86_400,
  expires_at: now + 86_400,
  token_type: 'bearer',
  user: {
    id: '44444444-4444-4444-8444-444444444444',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'mobiilitesti@example.invalid',
    email_confirmed_at: new Date().toISOString(),
    phone: '',
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { display_name: 'Mobiilitesti' },
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_anonymous: false,
  },
} as Session

const noOp = async () => undefined

export const appHarnessAuthApi: AuthApi = {
  getSession: async () => session,
  onAuthStateChange: () => ({ unsubscribe: () => undefined }),
  signIn: noOp,
  signUp: noOp,
  sendPasswordReset: noOp,
  updatePassword: noOp,
  exchangeCode: noOp,
  signOut: noOp,
  deleteAccount: noOp,
}
