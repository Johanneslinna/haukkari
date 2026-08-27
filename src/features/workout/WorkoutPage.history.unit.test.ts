import { describe, expect, it } from 'vitest'
import type { LocalRecord } from '../../domain/sync/types'
import { strengthHistoryFromLogs } from './WorkoutHistory'

function workoutLog(
  workoutId?: string,
  completed: boolean[] = [true, true],
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
        sessionRpe: 7,
        difficulty: 'RIGHT',
        pain: 'NONE',
        painLocation: '',
        felt: 'SAME',
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
          },
        ],
      },
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
})
