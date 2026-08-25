import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../AuthLayout'
import { useAuth } from '../authContextValue'
import { registrationSchema } from '../authSchemas'
import { authErrorMessage, fieldErrorsFromZod, type FieldErrors } from '../formUtils'
import { Field } from './LoginPage'

export function RegisterPage() {
  const { api } = useAuth()
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState('')
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const parsed = registrationSchema.safeParse({
      displayName: form.get('displayName'),
      email: form.get('email'),
      password: form.get('password'),
      passwordConfirmation: form.get('passwordConfirmation'),
      privacyAccepted: form.get('privacyAccepted') === 'on',
    })
    if (!parsed.success) {
      setErrors(fieldErrorsFromZod(parsed.error))
      return
    }

    setErrors({})
    setServerError('')
    setPending(true)
    try {
      await api.signUp(parsed.data.email, parsed.data.password, parsed.data.displayName)
      setSent(true)
    } catch (error) {
      setServerError(authErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  if (sent) {
    return (
      <AuthLayout
        title="Vahvista sähköpostisi"
        description="Lähetimme vahvistuslinkin antamaasi osoitteeseen."
      >
        <p className="success-message" role="status">
          Avaa viesti samalla laitteella ja palaa sen jälkeen kirjautumaan. Tarkista myös
          roskapostikansio.
        </p>
        <Link className="button button-primary button-wide" to="/kirjaudu">
          Palaa kirjautumiseen
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Luo tili"
      description="Ensimmäinen kirjautuminen vaatii verkkoyhteyden."
    >
      <form className="form" onSubmit={submit} noValidate>
        <Field
          label="Nimi"
          name="displayName"
          autoComplete="name"
          error={errors.displayName}
        />
        <Field
          label="Sähköposti"
          name="email"
          type="email"
          autoComplete="email"
          error={errors.email}
        />
        <Field
          label="Salasana"
          name="password"
          type="password"
          autoComplete="new-password"
          error={errors.password}
        />
        <Field
          label="Salasana uudelleen"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          error={errors.passwordConfirmation}
        />
        <label className="checkbox-field">
          <input name="privacyAccepted" type="checkbox" />
          <span>
            Olen lukenut <Link to="/tietosuoja">tietojen käsittelyn kuvauksen</Link> ja
            hyväksyn tilin luomisen.
          </span>
        </label>
        {errors.privacyAccepted && (
          <p className="field-error">{errors.privacyAccepted}</p>
        )}
        {serverError && (
          <p className="form-error" role="alert">
            {serverError}
          </p>
        )}
        <button className="button button-primary button-wide" disabled={pending}>
          {pending ? 'Luodaan tiliä…' : 'Luo tili'}
        </button>
      </form>
      <p className="auth-links">
        Onko sinulla jo tili? <Link to="/kirjaudu">Kirjaudu</Link>
      </p>
    </AuthLayout>
  )
}
