import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '../AuthLayout'
import { useAuth } from '../authContextValue'
import { authErrorMessage } from '../formUtils'

export function AuthCallbackPage() {
  const { api } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      navigate('/', { replace: true })
      return
    }
    void api
      .exchangeCode(code)
      .then(() => navigate('/', { replace: true }))
      .catch((reason: unknown) => setError(authErrorMessage(reason)))
  }, [api, navigate, searchParams])

  return (
    <AuthLayout title="Vahvistetaan tiliä" description="Odota hetki.">
      {error ? (
        <p className="form-error" role="alert">
          {error} <Link to="/kirjaudu">Palaa kirjautumiseen.</Link>
        </p>
      ) : (
        <p role="status">Vahvistetaan turvallista istuntoa…</p>
      )}
    </AuthLayout>
  )
}
