import { describe, expect, it } from 'vitest'
import {
  resolvePrescription,
  type PrescribedSession,
  type WorkoutVariant,
} from '../../domain/coaching'
import type { JsonObject, LocalRecord, SyncableTable } from '../../domain/sync/types'
import {
  authorizeWorkoutPrescriptionForCurrentAthlete,
  adaptWorkoutPrescriptionForCurrentAthlete,
  currentWorkoutSafetyContext,
  effectiveSessionKindForCurrentPlan,
  shouldReevaluateStoredSafetyBlock,
  shouldReevaluateStoredSafetyReasonCode,
} from './WorkoutPrescriptionAdapter'

const userId = '00000000-0000-4000-8000-000000000001'
const today = '2026-08-27'
const fullVariant: WorkoutVariant = {
  kind: 'FULL',
  durationMinutes: 45,
  volumeMultiplier: 1,
}

function record(table: SyncableTable, id: string, data: JsonObject): LocalRecord {
  const timestamp = `${today}T08:00:00.000Z`
  return {
    key: `${table}-${id}`,
    entityKey: `${table}-${id}`,
    id,
    userId,
    table,
    data: {
      id,
      user_id: userId,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
      version: 1,
      ...data,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    version: 1,
    syncState: 'SYNCED',
  }
}

function profile(birthDate: string) {
  return record('profiles', crypto.randomUUID(), { birth_date: birthDate })
}

function screening(answers: JsonObject = {}) {
  return record('health_screenings', crypto.randomUUID(), {
    status: 'CLEAR',
    answers,
  })
}

function strengthPrescription(): PrescribedSession {
  const result = resolvePrescription({
    sessionId: 'ui-adaptation-route',
    title: 'Käyttöliittymän mukautusreitti',
    kind: 'STRENGTH',
    durationMinutes: 45,
    profile: {
      goal: 'GENERAL_FITNESS',
      experience: 'BEGINNER',
      equipment: ['Kehonpaino'],
      physicalLoad: 'MODERATE',
      minutesPerSession: 45,
      age: 35,
      readiness: 'GREEN',
      healthBlocked: false,
      generatedAt: `${today}T08:00:00.000Z`,
    },
  })
  if (result.status !== 'SUPPORTED') throw new Error(result.reasonCode)
  return result.prescription
}

function fiveSetStrengthPrescription() {
  const prescription = strengthPrescription()
  const source = prescription.exercises[0]!
  const exercise = {
    ...source,
    sets: 5,
    dose:
      source.dose?.kind === 'STRENGTH_SETS' ? { ...source.dose, sets: 5 } : source.dose,
  }
  return { ...prescription, exercises: [exercise], blocks: [exercise] }
}

describe('effectiveSessionKindForCurrentPlan', () => {
  it('avaa nykyisen suunnitelman harjoituksen vanhentuneen kuntotarkistustyypin sijaan', () => {
    expect(
      effectiveSessionKindForCurrentPlan({
        currentSessionKind: 'STRENGTH',
        checkedSessionKind: 'SPORT',
        allowedSessionKind: 'SPORT',
      }),
    ).toBe('STRENGTH')
  })

  it('säilyttää kuntotarkistuksen tekemän turvallisuusmuutoksen', () => {
    expect(
      effectiveSessionKindForCurrentPlan({
        currentSessionKind: 'STRENGTH',
        checkedSessionKind: 'SPORT',
        allowedSessionKind: 'RECOVERY',
      }),
    ).toBe('RECOVERY')
    expect(
      effectiveSessionKindForCurrentPlan({
        currentSessionKind: 'STRENGTH',
        checkedSessionKind: 'SPORT',
        allowedSessionKind: 'REST',
      }),
    ).toBe('REST')
  })
})

describe('shouldReevaluateStoredSafetyBlock', () => {
  it('tunnistaa saman eston myös viikkoyhteenvedon syykoodista', () => {
    expect(shouldReevaluateStoredSafetyReasonCode('SAFETY_INFORMATION_INCOMPLETE')).toBe(
      true,
    )
    expect(shouldReevaluateStoredSafetyReasonCode('WEEKLY_VOLUME_TARGET')).toBe(false)
  })

  it('arvioi vanhan puuttuvien turvallisuustietojen eston uudelleen', () => {
    expect(
      shouldReevaluateStoredSafetyBlock({
        status: 'UNSUPPORTED',
        sessionKind: 'STRENGTH',
        reasonCode: 'SAFETY_INFORMATION_INCOMPLETE',
        userMessage: 'Vanhentunut esto',
      }),
    ).toBe(true)
  })

  it('säilyttää harjoitussisältöön liittyvän eston', () => {
    expect(
      shouldReevaluateStoredSafetyBlock({
        status: 'UNSUPPORTED',
        sessionKind: 'SPORT',
        reasonCode: 'SPORT_ENGINE_NOT_REVIEWED',
        userMessage: 'Lajimoottori puuttuu',
      }),
    ).toBe(false)
  })
})

describe('WorkoutPrescriptionAdapter – käyttöliittymän nykyhetken turvallisuustiedot', () => {
  it('tulkitsee valmiin kartoituksen ilman vapaaehtoisia terveystietoja vahvistetuksi terveeksi lähtötilaksi', () => {
    const completedProfile = record('profiles', crypto.randomUUID(), {
      birth_date: '1991-01-01',
      onboarding_completed: true,
    })

    expect(
      currentWorkoutSafetyContext({
        profile: completedProfile,
        screening: null,
        readiness: 'GREEN',
        today,
      }),
    ).toEqual({
      age: 35,
      readiness: 'GREEN',
      healthBlocked: false,
      safetyInformationComplete: true,
    })

    expect(
      adaptWorkoutPrescriptionForCurrentAthlete({
        prescription: strengthPrescription(),
        variant: fullVariant,
        profile: completedProfile,
        screening: null,
        readiness: 'GREEN',
        today,
      }),
    ).toMatchObject({ status: 'SUPPORTED' })
  })

  it('välittää nykyisen iän, readinessin ja seulonnan varsinaiselle adaptPrescription-reitille', () => {
    const currentProfile = profile('1961-08-27')
    const currentScreening = screening()

    expect(
      currentWorkoutSafetyContext({
        profile: currentProfile,
        screening: currentScreening,
        readiness: 'GREEN',
        today,
      }),
    ).toEqual({
      age: 65,
      readiness: 'GREEN',
      healthBlocked: false,
      safetyInformationComplete: true,
    })
    expect(
      adaptWorkoutPrescriptionForCurrentAthlete({
        prescription: strengthPrescription(),
        variant: fullVariant,
        profile: currentProfile,
        screening: currentScreening,
        readiness: 'GREEN',
        today,
      }),
    ).toMatchObject({
      status: 'UNSUPPORTED',
      reasonCode: 'OLDER_ADULT_ENGINE_NOT_AVAILABLE',
    })
  })

  it('välittää voimakkaan DOMS:n reason coden käyttöliittymästä varsinaiselle annossovitukselle', () => {
    const prescription = strengthPrescription()
    const originalSets = prescription.exercises.reduce(
      (sum, exercise) => sum + exercise.sets,
      0,
    )
    const result = adaptWorkoutPrescriptionForCurrentAthlete({
      prescription,
      variant: fullVariant,
      profile: profile('1991-01-01'),
      screening: screening(),
      readiness: 'YELLOW',
      readinessReasonCodes: ['SEVERE_DOMS_STRENGTH_DELOAD'],
      today,
    })

    expect(result.status).toBe('SUPPORTED')
    if (result.status !== 'SUPPORTED') throw new Error(result.reasonCode)
    expect(
      result.prescription.exercises.reduce((sum, exercise) => sum + exercise.sets, 0),
    ).toBe(Math.ceil(originalSets * 0.5))
    expect(result.prescription.decisionTrace.rules.map((rule) => rule.ruleId)).toContain(
      'READINESS-SEVERE-DOMS-001',
    )
  })

  it('uudelleenvaltuuttaa aiemmin tallennetun täyden harjoituksen DOMS-kevennykseen vain kerran', () => {
    const prescription = strengthPrescription()
    const originalSets = prescription.exercises.reduce(
      (sum, exercise) => sum + exercise.sets,
      0,
    )
    const input = {
      profile: profile('1991-01-01'),
      screening: screening(),
      readiness: 'YELLOW',
      readinessReasonCodes: ['SEVERE_DOMS_STRENGTH_DELOAD'],
      today,
    }
    const firstAuthorization = authorizeWorkoutPrescriptionForCurrentAthlete({
      ...input,
      prescription,
    })

    expect(firstAuthorization.status).toBe('SUPPORTED')
    if (firstAuthorization.status !== 'SUPPORTED') {
      throw new Error(firstAuthorization.reasonCode)
    }
    const adaptedSets = firstAuthorization.prescription.exercises.reduce(
      (sum, exercise) => sum + exercise.sets,
      0,
    )
    expect(adaptedSets).toBe(Math.ceil(originalSets * 0.5))

    const secondAuthorization = authorizeWorkoutPrescriptionForCurrentAthlete({
      ...input,
      prescription: firstAuthorization.prescription,
    })
    expect(secondAuthorization.status).toBe('SUPPORTED')
    if (secondAuthorization.status !== 'SUPPORTED') {
      throw new Error(secondAuthorization.reasonCode)
    }
    expect(
      secondAuthorization.prescription.exercises.reduce(
        (sum, exercise) => sum + exercise.sets,
        0,
      ),
    ).toBe(adaptedSets)
  })

  it('säilyttää käynnissä olevan harjoituksen tehdyt sarjat ja vähentää vain jäljellä olevaa työtä', () => {
    const prescription = fiveSetStrengthPrescription()
    const exerciseId = prescription.exercises[0]!.id
    const result = authorizeWorkoutPrescriptionForCurrentAthlete({
      prescription,
      profile: profile('1991-01-01'),
      screening: screening(),
      readiness: 'YELLOW',
      readinessReasonCodes: ['SEVERE_DOMS_STRENGTH_DELOAD'],
      completedUnitsByExerciseId: { [exerciseId]: 2 },
      today,
    })

    expect(result.status).toBe('SUPPORTED')
    if (result.status !== 'SUPPORTED') throw new Error(result.reasonCode)
    expect(result.prescription.exercises[0]?.sets).toBe(3)
    expect(result.prescription.decisionTrace.adaptations).toContainEqual({
      original: { workingSetCount: 5 },
      adjusted: expect.objectContaining({
        workingSetCount: 3,
        completedWorkingSetCount: 2,
        remainingWorkingSetCount: 1,
      }),
      reasonCodes: [
        'SEVERE_DOMS_STRENGTH_DELOAD',
        'SEVERE_DOMS_STRENGTH_PROGRESSION_FROZEN',
      ],
    })
  })

  it('ei poista historiaa tai vaadi lisäsarjoja, kun tehty määrä jo ylittää uuden tavoitteen', () => {
    const prescription = fiveSetStrengthPrescription()
    const exerciseId = prescription.exercises[0]!.id
    const input = {
      profile: profile('1991-01-01'),
      screening: screening(),
      readiness: 'YELLOW',
      readinessReasonCodes: ['SEVERE_DOMS_STRENGTH_DELOAD'],
      completedUnitsByExerciseId: { [exerciseId]: 4 },
      today,
    }
    const first = authorizeWorkoutPrescriptionForCurrentAthlete({
      ...input,
      prescription,
    })

    expect(first.status).toBe('SUPPORTED')
    if (first.status !== 'SUPPORTED') throw new Error(first.reasonCode)
    expect(first.prescription.exercises[0]?.sets).toBe(4)
    expect(first.prescription.decisionTrace.adaptations).toContainEqual({
      original: { workingSetCount: 5 },
      adjusted: expect.objectContaining({
        workingSetCount: 4,
        completedWorkingSetCount: 4,
        remainingWorkingSetCount: 0,
      }),
      reasonCodes: expect.any(Array),
    })

    const reloaded = authorizeWorkoutPrescriptionForCurrentAthlete({
      ...input,
      prescription: first.prescription,
    })
    expect(reloaded.status).toBe('SUPPORTED')
    if (reloaded.status !== 'SUPPORTED') throw new Error(reloaded.reasonCode)
    expect(reloaded.prescription.exercises[0]?.sets).toBe(4)
    expect(
      reloaded.prescription.decisionTrace.rules.filter(
        (rule) => rule.ruleId === 'READINESS-SEVERE-DOMS-001',
      ),
    ).toHaveLength(1)
  })

  it('sallii vielä 64-vuotiaan mutta ei päättele puuttuvia tietoja snapshotista', () => {
    const prescription = strengthPrescription()
    expect(
      adaptWorkoutPrescriptionForCurrentAthlete({
        prescription,
        variant: fullVariant,
        profile: profile('1961-08-28'),
        screening: screening(),
        readiness: 'GREEN',
        today,
      }),
    ).toMatchObject({ status: 'SUPPORTED', prescription: { kind: 'STRENGTH' } })
    expect(
      adaptWorkoutPrescriptionForCurrentAthlete({
        prescription,
        variant: fullVariant,
        profile: null,
        screening: null,
        readiness: undefined,
        today,
      }),
    ).toMatchObject({
      status: 'UNSUPPORTED',
      reasonCode: 'SAFETY_INFORMATION_INCOMPLETE',
    })
  })

  it('estää vahvistamattoman legacy-rajoitetekstin myös käyttöliittymäpolussa', () => {
    expect(
      adaptWorkoutPrescriptionForCurrentAthlete({
        prescription: strengthPrescription(),
        variant: fullVariant,
        profile: profile('1991-01-01'),
        screening: screening({
          current_injuries_surgeries_and_mobility_limits: 'Vanha vapaatekstirajoite',
          confirmed_limitation_tags: [],
        }),
        readiness: 'GREEN',
        today,
      }),
    ).toMatchObject({
      status: 'UNSUPPORTED',
      reasonCode: 'SAFETY_INFORMATION_INCOMPLETE',
    })
  })

  it('ei tulkitse vanhaa ei-rajoitteita-vastausta liikerajoitteeksi', () => {
    const currentProfile = record('profiles', crypto.randomUUID(), {
      birth_date: '1991-01-01',
      onboarding_completed: true,
    })

    expect(
      adaptWorkoutPrescriptionForCurrentAthlete({
        prescription: strengthPrescription(),
        variant: fullVariant,
        profile: currentProfile,
        screening: screening({
          doctor_restrictions: 'Ei ole',
          current_injuries_surgeries_and_mobility_limits: 'Ei mitään',
          confirmed_limitation_tags: [],
        }),
        readiness: 'GREEN',
        today,
      }),
    ).toMatchObject({ status: 'SUPPORTED' })
  })

  it('arvioi jatkettavan legacy-snapshotin nykyisellä aikapolitiikalla eikä keksi puuttuvaa annosta', () => {
    const current = strengthPrescription()
    const legacy = {
      ...current,
      schemaVersion: undefined,
      timePolicyVersion: undefined,
      timeBreakdown: undefined,
      calculatedTotalSeconds: undefined,
      blocks: undefined,
      durationMinutes: 45,
      exercises: current.exercises.map(({ dose: _dose, ...exercise }) => exercise),
    }
    const authorized = authorizeWorkoutPrescriptionForCurrentAthlete({
      prescription: legacy,
      profile: profile('1991-01-01'),
      screening: screening(),
      readiness: 'GREEN',
      today,
    })
    expect(authorized.status).toBe('SUPPORTED')
    if (authorized.status !== 'SUPPORTED') throw new Error(authorized.reasonCode)
    expect(authorized.prescription.timePolicyVersion).toBe('adult-strength-time-1.1.0')
    expect(authorized.prescription.timeAdjustmentReasonCodes).toContain(
      'TIME_LEGACY_REAUTHORIZED',
    )
    expect(authorized.prescription.durationMinutes).toBe(
      Math.ceil(authorized.prescription.timeBreakdown!.totalSeconds / 60),
    )

    const incompleteLegacy = {
      ...legacy,
      exercises: legacy.exercises.map((exercise, index) =>
        index === 0 ? { ...exercise, loadType: undefined } : exercise,
      ),
    } as unknown as PrescribedSession
    expect(
      authorizeWorkoutPrescriptionForCurrentAthlete({
        prescription: incompleteLegacy,
        profile: profile('1991-01-01'),
        screening: screening(),
        readiness: 'GREEN',
        today,
      }),
    ).toMatchObject({
      status: 'UNSUPPORTED',
      reasonCode: 'NO_SAFE_STRENGTH_DOSE_AVAILABLE',
    })
  })
})
