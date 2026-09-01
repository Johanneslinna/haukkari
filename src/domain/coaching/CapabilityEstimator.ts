import type { WorkoutExerciseResult } from './types'

export type ExerciseCapabilityEstimate = {
  confidence: 'LOW' | 'MODERATE' | 'HIGH'
  suggestedLoad: string | null
  estimatedOneRepMaxKg: number | null
  calibrationRequired: boolean
  comparableSets: number
}

function numericLoad(value: string | null) {
  if (!value) return null
  const parsed = Number(value.replace(',', '.').replace(/[^0-9.-]/gu, ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function estimateExerciseCapability(
  history: WorkoutExerciseResult[],
  exerciseCode: string,
): ExerciseCapabilityEstimate {
  const comparable = history
    .filter((result) => result.exerciseCode === exerciseCode)
    .flatMap((result) =>
      result.loads.flatMap((load, index) => {
        const kilograms = numericLoad(load)
        const repetitions = result.repetitions[index]
        if (kilograms === null || repetitions === null || repetitions <= 0) return []
        const rir = result.rirs?.[index]
        return [
          {
            kilograms,
            repetitions,
            rir: typeof rir === 'number' ? rir : null,
          },
        ]
      }),
    )
  const latest = comparable.at(-1)
  const rirSupported = comparable.filter((set) => set.rir !== null)
  const confidence =
    rirSupported.length >= 6 ? 'HIGH' : rirSupported.length >= 2 ? 'MODERATE' : 'LOW'
  return {
    confidence,
    suggestedLoad: latest ? String(latest.kilograms).replace('.', ',') : null,
    estimatedOneRepMaxKg: latest
      ? Math.round(
          latest.kilograms * (1 + (latest.repetitions + (latest.rir ?? 0)) / 30) * 10,
        ) / 10
      : null,
    calibrationRequired: rirSupported.length < 2,
    comparableSets: comparable.length,
  }
}

export const CapabilityEstimator = { estimate: estimateExerciseCapability }
