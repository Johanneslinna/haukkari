import { describe, expect, it } from 'vitest'
import {
  VERIFIED_NEXT_LOAD_POLICY_VERSION,
  decideInterSessionProgression,
  defaultResistanceLoadContextId,
  estimateAdultResistanceCapability,
  evaluateStrengthReturn,
  publishedExerciseCatalog,
  type AdultResistanceSetHistory,
  type StrengthTrainingBackground,
} from './index'

const exercise = publishedExerciseCatalog.getExercise('GOBLET_SQUAT')!
const loadContextId = defaultResistanceLoadContextId(exercise)!

function completedSession(
  sessionId: string,
  completedAt: string,
  options: { severeDomsDeload?: boolean; repetitions?: number } = {},
): AdultResistanceSetHistory[] {
  return [1, 2].map(() => ({
    sessionId,
    exerciseCode: exercise.code,
    exerciseVersion: exercise.version,
    movementPatterns: exercise.movementPatterns,
    primaryMuscles: exercise.primaryMuscles,
    secondaryMuscles: exercise.secondaryMuscles,
    loadKg: 20,
    loadType: 'DUMBBELL_KG_EACH',
    loadContextId,
    repetitions: options.repetitions ?? 10,
    rir: 3,
    completedAt,
    pain: false,
    techniqueOk: true,
    completionStatus: 'COMPLETED',
    doseCompleted: true,
    targetRirMin: 2,
    targetRirMax: 3,
    stopped: false,
    severeRecoveryProblem: false,
    difficultyTooHard: false,
    feltWorse: false,
    sessionRpeNineOrMore: false,
    severeDomsDeload: options.severeDomsDeload ?? false,
  }))
}

describe('voimakkaan DOMS:n progression jäädytys', () => {
  it('ei käytä DOMS-kevennettyä harjoitusta toisto- tai kuormaprogression näyttönä', () => {
    const history = [
      ...completedSession('normal-session', '2026-08-20T10:00:00.000Z'),
      ...completedSession('doms-session', '2026-08-27T10:00:00.000Z', {
        severeDomsDeload: true,
      }),
    ]
    const result = decideInterSessionProgression({
      comparableSessions: history,
      targetRir: [2, 3],
      verifiedNextLoads: [
        {
          exerciseCode: exercise.code,
          exerciseVersion: exercise.version,
          loadContextId,
          currentLoadKg: 20,
          nextAvailableLoadKg: 21,
          confirmedAt: '2026-08-27T11:00:00.000Z',
          policyVersion: VERIFIED_NEXT_LOAD_POLICY_VERSION,
        },
      ],
      targetExerciseCode: exercise.code,
      targetExerciseVersion: exercise.version,
      targetLoadType: 'DUMBBELL_KG_EACH',
      targetLoadContextId: loadContextId,
      maximumRepetitions: 10,
      generatedAt: '2026-08-28T10:00:00.000Z',
    })

    expect(result).toMatchObject({
      action: 'KEEP_LOAD',
      changedVariable: 'NONE',
      reasonCodes: ['SUCCESS_STREAK_BROKEN'],
      supportingSessionIds: ['doms-session'],
    })
  })

  it('ei käytä DOMS-kevennettyä harjoitusta capability-kalibrointiin', () => {
    const estimate = estimateAdultResistanceCapability(
      exercise,
      [
        ...completedSession('doms-one', '2026-08-20T10:00:00.000Z', {
          severeDomsDeload: true,
        }),
        ...completedSession('doms-two', '2026-08-27T10:00:00.000Z', {
          severeDomsDeload: true,
        }),
      ],
      '2026-08-28T10:00:00.000Z',
      'INTERMEDIATE',
    )

    expect(estimate).toMatchObject({
      calibrationRequired: true,
      supportingSessionCount: 0,
      supportingSessionIds: [],
    })
  })

  it('ei kasvata RETURNING-paluuharjoitusten laskuria', () => {
    const background: StrengthTrainingBackground = {
      regularTrainingAtLeast12Weeks: true,
      lastStrengthWorkoutAt: '2026-05-01T10:00:00.000Z',
      source: 'USER_CONFIRMED',
      confirmedAt: '2026-07-01T10:00:00.000Z',
      policyVersion: 'adult-strength-return-1.0.0',
    }
    const decision = evaluateStrengthReturn({
      history: completedSession('doms-return', '2026-08-20T10:00:00.000Z', {
        severeDomsDeload: true,
      }),
      background,
      generatedAt: '2026-08-21T10:00:00.000Z',
    })

    expect(decision).toMatchObject({
      state: 'RETURNING_56_PLUS_DAYS',
      approvedReturnWorkoutCount: 0,
      requiredApprovedWorkoutCount: 6,
    })
    expect(decision.reasonCodes).toContain('RETURN_SESSION_REJECTED_SEVERE_DOMS_DELOAD')
    expect(decision.reasonCodes).not.toContain('RETURN_SESSION_ACCEPTED')
  })
})
