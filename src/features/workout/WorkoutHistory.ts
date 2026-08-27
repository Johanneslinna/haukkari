import type { AdultResistanceSetHistory, WorkoutFeedback } from '../../domain/coaching'
import type { LocalRecord } from '../../domain/sync/types'
import { objectValue, stringValue } from '../coaching/coachingData'

function savedFeedback(record: LocalRecord) {
  const value = objectValue(record.data.feedback)
  return typeof value.sessionRpe === 'number'
    ? (value as unknown as WorkoutFeedback)
    : null
}

export function strengthHistoryFromLogs(
  records: LocalRecord[],
): AdultResistanceSetHistory[] {
  return records.flatMap((record) => {
    const feedback = savedFeedback(record)
    if (!feedback?.exerciseResults) return []
    const completedAt = stringValue(record.data.performed_at, record.createdAt)
    const sessionId = stringValue(record.data.workout_id) || undefined
    return feedback.exerciseResults.flatMap((result) => {
      const rows = result.repetitions.flatMap((repetitions, index) => {
        const completed = result.completed?.[index] ?? index < result.completedSets
        if (!completed) return []
        const load = result.loads[index]
        const loadKg = load ? Number(load.replace(',', '.')) : Number.NaN
        return [
          {
            sessionId,
            exerciseCode: result.exerciseCode,
            exerciseVersion: result.exerciseVersion,
            primaryMuscles: result.primaryMuscles,
            secondaryMuscles: result.secondaryMuscles,
            loadKg: Number.isFinite(loadKg) && loadKg > 0 ? loadKg : null,
            loadType: result.loadType,
            loadContextId: result.loadContextId,
            loadIncrementKg: result.loadIncrementKg,
            repetitions: repetitions ?? 0,
            rir: result.rirs?.[index] ?? null,
            completedAt,
            pain:
              feedback.pain !== 'NONE' ||
              (result.painResponses?.[index] !== undefined &&
                result.painResponses[index] !== null &&
                result.painResponses[index] !== 'NONE'),
            techniqueOk:
              result.techniqueOk?.[index] ?? feedback.stopReason !== 'TECHNIQUE',
            completionStatus: feedback.completionStatus,
            doseCompleted: result.completedSets >= result.plannedSets,
            targetRirMin: result.targetRirRange?.[0],
            targetRirMax: result.targetRirRange?.[1],
            stopped:
              feedback.completionStatus === 'STOPPED' || Boolean(feedback.stopReason),
            severeRecoveryProblem:
              feedback.difficulty === 'TOO_HARD' ||
              feedback.felt === 'WORSE' ||
              feedback.sessionRpe >= 9,
            difficultyTooHard: feedback.difficulty === 'TOO_HARD',
            feltWorse: feedback.felt === 'WORSE',
            sessionRpeNineOrMore: feedback.sessionRpe >= 9,
          },
        ]
      })
      if (rows.length > 0 || result.plannedSets <= 0) return rows
      // Kokonaan tekemättä jäänyt määrätty liike pitää epäonnistuneen annoksen
      // näkyvänä, jotta se katkaisee progression onnistumisjakson.
      return [
        {
          sessionId,
          exerciseCode: result.exerciseCode,
          exerciseVersion: result.exerciseVersion,
          primaryMuscles: result.primaryMuscles,
          secondaryMuscles: result.secondaryMuscles,
          loadKg: null,
          loadType: result.loadType,
          loadContextId: result.loadContextId,
          loadIncrementKg: result.loadIncrementKg,
          repetitions: 0,
          rir: null,
          completedAt,
          pain: feedback.pain !== 'NONE',
          techniqueOk: feedback.stopReason !== 'TECHNIQUE',
          completionStatus: feedback.completionStatus,
          doseCompleted: false,
          targetRirMin: result.targetRirRange?.[0],
          targetRirMax: result.targetRirRange?.[1],
          stopped:
            feedback.completionStatus === 'STOPPED' || Boolean(feedback.stopReason),
          severeRecoveryProblem:
            feedback.difficulty === 'TOO_HARD' ||
            feedback.felt === 'WORSE' ||
            feedback.sessionRpe >= 9,
          difficultyTooHard: feedback.difficulty === 'TOO_HARD',
          feltWorse: feedback.felt === 'WORSE',
          sessionRpeNineOrMore: feedback.sessionRpe >= 9,
        },
      ]
    })
  })
}
