import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../AuthLayout'
import { useAuth } from '../authContextValue'
import { resetPasswordSchema } from '../authSchemas'
import { authErrorMessage, fieldErrorsFromZod, type FieldErrors } from '../formUtils'
import { Field } from './LoginPage'

export function ResetPasswordPage() {
  const { api, session } = useAuth()
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState('')
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const parsed = resetPasswordSchema.safeParse({
      password: form.get('password'),
      passwordConfirmation: form.get('passwordConfirmation'),
    })
    if (!parsed.success) {
      setErrors(fieldErrorsFromZod(parsed.error))
      return
    }
    setErrors({})
    setServerError('')
    setPending(true)
    try {
      await api.updatePassword(parsed.data.password)
      setDone(true)
    } catch (error) {
      setServerError(authErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout
      title="Aseta uusi salasana"
      description="Valitse uusi, vähintään 12 merkin salasana."
    >
      {done ? (
        <Link className="button button-primary button-wide" to="/">
          Jatka Haukkariin
        </Link>
      ) : !session ? (
        <p className="form-error" role="alert">
          Palautusistunto puuttuu tai linkki on vanhentunut.{' '}
          <Link to="/salasana/unohtui">Pyydä uusi linkki.</Link>
        </p>
      ) : (
        <form className="form" onSubmit={submit} noValidate>
          <Field
            label="Uusi salasana"
            name="password"
            type="password"
            autoComplete="new-password"
            error={errors.password}
          />
          <Field
            label="Uusi salasana uudelleen"
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            error={errors.passwordConfirmation}
          />
          {serverError && (
            <p className="form-error" role="alert">
              {serverError}
            </p>
          )}
          <button className="button button-primary button-wide" disabled={pending}>
            {pending ? 'Tallennetaan…' : 'Tallenna uusi salasana'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
