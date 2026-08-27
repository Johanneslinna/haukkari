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

describe('WorkoutPrescriptionAdapter – käyttöliittymän nykyhetken turvallisuustiedot', () => {
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
    expect(authorized.prescription.timePolicyVersion).toBe('adult-strength-time-1.0.0')
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
