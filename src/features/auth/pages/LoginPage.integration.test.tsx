import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { AuthApi } from '../authApi'
import { AuthContext } from '../authContextValue'
import { LoginPage } from './LoginPage'

const createApi = (): AuthApi => ({
  getSession: vi.fn().mockResolvedValue(null),
  onAuthStateChange: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
  signIn: vi.fn().mockResolvedValue(undefined),
  signUp: vi.fn().mockResolvedValue(undefined),
  sendPasswordReset: vi.fn().mockResolvedValue(undefined),
  updatePassword: vi.fn().mockResolvedValue(undefined),
  exchangeCode: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
  deleteAccount: vi.fn().mockResolvedValue(undefined),
})

const renderPage = (api: AuthApi) =>
  render(
    <MemoryRouter initialEntries={['/kirjaudu']}>
      <AuthContext.Provider value={{ api, session: null, loading: false }}>
        <LoginPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  )

describe('kirjautumissivu', () => {
  it('estää virheellisen sähköpostin ennen palvelukutsua', async () => {
    const api = createApi()
    const user = userEvent.setup()
    renderPage(api)

    await user.type(screen.getByLabelText('Sähköposti'), 'ei-osoite')
    await user.type(screen.getByLabelText('Salasana'), 'salasana')
    await user.click(screen.getByRole('button', { name: 'Kirjaudu' }))

    expect(screen.getByText('Anna kelvollinen sähköpostiosoite.')).toBeInTheDocument()
    expect(api.signIn).not.toHaveBeenCalled()
  })

  it('lähettää validoidut tunnukset autentikointipalvelulle', async () => {
    const api = createApi()
    const user = userEvent.setup()
    renderPage(api)

    await user.type(screen.getByLabelText('Sähköposti'), 'testi@example.invalid')
    await user.type(screen.getByLabelText('Salasana'), 'salasana')
    await user.click(screen.getByRole('button', { name: 'Kirjaudu' }))

    expect(api.signIn).toHaveBeenCalledWith('testi@example.invalid', 'salasana')
  })
})
