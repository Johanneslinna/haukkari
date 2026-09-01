import type { ExercisePrescription, StrengthExerciseProgrammingRole } from './types'
import type { ExerciseCatalog, ExerciseDefinition } from './content/TrainingContent'

export const STRENGTH_VOLUME_POLICY_VERSION = 'strength-volume-policy-1.0.0'
export const MAX_ROLLING_MUSCLE_SETS = 16
export const MAX_SESSION_PRIMARY_MUSCLE_SETS = 6
export const PRIMARY_MUSCLE_SET_WEIGHT = 1
export const SECONDARY_MUSCLE_SET_WEIGHT = 0.5

export type VersionedStrengthSet = {
  exerciseCode: string
  exerciseVersion?: string
  completedAt: string
  primaryMuscles?: readonly string[]
  secondaryMuscles?: readonly string[]
  pain?: boolean
  techniqueOk?: boolean
}

export type MuscleVolume = Record<string, number>

function programmingVolumeMuscles(input: {
  primaryMuscles: readonly string[]
  secondaryMuscles: readonly string[]
  programmingRole?: StrengthExerciseProgrammingRole
}) {
  if (input.programmingRole !== 'CORE_CONTROL') {
    return { primary: input.primaryMuscles, secondary: input.secondaryMuscles }
  }
  const primary = input.primaryMuscles.filter((muscle) => muscle === 'trunk')
  const secondary = [
    ...new Set([
      ...input.secondaryMuscles,
      ...input.primaryMuscles.filter((muscle) => muscle !== 'trunk'),
    ]),
  ]
  return { primary, secondary }
}

export function mergeMuscleVolume(
  ...volumes: readonly Readonly<MuscleVolume>[]
): MuscleVolume {
  const result: MuscleVolume = {}
  for (const volume of volumes) {
    for (const [muscle, amount] of Object.entries(volume)) add(result, muscle, amount)
  }
  return result
}

/**
 * Laskee suunnitellut sarjat samoilla 1,0/0,5-painoilla kuin toteutuneen
 * seitsemän vuorokauden historian. Tämä on viikkosuunnittelun ainoa
 * suunnitellun lihasvolyymin laskuri.
 */
export function calculatePlannedMuscleVolume(
  exercises: readonly Pick<
    ExercisePrescription,
    'sets' | 'primaryMuscles' | 'secondaryMuscles' | 'programmingRole'
  >[],
): MuscleVolume {
  const volume: MuscleVolume = {}
  for (const exercise of exercises) {
    const muscles = programmingVolumeMuscles({
      primaryMuscles: exercise.primaryMuscles ?? [],
      secondaryMuscles: exercise.secondaryMuscles ?? [],
      programmingRole: exercise.programmingRole,
    })
    for (const muscle of muscles.primary) {
      add(volume, muscle, exercise.sets * PRIMARY_MUSCLE_SET_WEIGHT)
    }
    for (const muscle of muscles.secondary) {
      add(volume, muscle, exercise.sets * SECONDARY_MUSCLE_SET_WEIGHT)
    }
  }
  return volume
}

export function calculateSessionPrimaryMuscleVolume(
  exercises: readonly Pick<
    ExercisePrescription,
    'sets' | 'primaryMuscles' | 'secondaryMuscles' | 'programmingRole'
  >[],
): MuscleVolume {
  const volume: MuscleVolume = {}
  for (const exercise of exercises) {
    const muscles = programmingVolumeMuscles({
      primaryMuscles: exercise.primaryMuscles ?? [],
      secondaryMuscles: exercise.secondaryMuscles ?? [],
      programmingRole: exercise.programmingRole,
    })
    for (const muscle of muscles.primary) {
      add(volume, muscle, exercise.sets * PRIMARY_MUSCLE_SET_WEIGHT)
    }
  }
  return volume
}

function add(volume: MuscleVolume, muscle: string, amount: number) {
  volume[muscle] = (volume[muscle] ?? 0) + amount
}

function resolveMuscles(
  set: VersionedStrengthSet,
  catalog: ExerciseCatalog,
): { primary: readonly string[]; secondary: readonly string[] } | null {
  if (set.primaryMuscles || set.secondaryMuscles) {
    return {
      primary: set.primaryMuscles ?? [],
      secondary: set.secondaryMuscles ?? [],
    }
  }
  const exercise = catalog.getExercise(set.exerciseCode)
  if (!exercise) return null
  if (set.exerciseVersion && set.exerciseVersion !== exercise.version) return null
  return { primary: exercise.primaryMuscles, secondary: exercise.secondaryMuscles }
}

export function calculateRollingMuscleVolume(input: {
  sets: readonly VersionedStrengthSet[]
  at: string
  catalog: ExerciseCatalog
}): MuscleVolume {
  const atMs = Date.parse(input.at)
  const sevenDaysMs = 7 * 86_400_000
  const volume: MuscleVolume = {}
  for (const set of input.sets) {
    const ageMs = atMs - Date.parse(set.completedAt)
    if (
      !Number.isFinite(ageMs) ||
      ageMs < 0 ||
      ageMs > sevenDaysMs ||
      set.pain ||
      set.techniqueOk === false
    ) {
      continue
    }
    const muscles = resolveMuscles(set, input.catalog)
    if (!muscles) continue
    for (const muscle of muscles.primary) add(volume, muscle, PRIMARY_MUSCLE_SET_WEIGHT)
    for (const muscle of muscles.secondary)
      add(volume, muscle, SECONDARY_MUSCLE_SET_WEIGHT)
  }
  return volume
}

export function maximumAdditionalSets(input: {
  exercise: ExerciseDefinition
  rollingVolume: Readonly<MuscleVolume>
  sessionPrimaryVolume: Readonly<MuscleVolume>
  programmingRole?: StrengthExerciseProgrammingRole
}): number {
  let allowed = Number.POSITIVE_INFINITY
  const muscles = programmingVolumeMuscles({
    primaryMuscles: input.exercise.primaryMuscles,
    secondaryMuscles: input.exercise.secondaryMuscles,
    programmingRole: input.programmingRole,
  })
  for (const muscle of muscles.primary) {
    allowed = Math.min(
      allowed,
      Math.floor(
        (MAX_ROLLING_MUSCLE_SETS - (input.rollingVolume[muscle] ?? 0)) /
          PRIMARY_MUSCLE_SET_WEIGHT,
      ),
      Math.floor(
        (MAX_SESSION_PRIMARY_MUSCLE_SETS - (input.sessionPrimaryVolume[muscle] ?? 0)) /
          PRIMARY_MUSCLE_SET_WEIGHT,
      ),
    )
  }
  for (const muscle of muscles.secondary) {
    allowed = Math.min(
      allowed,
      Math.floor(
        (MAX_ROLLING_MUSCLE_SETS - (input.rollingVolume[muscle] ?? 0)) /
          SECONDARY_MUSCLE_SET_WEIGHT,
      ),
    )
  }
  return Math.max(0, Number.isFinite(allowed) ? allowed : 0)
}

export function addPlannedSets(input: {
  exercise: ExerciseDefinition
  sets: number
  rollingVolume: MuscleVolume
  sessionPrimaryVolume: MuscleVolume
  programmingRole?: StrengthExerciseProgrammingRole
}) {
  const muscles = programmingVolumeMuscles({
    primaryMuscles: input.exercise.primaryMuscles,
    secondaryMuscles: input.exercise.secondaryMuscles,
    programmingRole: input.programmingRole,
  })
  for (const muscle of muscles.primary) {
    add(input.rollingVolume, muscle, input.sets * PRIMARY_MUSCLE_SET_WEIGHT)
    add(input.sessionPrimaryVolume, muscle, input.sets * PRIMARY_MUSCLE_SET_WEIGHT)
  }
  for (const muscle of muscles.secondary) {
    add(input.rollingVolume, muscle, input.sets * SECONDARY_MUSCLE_SET_WEIGHT)
  }
}
