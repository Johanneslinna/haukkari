import type { ExercisePrescription, PrescribedSession, PrescriptionDose } from './types'

export const PRESCRIPTION_SCHEMA_VERSION = 2 as const
export const PRESCRIPTION_ENGINE_VERSION = 'training-engine-v2.0.0'

export function legacyDose(exercise: ExercisePrescription): PrescriptionDose {
  if (exercise.dose) return exercise.dose
  if (exercise.repetitions) {
    return {
      kind: 'STRENGTH_SETS',
      sets: Math.max(1, exercise.sets),
      repetitions: exercise.repetitions,
      restSeconds: Math.max(0, exercise.restSeconds),
      targetRpe: exercise.targetRpe,
      targetRir: exercise.targetRir,
    }
  }
  return {
    kind: 'CONTINUOUS_TIME',
    durationSeconds: Math.max(60, exercise.durationSeconds ?? 60),
    targetRpe: exercise.targetRpe,
    intensityCue: exercise.loadGuidance,
  }
}

export function prescriptionBlocks(prescription: PrescribedSession) {
  return prescription.blocks?.length ? prescription.blocks : prescription.exercises
}

export function doseDurationSeconds(dose: PrescriptionDose) {
  switch (dose.kind) {
    case 'STRENGTH_SETS':
      return dose.sets * 60 + Math.max(0, dose.sets - 1) * dose.restSeconds
    case 'CONTINUOUS_TIME':
      return dose.durationSeconds
    case 'INTERVAL_BLOCKS':
      return (
        dose.repetitions * dose.workSeconds +
        Math.max(0, dose.repetitions - 1) * dose.recoverySeconds
      )
    case 'SPRINT_REPS':
      return (
        dose.repetitions * 10 + Math.max(0, dose.repetitions - 1) * dose.recoverySeconds
      )
    case 'JUMP_REPS':
      return dose.sets * 30 + Math.max(0, dose.sets - 1) * dose.recoverySeconds
    case 'SKILL_DRILL':
      return (
        (dose.durationSeconds ?? dose.sets * 40) +
        Math.max(0, dose.sets - 1) * dose.recoverySeconds
      )
  }
}

export function prescriptionDurationSeconds(prescription: PrescribedSession) {
  const work = prescriptionBlocks(prescription).reduce(
    (total, exercise) => total + doseDurationSeconds(legacyDose(exercise)),
    0,
  )
  return (
    (prescription.warmupMinutes ?? 0) * 60 +
    work +
    (prescription.cooldownMinutes ?? 0) * 60
  )
}

export function doseUnitCount(exercise: ExercisePrescription) {
  const dose = legacyDose(exercise)
  switch (dose.kind) {
    case 'STRENGTH_SETS':
    case 'SKILL_DRILL':
      return dose.sets
    case 'INTERVAL_BLOCKS':
    case 'SPRINT_REPS':
      return dose.repetitions
    case 'JUMP_REPS':
      return dose.sets
    case 'CONTINUOUS_TIME':
      return 1
  }
}

export function doseLabelFi(exercise: ExercisePrescription) {
  const dose = legacyDose(exercise)
  switch (dose.kind) {
    case 'STRENGTH_SETS':
      return `${dose.sets} sarjaa · ${dose.repetitions}`
    case 'CONTINUOUS_TIME':
      return `${Math.round(dose.durationSeconds / 60)} min yhtäjaksoisesti`
    case 'INTERVAL_BLOCKS':
      return `${dose.repetitions} × ${Math.round(dose.workSeconds / 60)} min · ${Math.round(dose.recoverySeconds / 60)} min palautus`
    case 'SPRINT_REPS':
      return `${dose.repetitions} × ${dose.distanceMeters} m · ${dose.recoverySeconds} s palautus`
    case 'JUMP_REPS':
      return `${dose.sets} × ${dose.repetitions} hyppyä · ${dose.recoverySeconds} s palautus`
    case 'SKILL_DRILL':
      return dose.durationSeconds
        ? `${Math.round(dose.durationSeconds / 60)} min`
        : `${dose.sets} × ${dose.repetitions ?? 'hallittu työosuus'}`
  }
}

export function withExerciseDose(
  exercise: ExercisePrescription,
  dose: PrescriptionDose,
): ExercisePrescription {
  switch (dose.kind) {
    case 'STRENGTH_SETS':
      return {
        ...exercise,
        dose,
        sets: dose.sets,
        repetitions: dose.repetitions,
        durationSeconds: undefined,
        restSeconds: dose.restSeconds,
        targetRpe: dose.targetRpe,
        targetRir: dose.targetRir,
      }
    case 'CONTINUOUS_TIME':
      return {
        ...exercise,
        dose,
        sets: 1,
        repetitions: undefined,
        durationSeconds: dose.durationSeconds,
        restSeconds: 0,
        targetRpe: dose.targetRpe,
      }
    case 'INTERVAL_BLOCKS':
      return {
        ...exercise,
        dose,
        sets: dose.repetitions,
        repetitions: undefined,
        durationSeconds: dose.workSeconds,
        restSeconds: dose.recoverySeconds,
        targetRpe: dose.targetRpe,
      }
    case 'SPRINT_REPS':
      return {
        ...exercise,
        dose,
        sets: dose.repetitions,
        repetitions: `${dose.distanceMeters} m`,
        durationSeconds: undefined,
        restSeconds: dose.recoverySeconds,
        targetRpe: dose.targetRpe,
      }
    case 'JUMP_REPS':
      return {
        ...exercise,
        dose,
        sets: dose.sets,
        repetitions: String(dose.repetitions),
        durationSeconds: undefined,
        restSeconds: dose.recoverySeconds,
        targetRpe: dose.targetRpe,
      }
    case 'SKILL_DRILL':
      return {
        ...exercise,
        dose,
        sets: dose.sets,
        repetitions: dose.repetitions,
        durationSeconds: dose.durationSeconds,
        restSeconds: dose.recoverySeconds,
        targetRpe: dose.targetRpe,
      }
  }
}

export function withV2Blocks(
  prescription: Omit<
    PrescribedSession,
    'schemaVersion' | 'engineVersion' | 'blocks' | 'confidence'
  >,
): PrescribedSession {
  const exercises = prescription.exercises.map((exercise) => ({
    ...exercise,
    dose: legacyDose(exercise),
  }))
  const calculatedDurationMinutes = Math.max(
    1,
    Math.ceil(
      ((prescription.warmupMinutes ?? 0) * 60 +
        exercises.reduce(
          (total, exercise) => total + doseDurationSeconds(legacyDose(exercise)),
          0,
        ) +
        (prescription.cooldownMinutes ?? 0) * 60) /
        60,
    ),
  )
  return {
    ...prescription,
    durationMinutes: calculatedDurationMinutes,
    schemaVersion: PRESCRIPTION_SCHEMA_VERSION,
    engineVersion: PRESCRIPTION_ENGINE_VERSION,
    confidence: prescription.decisionTrace.confidence,
    exercises,
    blocks: exercises,
  }
}

export function normalizePrescriptionV2(
  prescription: PrescribedSession,
): PrescribedSession {
  if (
    prescription.schemaVersion === PRESCRIPTION_SCHEMA_VERSION &&
    prescription.blocks?.length
  ) {
    return prescription
  }
  const normalized = withV2Blocks({
    ...prescription,
    objective: prescription.objective ?? {
      primary: prescription.title,
      secondary: [],
      fatigueBudget: prescription.kind === 'RECOVERY' ? 'LOW' : 'MODERATE',
      avoid: [],
    },
    timeBudgetMinutes: prescription.timeBudgetMinutes ?? prescription.durationMinutes,
    warmupMinutes: prescription.warmupMinutes ?? 0,
    cooldownMinutes: prescription.cooldownMinutes ?? 0,
  })
  return {
    ...normalized,
    // Historiallinen snapshot säilyttää käyttäjälle aiemmin näytetyn keston.
    durationMinutes: prescription.durationMinutes,
  }
}
