import { describe, expect, it } from 'vitest'
import {
  ADULT_STRENGTH_TIME_POLICY_VERSION,
  ADULT_STRENGTH_TIME_POLICY,
  STRENGTH_TIME_INVARIANT_CODES,
  STRENGTH_TIME_REASON_CODES,
  adaptPrescription,
  auditStrengthPrescriptionTime,
  estimatePrescriptionTime,
  fitStrengthPrescriptionToTimeBudget,
  normalizePrescriptionV2,
  refreshStrengthPrescriptionTimeEstimate,
  resolvePrescription,
  type ExperienceLevel,
  type GoalType,
  type PrescribedSession,
  type WorkoutVariant,
} from '.'

const generatedAt = '2026-08-27T08:00:00.000Z'
const budgets = [10, 20, 30, 45, 60, 90] as const
const experiences: ExperienceLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']
const goals: GoalType[] = ['GENERAL_FITNESS', 'MAX_STRENGTH', 'MUSCLE_GAIN']
const readinessStates = ['GREEN', 'YELLOW'] as const
const equipmentProfiles = [
  { id: 'BANDS', equipment: ['Kehonpaino', 'Vastuskuminauhat'] },
  { id: 'DUMBBELLS', equipment: ['Kehonpaino', 'Käsipainot'] },
  { id: 'MACHINES', equipment: ['Kehonpaino', 'Kuntosalilaitteet'] },
  {
    id: 'FULL_GYM',
    equipment: ['Kehonpaino', 'Käsipainot', 'Kuntosalilaitteet', 'Levytanko ja painot'],
  },
] as const
const variantKinds: WorkoutVariant['kind'][] = [
  'FULL',
  'LIGHT',
  'COMPACT_10',
  'COMPACT_20',
  'COMPACT_30',
]

function variant(kind: WorkoutVariant['kind'], budget: number): WorkoutVariant {
  const timeBudgetMinutes = kind.startsWith('COMPACT')
    ? Math.min(budget, Number(kind.slice(-2)))
    : budget
  return {
    kind,
    timeBudgetMinutes,
    durationMinutes: timeBudgetMinutes,
    volumeMultiplier:
      kind === 'FULL' ? 1 : kind === 'LIGHT' ? 0.65 : timeBudgetMinutes / budget,
  }
}

function resolvedStrength(input: {
  budget: number
  experience?: ExperienceLevel
  goal?: GoalType
  readiness?: 'GREEN' | 'YELLOW'
  equipment?: string[]
}) {
  const result = resolvePrescription({
    sessionId: `time-${input.budget}-${input.experience ?? 'BEGINNER'}`,
    title: 'Kokovartalon voima',
    kind: 'STRENGTH',
    durationMinutes: input.budget,
    profile: {
      goal: input.goal ?? 'GENERAL_FITNESS',
      experience: input.experience ?? 'BEGINNER',
      equipment: input.equipment ?? ['Kehonpaino', 'Käsipainot'],
      physicalLoad: 'MODERATE',
      minutesPerSession: input.budget,
      age: 35,
      readiness: input.readiness ?? 'GREEN',
      healthBlocked: false,
      generatedAt,
    },
  })
  expect(result.status).toBe('SUPPORTED')
  if (result.status !== 'SUPPORTED') throw new Error(result.reasonCode)
  return result.prescription
}

function refreshedTimeSnapshot(prescription: PrescribedSession): PrescribedSession {
  const timeBreakdown = estimatePrescriptionTime(prescription)
  return {
    ...prescription,
    calculatedTotalSeconds: timeBreakdown.totalSeconds,
    timePolicyVersion: timeBreakdown.policyVersion,
    timeBreakdown,
  }
}

describe('Aikuisten voimaharjoittelun kanoninen aikamalli', () => {
  it('versionoi puskurin säilytyssemantiikan muuttamatta tavallisen prescriptionin laskentaa', () => {
    const prescription = resolvedStrength({ budget: 45 })
    expect(prescription.minimumTimeBufferSeconds).toBeUndefined()
    expect(prescription.timePolicyVersion).toBe(ADULT_STRENGTH_TIME_POLICY_VERSION)
    expect(ADULT_STRENGTH_TIME_POLICY_VERSION).toBe('adult-strength-time-1.1.0')

    const previousPolicy = {
      ...ADULT_STRENGTH_TIME_POLICY,
      version: 'adult-strength-time-1.0.0',
    }
    const current = estimatePrescriptionTime(prescription)
    const previous = estimatePrescriptionTime(prescription, previousPolicy)
    expect({ ...current, policyVersion: undefined }).toEqual({
      ...previous,
      policyVersion: undefined,
    })
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1])(
    'ei käytä virheellistä absoluuttista puskuria %s laskentavaltuutena',
    (minimumTimeBufferSeconds) => {
      const prescription = resolvedStrength({ budget: 45 })
      const baseline = estimatePrescriptionTime(prescription)
      const invalid = estimatePrescriptionTime({
        ...prescription,
        minimumTimeBufferSeconds,
      })
      expect(invalid).toEqual(baseline)
    },
  )

  it('säilyttää suuremman hyväksytyn absoluuttisen puskurin aikabudjetin sisällä', () => {
    const prescription = resolvedStrength({ budget: 60 })
    const preservedBufferSeconds = (prescription.timeBreakdown?.bufferSeconds ?? 0) + 60
    const fitted = fitStrengthPrescriptionToTimeBudget({
      prescription: {
        ...prescription,
        minimumTimeBufferSeconds: preservedBufferSeconds,
      },
      timeBudgetMinutes: 60,
    })
    expect(fitted.status).toBe('SUPPORTED')
    if (fitted.status !== 'SUPPORTED') throw new Error(fitted.reasonCode)
    expect(fitted.prescription.timeBreakdown?.bufferSeconds).toBeGreaterThanOrEqual(
      preservedBufferSeconds,
    )
    expect(fitted.prescription.calculatedTotalSeconds).toBeLessThanOrEqual(60 * 60)
    expect(auditStrengthPrescriptionTime(fitted.prescription).violations).toEqual([])
  })

  it('ei kirjoita toteutuneen 1.0.0-snapshotin näkyvää kestoa tai aikahistoriaa uudelleen', () => {
    const current = resolvedStrength({ budget: 45 })
    const historical = {
      ...current,
      durationMinutes: 41,
      timePolicyVersion: 'adult-strength-time-1.0.0',
      timeBreakdown: {
        ...current.timeBreakdown!,
        totalSeconds: 2_431,
        policyVersion: 'adult-strength-time-1.0.0',
      },
      calculatedTotalSeconds: 2_431,
    }
    const normalized = normalizePrescriptionV2(historical)
    expect(normalized).toBe(historical)
    expect(normalized.durationMinutes).toBe(41)
    expect(normalized.timePolicyVersion).toBe('adult-strength-time-1.0.0')
    expect(normalized.calculatedTotalSeconds).toBe(2_431)
    expect(normalized.timeBreakdown).toBe(historical.timeBreakdown)
  })

  it('käyttää yhtä versionoitua erittelyä kaikissa tuetuissa budjetti- ja varianttiyhdistelmissä', () => {
    let supported = 0
    for (const budget of budgets) {
      for (const experience of experiences) {
        for (const goal of goals) {
          for (const readiness of readinessStates) {
            for (const equipmentProfile of equipmentProfiles) {
              const full = resolvedStrength({
                budget,
                experience,
                goal,
                readiness,
                equipment: [...equipmentProfile.equipment],
              })
              for (const kind of variantKinds) {
                const requestedVariant = variant(kind, budget)
                const result = adaptPrescription(full, requestedVariant, {
                  age: 35,
                  readiness,
                  healthBlocked: false,
                  safetyInformationComplete: true,
                })
                expect(result.status).toBe('SUPPORTED')
                if (result.status !== 'SUPPORTED') throw new Error(result.reasonCode)
                const prescription = result.prescription
                const audit = auditStrengthPrescriptionTime(prescription)
                const breakdown = prescription.timeBreakdown
                const effectiveBudget = requestedVariant.timeBudgetMinutes!
                supported += 1

                expect(audit.violations).toEqual([])
                expect(breakdown?.policyVersion).toBe(ADULT_STRENGTH_TIME_POLICY.version)
                expect(breakdown?.totalSeconds).toBeLessThanOrEqual(effectiveBudget * 60)
                expect(prescription.calculatedTotalSeconds).toBe(breakdown?.totalSeconds)
                expect(prescription.durationMinutes).toBe(
                  Math.ceil((breakdown?.totalSeconds ?? 0) / 60),
                )
                expect(prescription.durationMinutes).toBeLessThanOrEqual(effectiveBudget)
                expect(breakdown?.warmupSeconds).toBeGreaterThan(0)
                expect(breakdown?.workSeconds).toBeGreaterThan(0)
                expect(breakdown?.equipmentSetupSeconds).toBeGreaterThan(0)
                expect(breakdown?.cooldownSeconds).toBeGreaterThan(0)
                expect(breakdown?.bufferSeconds).toBeGreaterThan(0)
                if (prescription.exercises.length > 1) {
                  expect(breakdown?.transitionSeconds).toBeGreaterThan(0)
                }
                for (const exercise of prescription.exercises) {
                  const source = full.exercises.find(
                    (item) => item.code === exercise.code,
                  )
                  expect(exercise.restSeconds).toBe(source?.restSeconds)
                  expect(exercise.targetRir ?? 0).toBeGreaterThanOrEqual(
                    source?.targetRir ?? 0,
                  )
                }

                if (effectiveBudget <= 10) {
                  expect(prescription.exercises.length).toBeGreaterThanOrEqual(2)
                }
                if (effectiveBudget === 20 && experience === 'BEGINNER') {
                  expect(prescription.exercises.length).toBeGreaterThanOrEqual(3)
                  const totalSets = prescription.exercises.reduce(
                    (sum, exercise) => sum + exercise.sets,
                    0,
                  )
                  expect(
                    totalSets,
                    JSON.stringify({
                      kind,
                      budget,
                      readiness,
                      goal,
                      equipment: equipmentProfile.id,
                      exercises: prescription.exercises.map((exercise) => ({
                        code: exercise.code,
                        sets: exercise.sets,
                        rest: exercise.restSeconds,
                      })),
                      breakdown,
                      reasons: prescription.timeAdjustmentReasonCodes,
                      full: full.exercises.map((exercise) => ({
                        code: exercise.code,
                        sets: exercise.sets,
                      })),
                      fullReasons: full.timeAdjustmentReasonCodes,
                    }),
                  ).toBeGreaterThanOrEqual(5)
                }
                if (effectiveBudget === 30) {
                  expect(prescription.exercises.length).toBeGreaterThanOrEqual(4)
                  expect(
                    prescription.exercises.reduce(
                      (sum, exercise) => sum + exercise.sets,
                      0,
                    ),
                  ).toBeLessThanOrEqual(10)
                }
                if (effectiveBudget >= 45) {
                  expect(prescription.exercises.length).toBeGreaterThanOrEqual(5)
                }
                if (effectiveBudget === 90) {
                  expect(prescription.durationMinutes).toBeLessThan(90)
                }
              }
            }
          }
        }
      }
    }
    expect(supported).toBe(2160)
  })

  it('sovittaa deterministisesti poistamalla apuliikkeen ja sarjoja ilman lepojen lyhentämistä', () => {
    const full = resolvedStrength({
      budget: 90,
      experience: 'ADVANCED',
      goal: 'MUSCLE_GAIN',
      equipment: [...equipmentProfiles.at(-1)!.equipment],
    })
    const fitted = fitStrengthPrescriptionToTimeBudget({
      prescription: full,
      timeBudgetMinutes: 30,
      initialReasonCodes: [STRENGTH_TIME_REASON_CODES.COMPACT_VARIANT],
    })
    expect(fitted.status).toBe('SUPPORTED')
    if (fitted.status !== 'SUPPORTED') throw new Error(fitted.reasonCode)
    expect(fitted.reasonCodes).toContain(STRENGTH_TIME_REASON_CODES.ACCESSORY_REMOVED)
    expect(fitted.reasonCodes).toContain(STRENGTH_TIME_REASON_CODES.ACCESSORY_SET_REDUCED)
    expect(
      fitted.reasonCodes.indexOf(STRENGTH_TIME_REASON_CODES.ACCESSORY_REMOVED),
    ).toBeLessThan(
      fitted.reasonCodes.indexOf(STRENGTH_TIME_REASON_CODES.ACCESSORY_SET_REDUCED),
    )
    for (const exercise of fitted.prescription.exercises) {
      expect(exercise.restSeconds).toBe(
        full.exercises.find((item) => item.code === exercise.code)?.restSeconds,
      )
    }
  })

  it('palauttaa eksplisiittisen eston, jos turvallinen vähimmäisannos ei mahdu', () => {
    const full = resolvedStrength({ budget: 45 })
    const result = fitStrengthPrescriptionToTimeBudget({
      prescription: full,
      timeBudgetMinutes: 1,
    })
    expect(result).toMatchObject({
      status: 'UNSUPPORTED',
      reasonCode: STRENGTH_TIME_REASON_CODES.MINIMUM_SAFE_DOSE_UNAVAILABLE,
    })
  })

  it('negatiiviset kontrollit havaitsevat puuttuvat aikaosat, lyhennetyn levon ja naamioidun keston', () => {
    const full = resolvedStrength({
      budget: 45,
      experience: 'INTERMEDIATE',
      equipment: [...equipmentProfiles.at(-1)!.equipment],
    })

    const zeroTransitionPolicy = {
      ...ADULT_STRENGTH_TIME_POLICY,
      transitionSeconds: 0,
    }
    const missingTransition = refreshStrengthPrescriptionTimeEstimate(
      full,
      zeroTransitionPolicy,
    )
    expect(
      auditStrengthPrescriptionTime(missingTransition, zeroTransitionPolicy).violations,
    ).toContain(STRENGTH_TIME_INVARIANT_CODES.TRANSITION_MISSING)

    const zeroSetupPolicy = {
      ...ADULT_STRENGTH_TIME_POLICY,
      equipmentSetupSeconds: Object.fromEntries(
        Object.keys(ADULT_STRENGTH_TIME_POLICY.equipmentSetupSeconds).map((key) => [
          key,
          0,
        ]),
      ) as typeof ADULT_STRENGTH_TIME_POLICY.equipmentSetupSeconds,
    }
    const missingSetup = refreshStrengthPrescriptionTimeEstimate(full, zeroSetupPolicy)
    expect(
      auditStrengthPrescriptionTime(missingSetup, zeroSetupPolicy).violations,
    ).toContain(STRENGTH_TIME_INVARIANT_CODES.EQUIPMENT_SETUP_MISSING)

    const staleSnapshot = {
      ...full,
      timeBreakdown: { ...full.timeBreakdown!, transitionSeconds: 0 },
    }
    expect(auditStrengthPrescriptionTime(staleSnapshot).violations).toContain(
      STRENGTH_TIME_INVARIANT_CODES.TIME_BREAKDOWN_STALE,
    )

    const shortenedExercises = full.exercises.map((exercise, index) =>
      index === 0
        ? {
            ...exercise,
            restSeconds: 30,
            dose:
              exercise.dose?.kind === 'STRENGTH_SETS'
                ? { ...exercise.dose, restSeconds: 30 }
                : exercise.dose,
          }
        : exercise,
    )
    const shortenedRest = refreshedTimeSnapshot({
      ...full,
      exercises: shortenedExercises,
      blocks: shortenedExercises,
    })
    expect(auditStrengthPrescriptionTime(shortenedRest).violations).toContain(
      STRENGTH_TIME_INVARIANT_CODES.REST_SHORTENED,
    )

    const oversizedExercises = full.exercises.map((exercise) => ({
      ...exercise,
      sets: 10,
      dose:
        exercise.dose?.kind === 'STRENGTH_SETS'
          ? { ...exercise.dose, sets: 10 }
          : exercise.dose,
    }))
    const oversized = refreshStrengthPrescriptionTimeEstimate({
      ...full,
      exercises: oversizedExercises,
      blocks: oversizedExercises,
    })
    expect(auditStrengthPrescriptionTime(oversized).violations).toContain(
      STRENGTH_TIME_INVARIANT_CODES.BUDGET_EXCEEDED,
    )
    const visibleOnlyMask = {
      ...oversized,
      durationMinutes: full.timeBudgetMinutes!,
    }
    expect(auditStrengthPrescriptionTime(visibleOnlyMask).violations).toEqual(
      expect.arrayContaining([
        STRENGTH_TIME_INVARIANT_CODES.BUDGET_EXCEEDED,
        STRENGTH_TIME_INVARIANT_CODES.DISPLAYED_DURATION_MISMATCH,
      ]),
    )
  })
})
