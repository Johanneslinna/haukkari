import type { ZodError } from 'zod'

export type FieldErrors = Record<string, string>

export const fieldErrorsFromZod = (error: ZodError): FieldErrors =>
  Object.fromEntries(
    error.issues.map((issue) => [String(issue.path[0] ?? 'form'), issue.message]),
  )

export const authErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('invalid login credentials')) {
    return 'Sähköposti tai salasana on väärin.'
  }
  if (message.includes('email not confirmed')) {
    return 'Vahvista sähköpostiosoite ennen kirjautumista.'
  }
  if (message.includes('user already registered')) {
    return 'Tällä sähköpostiosoitteella on jo tili.'
  }
  if (message.includes('supabase-yhteyttä'))
    return 'Palveluyhteyttä ei ole vielä määritetty.'
  return 'Toiminto ei onnistunut. Tarkista verkkoyhteys ja yritä uudelleen.'
}
