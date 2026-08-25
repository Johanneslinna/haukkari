import { describe, expect, it } from 'vitest'
import { onboardingSchema } from './onboardingSchema'

const completeAnswers = {
  displayName: 'Aino',
  age: 30,
  heightCm: 168,
  weightKg: 60,
  primaryGoal: 'GENERAL_FITNESS' as const,
  secondaryGoals: ['BODY_RECOMPOSITION' as const],
  targetDate: '2027-06-12',
  experience: 'INTERMEDIATE' as const,
  availableDays: [1, 3, 5],
  minutesPerSession: 45,
  minutesByDay: { '1': 45, '3': 45, '5': 45 },
  currentEnduranceMinutes: 90,
  currentWeeklyTraining: 'Kaksi salitreeniä ja kaksi lenkkiä.',
  enduranceSportBackground: 'Juoksua viisi vuotta.',
  physicalLoad: 'MODERATE' as const,
  equipment: ['Kehonpaino'],
  likes: 'Juoksu',
  dislikes: 'Pitkät salitreenit',
  sleepHours: 7.5,
  dietRestrictions: '',
  trackingMode: 'PORTIONS' as const,
  healthConcern: false,
  healthNotes: '',
  medicationAffectsHeartRate: false,
  pregnancyStatus: 'NOT_APPLICABLE' as const,
  doctorRestrictions: '',
  currentInjuries: '',
  pelvicFloorSymptoms: '',
  exertionWarningSymptoms: false,
  eatingDisorderHistory: false,
  menstrualTrackingOptIn: false,
  desiredMetrics: ['Harjoitusten toteuma'],
  sensitiveConsent: true as const,
}

describe('aloituskartoituksen validointi', () => {
  it('hyväksyy briefin kaikki olennaiset lähtötiedot', () => {
    const parsed = onboardingSchema.parse(completeAnswers)

    expect(parsed.targetDate).toBe('2027-06-12')
    expect(parsed.desiredMetrics).toContain('Harjoitusten toteuma')
  })

  it('vaatii suostumuksen, kun vapaaehtoisia terveystietoja annetaan', () => {
    const parsed = onboardingSchema.safeParse({
      ...completeAnswers,
      healthConcern: true,
      sensitiveConsent: false,
    })

    expect(parsed.success).toBe(false)
  })

  it('sallii yleisen ohjelman ilman vapaaehtoisia terveystietoja ja suostumusta', () => {
    const parsed = onboardingSchema.safeParse({
      ...completeAnswers,
      sensitiveConsent: false,
    })

    expect(parsed.success).toBe(true)
  })

  it('vaatii vähintään yhden välineen ja kehitysmittarin', () => {
    const parsed = onboardingSchema.safeParse({
      ...completeAnswers,
      equipment: [],
      desiredMetrics: [],
    })

    expect(parsed.success).toBe(false)
  })
})
