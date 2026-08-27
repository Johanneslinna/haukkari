import { z } from 'zod'
import { goalStrategies } from '../../domain/coaching'

const goalValues = Object.keys(goalStrategies) as [
  keyof typeof goalStrategies,
  ...(keyof typeof goalStrategies)[],
]

export const onboardingSchema = z
  .object({
    displayName: z.string().trim().min(2, 'Anna vähintään kaksi merkkiä pitkä nimi.'),
    age: z
      .number()
      .int()
      .min(
        18,
        'Haukkarin automaattinen harjoitusmoottori on tällä hetkellä tarkoitettu vähintään 18-vuotiaille.',
      )
      .max(100),
    heightCm: z.number().min(80).max(250),
    weightKg: z.number().min(20).max(400),
    primaryGoal: z.enum(goalValues),
    secondaryGoals: z.array(z.enum(goalValues)).max(2),
    targetDate: z
      .string()
      .refine(
        (value) => value === '' || /^\d{4}-\d{2}-\d{2}$/u.test(value),
        'Anna tavoitepäivä muodossa vvvv-kk-pp.',
      ),
    experience: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
    availableDays: z.array(z.number().int().min(1).max(7)).min(1),
    minutesPerSession: z.number().int().min(10).max(240),
    minutesByDay: z.record(z.string(), z.number().int().min(10).max(240)),
    currentEnduranceMinutes: z.number().int().min(0).max(2_000),
    weeklyActivities: z
      .array(
        z.object({
          id: z.string().min(1),
          kind: z.enum(['RUNNING', 'STRENGTH', 'SPORT', 'OTHER']),
          day: z.number().int().min(1).max(7),
          durationMinutes: z.number().int().min(10).max(300),
          intensity: z.enum(['EASY', 'MODERATE', 'HARD']),
        }),
      )
      .max(14)
      .default([]),
    currentWeeklyTraining: z.string(),
    enduranceSportBackground: z.string(),
    physicalLoad: z.enum(['LOW', 'MODERATE', 'HIGH']),
    equipment: z
      .array(z.string())
      .min(1, 'Valitse vähintään yksi käytettävissä oleva väline.'),
    likes: z.string(),
    dislikes: z.string(),
    sleepHours: z.number().min(0).max(16),
    dietRestrictions: z.string(),
    trackingMode: z.enum(['PORTIONS', 'CALORIES']),
    healthConcern: z.boolean(),
    healthNotes: z.string(),
    medicationAffectsHeartRate: z.boolean(),
    pregnancyStatus: z.enum([
      'NOT_APPLICABLE',
      'PREGNANT',
      'BREASTFEEDING',
      'POSTPARTUM',
      'PREFER_NOT_TO_SAY',
    ]),
    doctorRestrictions: z.string(),
    currentInjuries: z.string(),
    confirmedLimitationTags: z
      .array(
        z.enum([
          'ACUTE_KNEE_PAIN',
          'ACUTE_BACK_PAIN',
          'ACUTE_SHOULDER_PAIN',
          'ACUTE_WRIST_PAIN',
          'GAIT_ALTERING_PAIN',
          'OVERHEAD_RESTRICTION',
          'ACHILLES_PAIN',
          'CALF_INJURY',
          'HAMSTRING_INJURY',
        ]),
      )
      .default([]),
    pelvicFloorSymptoms: z.string(),
    exertionWarningSymptoms: z.boolean(),
    eatingDisorderHistory: z.boolean(),
    menstrualTrackingOptIn: z.boolean(),
    desiredMetrics: z.array(z.string()).min(1, 'Valitse vähintään yksi kehitysmittari.'),
    sensitiveConsent: z.boolean(),
  })
  .refine((value) => !value.secondaryGoals.includes(value.primaryGoal), {
    message: 'Päätavoite ei voi olla myös sivutavoite.',
    path: ['secondaryGoals'],
  })
  .superRefine((value, context) => {
    if (hasSensitiveHealthData(value) && !value.sensitiveConsent) {
      context.addIssue({
        code: 'custom',
        path: ['sensitiveConsent'],
        message:
          'Anna nimenomainen suostumus antamiesi terveystietojen käsittelyyn tai tyhjennä vapaaehtoiset terveystiedot.',
      })
    }
  })

export function hasSensitiveHealthData(
  value: Pick<
    z.input<typeof onboardingSchema>,
    | 'healthConcern'
    | 'healthNotes'
    | 'medicationAffectsHeartRate'
    | 'pregnancyStatus'
    | 'doctorRestrictions'
    | 'currentInjuries'
    | 'confirmedLimitationTags'
    | 'pelvicFloorSymptoms'
    | 'exertionWarningSymptoms'
    | 'eatingDisorderHistory'
    | 'menstrualTrackingOptIn'
  >,
) {
  return (
    value.healthConcern ||
    value.exertionWarningSymptoms ||
    value.medicationAffectsHeartRate ||
    value.eatingDisorderHistory ||
    value.menstrualTrackingOptIn ||
    (value.pregnancyStatus !== 'NOT_APPLICABLE' &&
      value.pregnancyStatus !== 'PREFER_NOT_TO_SAY') ||
    value.healthNotes.trim().length > 0 ||
    value.doctorRestrictions.trim().length > 0 ||
    value.currentInjuries.trim().length > 0 ||
    (value.confirmedLimitationTags?.length ?? 0) > 0 ||
    value.pelvicFloorSymptoms.trim().length > 0
  )
}

export type OnboardingForm = Omit<
  z.output<typeof onboardingSchema>,
  'sensitiveConsent'
> & {
  sensitiveConsent: boolean
}
