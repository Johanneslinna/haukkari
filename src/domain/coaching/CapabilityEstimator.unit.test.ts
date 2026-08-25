import { describe, expect, it } from 'vitest'
import { estimateExerciseCapability } from './CapabilityEstimator'
import type { WorkoutExerciseResult } from './types'

function result(
  loads: Array<string | null>,
  repetitions: Array<number | null>,
): WorkoutExerciseResult {
  return {
    exerciseCode: 'GOBLET_SQUAT',
    exerciseName: 'Maljakyykky',
    loadType: 'EXTERNAL_KG',
    completedSets: loads.length,
    plannedSets: loads.length,
    repetitions,
    loads,
    targetRpe: 7,
  }
}

describe('CapabilityEstimator', () => {
  it('pyytää kalibroimaan, kun vertailukelpoista kuormahistoriaa ei ole', () => {
    const estimate = estimateExerciseCapability([], 'GOBLET_SQUAT')
    expect(estimate.confidence).toBe('LOW')
    expect(estimate.suggestedLoad).toBeNull()
    expect(estimate.calibrationRequired).toBe(true)
  })

  it('arvioi kuorman ja e1RM:n toteutuneista vertailukelpoisista sarjoista', () => {
    const estimate = estimateExerciseCapability(
      [result(['20', '20', '22,5'], [10, 10, 8])],
      'GOBLET_SQUAT',
    )
    expect(estimate.confidence).toBe('MODERATE')
    expect(estimate.suggestedLoad).toBe('22,5')
    expect(estimate.estimatedOneRepMaxKg).toBe(28.5)
  })
})
