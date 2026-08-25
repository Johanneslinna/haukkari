import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../AuthLayout'
import { useAuth } from '../authContextValue'
import { loginSchema } from '../authSchemas'
import { authErrorMessage, fieldErrorsFromZod, type FieldErrors } from '../formUtils'

export function LoginPage() {
  const { api, session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (session) navigate('/', { replace: true })
  }, [navigate, session])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setServerError('')
    const form = new FormData(event.currentTarget)
    const parsed = loginSchema.safeParse({
      email: form.get('email'),
      password: form.get('password'),
    })
    if (!parsed.success) {
      setErrors(fieldErrorsFromZod(parsed.error))
      return
    }

    setErrors({})
    setPending(true)
    try {
      await api.signIn(parsed.data.email, parsed.data.password)
      const state = location.state as { from?: { pathname?: string } } | null
      navigate(state?.from?.pathname ?? '/', { replace: true })
    } catch (error) {
      setServerError(authErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout title="Kirjaudu" description="Jatka omaan harjoitussuunnitelmaasi.">
      <form className="form" onSubmit={submit} noValidate>
        <Field label="Sähköposti" name="email" type="email" error={errors.email} />
        <Field label="Salasana" name="password" type="password" error={errors.password} />
        {serverError && (
          <p className="form-error" role="alert">
            {serverError}
          </p>
        )}
        <button className="button button-primary button-wide" disabled={pending}>
          {pending ? 'Kirjaudutaan…' : 'Kirjaudu'}
        </button>
      </form>
      <div className="auth-links">
        <Link to="/salasana/unohtui">Unohditko salasanan?</Link>
        <span>
          Ei vielä tiliä? <Link to="/rekisteroidy">Luo tili</Link>
        </span>
      </div>
    </AuthLayout>
  )
}

export function Field({
  label,
  name,
  type = 'text',
  error,
  autoComplete,
}: {
  label: string
  name: string
  type?: string
  error?: string
  autoComplete?: string
}) {
  const errorId = `${name}-error`
  return (
    <label className="field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error && <small id={errorId}>{error}</small>}
    </label>
  )
}
