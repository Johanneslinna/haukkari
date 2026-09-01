import { describe, expect, it } from 'vitest'
import type { LocalRecord } from '../../domain/sync/types'
import { strengthHistoryFromLogs } from './WorkoutHistory'
import {
  mayPrefillPreviousLoad,
  requestsNextLoadConfirmation,
} from './WorkoutProgressionUi'
import type { ExercisePrescription } from '../../domain/coaching'

function workoutLog(
  workoutId?: string,
  completed: boolean[] = [true, true],
  feedbackPatch: {
    difficulty?: 'TOO_EASY' | 'RIGHT' | 'TOO_HARD'
    felt?: 'WORSE' | 'SAME' | 'BETTER'
    sessionRpe?: number
  } = {},
  severeDomsDeload = false,
): LocalRecord {
  const timestamp = '2026-08-26T10:00:00.000Z'
  return {
    key: 'workout_logs-log-1',
    entityKey: 'workout_logs-log-1',
    id: 'log-1',
    userId: 'user-1',
    table: 'workout_logs',
    data: {
      id: 'log-1',
      user_id: 'user-1',
      workout_id: workoutId,
      performed_at: timestamp,
      feedback: {
        completionStatus: 'COMPLETED',
        sessionRpe: feedbackPatch.sessionRpe ?? 7,
        difficulty: feedbackPatch.difficulty ?? 'RIGHT',
        pain: 'NONE',
        painLocation: '',
        felt: feedbackPatch.felt ?? 'SAME',
        notes: '',
        exerciseResults: [
          {
            exerciseCode: 'GOBLET_SQUAT',
            exerciseVersion: '1.0.0',
            exerciseName: 'Maljakyykky',
            loadType: 'DUMBBELL_KG_EACH',
            loadContextId: 'adult-resistance-load-context-1.0.0:dumbbell-kg-each',
            loadIncrementKg: 2,
            completedSets: completed.filter(Boolean).length,
            plannedSets: 2,
            completed,
            repetitions: [8, 8],
            loads: ['20', '20'],
            rirs: [3, 3],
            painResponses: ['NONE', 'WORSENING'],
            techniqueOk: [true, false],
            targetRepetitions: '6–10',
            targetRpe: 7,
            targetRirRange: [3, 4],
          },
        ],
      },
      decision_trace: severeDomsDeload
        ? {
            ruleVersion: 'adult-resistance-rules-1.4.0',
            rules: [
              {
                ruleId: 'READINESS-SEVERE-DOMS-001',
                outcome: 'MODIFY',
              },
            ],
            adaptations: [
              {
                reasonCodes: ['SEVERE_DOMS_STRENGTH_DELOAD'],
              },
            ],
          }
        : {},
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
      version: 1,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    version: 1,
    syncState: 'SYNCED',
  }
}

describe('WorkoutPage.strengthHistoryFromLogs', () => {
  it('käyttää kaikille sarjoille tallennetun WorkoutRecordin todellista tunnistetta', () => {
    const history = strengthHistoryFromLogs([workoutLog('actual-workout-record-id')])

    expect(history).toHaveLength(2)
    expect(history.map((item) => item.sessionId)).toEqual([
      'actual-workout-record-id',
      'actual-workout-record-id',
    ])
    expect(history.every((item) => item.doseCompleted)).toBe(true)
    expect(history.every((item) => item.completionStatus === 'COMPLETED')).toBe(true)
    expect(history.map((item) => item.pain)).toEqual([false, true])
    expect(history.map((item) => item.techniqueOk)).toEqual([true, false])
    expect(history.every((item) => item.targetRirMin === 3)).toBe(true)
    expect(history.every((item) => item.targetRirMax === 4)).toBe(true)
    expect(history.every((item) => item.severeRecoveryProblem === false)).toBe(true)
  })

  it('ei keksi legacy-lokille harjoituskerran tunnistetta lokirivin id:stä', () => {
    expect(strengthHistoryFromLogs([workoutLog()]).map((item) => item.sessionId)).toEqual(
      [undefined, undefined],
    )
  })

  it('säilyttää kokonaan tekemättä jääneen annoksen progression katkaisevana rivinä', () => {
    expect(
      strengthHistoryFromLogs([workoutLog('failed-workout', [false, false])]),
    ).toEqual([
      expect.objectContaining({
        sessionId: 'failed-workout',
        repetitions: 0,
        doseCompleted: false,
      }),
    ])
  })

  it('säilyttää vakavan palautumisongelman täsmälliset syyt RETURNING-päätöstä varten', () => {
    const tooHard = strengthHistoryFromLogs([
      workoutLog('too-hard', [true, true], { difficulty: 'TOO_HARD' }),
    ])
    const worse = strengthHistoryFromLogs([
      workoutLog('worse', [true, true], { felt: 'WORSE' }),
    ])
    const highRpe = strengthHistoryFromLogs([
      workoutLog('high-rpe', [true, true], { sessionRpe: 9 }),
    ])

    expect(tooHard.every((row) => row.difficultyTooHard)).toBe(true)
    expect(worse.every((row) => row.feltWorse)).toBe(true)
    expect(highRpe.every((row) => row.sessionRpeNineOrMore)).toBe(true)
    expect(
      [...tooHard, ...worse, ...highRpe].every((row) => row.severeRecoveryProblem),
    ).toBe(true)
  })

  it('säilyttää synkronoidusta decision tracesta DOMS-progression eston', () => {
    const history = strengthHistoryFromLogs([
      workoutLog('doms-workout', [true, true], {}, true),
    ])

    expect(history).toHaveLength(2)
    expect(history.every((row) => row.severeDomsDeload === true)).toBe(true)
  })
})

describe('WorkoutPage.next load confirmation visibility', () => {
  const exercise = {
    id: 'goblet',
    code: 'GOBLET_SQUAT',
    contentVersion: '1.0.0',
    nameFi: 'Maljakyykky',
    category: 'SQUAT',
    equipment: ['Käsipainot'],
    instructionsFi: 'Ohje',
    sets: 2,
    repetitions: '8–12',
    restSeconds: 60,
    targetRpe: 7,
    loadGuidance: 'Säilytä kuorma.',
    stopCondition: 'Lopeta tarvittaessa.',
    substitutions: [],
    loadType: 'DUMBBELL_KG_EACH',
    loadLabelFi: 'Kuorma kg / käsipaino',
    loadContextId: 'adult-resistance-load-context-1.0.0:dumbbell-kg-each',
    keyExercise: true,
    progressionDecision: {
      action: 'KEEP_LOAD',
      currentLoadKg: 20,
      nextLoadKg: 20,
      changedVariable: 'NONE',
      reasonCodes: ['NEXT_AVAILABLE_LOAD_NOT_CONFIRMED'],
      supportingSessionIds: ['one', 'two'],
    },
  } satisfies ExercisePrescription

  it('näyttää kysymyksen vain vertailukelpoiselle kilogrammakuormalle', () => {
    expect(requestsNextLoadConfirmation(exercise)).toBe(true)
    expect(
      requestsNextLoadConfirmation({
        ...exercise,
        loadType: 'BODYWEIGHT',
        loadContextId: undefined,
      }),
    ).toBe(false)
    expect(
      requestsNextLoadConfirmation({
        ...exercise,
        loadType: 'BAND',
        loadContextId: undefined,
      }),
    ).toBe(false)
  })

  it('ei näytä kysymystä koneelle ilman käyttäjän tunnistamaa laitekontekstia', () => {
    expect(
      requestsNextLoadConfirmation({
        ...exercise,
        loadType: 'MACHINE_KG',
        loadContextId: 'legacy-generic-machine-context',
      }),
    ).toBe(false)
  })

  it('ei esitä ennen taukoa käytettyä kilogrammaa uuden paluuharjoituksen kenttään', () => {
    expect(
      mayPrefillPreviousLoad({
        ...exercise,
        progressionDecision: {
          ...exercise.progressionDecision,
          action: 'RECALIBRATE_LOAD',
          reasonCodes: [
            'OLD_LOAD_HISTORY_DISPLAY_ONLY',
            'PRE_BREAK_LOAD_AUTHORITY_REVOKED',
          ],
        },
      }),
    ).toBe(false)
    expect(mayPrefillPreviousLoad(exercise)).toBe(true)
  })
})
