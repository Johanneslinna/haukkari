import { z } from 'zod'

export const emailSchema = z.email('Anna kelvollinen sähköpostiosoite.')

export const passwordSchema = z
  .string()
  .min(12, 'Salasanassa pitää olla vähintään 12 merkkiä.')
  .regex(/[a-zåäö]/, 'Lisää salasanaan pieni kirjain.')
  .regex(/[A-ZÅÄÖ]/, 'Lisää salasanaan iso kirjain.')
  .regex(/[0-9]/, 'Lisää salasanaan numero.')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Anna salasana.'),
})

export const registrationSchema = z
  .object({
    displayName: z.string().trim().min(2, 'Anna vähintään kaksi merkkiä.'),
    email: emailSchema,
    password: passwordSchema,
    passwordConfirmation: z.string(),
    privacyAccepted: z
      .boolean()
      .refine((accepted) => accepted, 'Hyväksy tietojen käsittelyä koskeva kuvaus.'),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'Salasanat eivät täsmää.',
  })

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'Salasanat eivät täsmää.',
  })
