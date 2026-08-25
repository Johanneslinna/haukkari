import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../AuthLayout'
import { useAuth } from '../authContextValue'
import { emailSchema } from '../authSchemas'
import { authErrorMessage } from '../formUtils'
import { Field } from './LoginPage'

export function ForgotPasswordPage() {
  const { api } = useAuth()
  const [emailError, setEmailError] = useState('')
  const [serverError, setServerError] = useState('')
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const parsed = emailSchema.safeParse(form.get('email'))
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message ?? 'Tarkista sähköpostiosoite.')
      return
    }
    setEmailError('')
    setServerError('')
    setPending(true)
    try {
      await api.sendPasswordReset(parsed.data)
      setSent(true)
    } catch (error) {
      setServerError(authErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout
      title="Palauta salasana"
      description="Saat sähköpostiin linkin uuden salasanan asettamista varten."
    >
      {sent ? (
        <p className="success-message" role="status">
          Jos osoitteella on tili, lähetimme siihen palautuslinkin.
        </p>
      ) : (
        <form className="form" onSubmit={submit} noValidate>
          <Field
            label="Sähköposti"
            name="email"
            type="email"
            autoComplete="email"
            error={emailError}
          />
          {serverError && (
            <p className="form-error" role="alert">
              {serverError}
            </p>
          )}
          <button className="button button-primary button-wide" disabled={pending}>
            {pending ? 'Lähetetään…' : 'Lähetä palautuslinkki'}
          </button>
        </form>
      )}
      <p className="auth-links">
        <Link to="/kirjaudu">Palaa kirjautumiseen</Link>
      </p>
    </AuthLayout>
  )
}
