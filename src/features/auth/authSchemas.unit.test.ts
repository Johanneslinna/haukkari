import { describe, expect, it } from 'vitest'
import { loginSchema, passwordSchema, registrationSchema } from './authSchemas'

describe('autentikoinnin validointi', () => {
  it('hyväksyy vahvan vähintään 12 merkin salasanan', () => {
    expect(passwordSchema.safeParse('Turvallinen123').success).toBe(true)
  })

  it('hylkää lyhyen tai numerottoman salasanan', () => {
    expect(passwordSchema.safeParse('Lyhyt1').success).toBe(false)
    expect(passwordSchema.safeParse('PitkaSalasana').success).toBe(false)
  })

  it('vaatii täsmäävät salasanat ja tietojen käsittelyn hyväksynnän', () => {
    const result = registrationSchema.safeParse({
      displayName: 'Testi Käyttäjä',
      email: 'testi@example.invalid',
      password: 'Turvallinen123',
      passwordConfirmation: 'EriSalasana123',
      privacyAccepted: false,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(['privacyAccepted', 'passwordConfirmation']),
      )
    }
  })

  it('kirjautumisessa riittää sähköpostin ja salasanan läsnäolo', () => {
    expect(
      loginSchema.safeParse({ email: 'testi@example.invalid', password: 'x' }).success,
    ).toBe(true)
  })
})
