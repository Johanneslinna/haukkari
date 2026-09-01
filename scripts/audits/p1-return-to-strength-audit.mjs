import { createServer } from '../../node_modules/vite/dist/node/index.js'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const generatedAt = '2026-08-27T08:00:00.000Z'
const dayMs = 86_400_000
const server = await createServer({
  root: repoRoot,
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

try {
  const engine = await server.ssrLoadModule('/src/domain/coaching/index.ts')
  const {
    STRENGTH_RETURN_POLICY_VERSION,
    auditStrengthPrescriptionTime,
    evaluateStrengthReturn,
    resolvePrescription,
  } = engine
  const daysBefore = (days) =>
    new Date(Date.parse(generatedAt) - days * dayMs).toISOString()
  const historyRow = (sessionId, days, patch = {}) => ({
    sessionId,
    exerciseCode: 'GOBLET_SQUAT',
    exerciseVersion: '1.0.0',
    loadKg: 20,
    loadType: 'DUMBBELL_KG_EACH',
    loadContextId: 'adult-resistance-load-context-1.0.0:dumbbell-kg-each',
    repetitions: 10,
    rir: 3,
    completedAt: daysBefore(days),
    pain: false,
    techniqueOk: true,
    completionStatus: 'COMPLETED',
    doseCompleted: true,
    targetRirMin: 3,
    targetRirMax: 4,
    ...patch,
  })
  const background = (days) => ({
    regularTrainingAtLeast12Weeks: true,
    lastStrengthWorkoutAt: daysBefore(days),
    source: 'USER_CONFIRMED',
    confirmedAt: generatedAt,
    policyVersion: STRENGTH_RETURN_POLICY_VERSION,
  })

  const expectedBoundaries = new Map([
    [7, 'ACTIVE'],
    [8, 'BREAK_8_TO_14_DAYS'],
    [14, 'BREAK_8_TO_14_DAYS'],
    [15, 'BREAK_15_TO_27_DAYS'],
    [27, 'BREAK_15_TO_27_DAYS'],
    [28, 'RETURN_BLOCK_28_TO_55_DAYS'],
    [55, 'RETURN_BLOCK_28_TO_55_DAYS'],
    [56, 'RETURNING_56_PLUS_DAYS'],
    [70, 'RETURNING_56_PLUS_DAYS'],
  ])
  const failures = []
  for (const [days, expected] of expectedBoundaries) {
    const actual = evaluateStrengthReturn({
      history: days >= 56 ? [] : [historyRow(`boundary-${days}`, days)],
      generatedAt,
      background: days >= 56 ? background(days) : undefined,
    })
    if (actual.state !== expected || actual.breakDays !== days) {
      failures.push({ id: `boundary-${days}`, expected, actual })
    }
  }

  const experiences = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']
  const goals = ['GENERAL_FITNESS', 'MAX_STRENGTH', 'MUSCLE_GAIN']
  const equipmentProfiles = {
    BODYWEIGHT: ['Kehonpaino'],
    HOME: ['Kehonpaino', 'Käsipainot', 'Vastuskuminauhat'],
    GYM: ['Kehonpaino', 'Käsipainot', 'Kuntosalilaitteet', 'Levytanko ja painot'],
  }
  const budgets = [20, 30, 45, 60]
  const breakDays = [8, 15, 28, 70]
  const stateDistribution = {}
  const coverage = {
    total: 0,
    supported: 0,
    unsupported: 0,
    timeBudgetViolations: 0,
    progressionViolations: 0,
    doseViolations: 0,
  }

  for (const experience of experiences) {
    for (const goal of goals) {
      for (const [equipmentId, equipment] of Object.entries(equipmentProfiles)) {
        for (const minutesPerSession of budgets) {
          for (const days of breakDays) {
            coverage.total += 1
            const result = resolvePrescription({
              sessionId: `audit-${coverage.total}`,
              title: 'Audit strength',
              kind: 'STRENGTH',
              durationMinutes: minutesPerSession,
              profile: {
                goal,
                experience,
                equipment,
                physicalLoad: 'MODERATE',
                minutesPerSession,
                age: 35,
                readiness: 'GREEN',
                generatedAt,
                strengthHistory:
                  days >= 56 ? [] : [historyRow(`old-${coverage.total}`, days)],
                strengthTrainingBackground: days >= 56 ? background(days) : undefined,
              },
            })
            if (result.status !== 'SUPPORTED') {
              coverage.unsupported += 1
              failures.push({
                id: `matrix-${experience}-${goal}-${equipmentId}-${minutesPerSession}-${days}`,
                result,
              })
              continue
            }
            coverage.supported += 1
            const prescription = result.prescription
            const state = prescription.decisionTrace.strengthReturn?.state ?? 'MISSING'
            stateDistribution[state] = (stateDistribution[state] ?? 0) + 1
            const timeViolations = auditStrengthPrescriptionTime(prescription).violations
            coverage.timeBudgetViolations += timeViolations.length
            if (timeViolations.length > 0) failures.push({ id: 'time', timeViolations })
            if (
              prescription.exercises.some(
                (exercise) =>
                  exercise.progressionDecision?.action === 'INCREASE_LOAD' ||
                  exercise.progressionDecision?.action === 'INCREASE_REPETITIONS',
              )
            ) {
              coverage.progressionViolations += 1
              failures.push({ id: 'progression-suppression', state, prescription })
            }
            if (
              days >= 28 &&
              prescription.exercises.some(
                (exercise) =>
                  exercise.sets < 1 ||
                  exercise.sets > 2 ||
                  exercise.targetRirRange?.[0] !== 3 ||
                  exercise.targetRirRange?.[1] !== 4 ||
                  Number(exercise.repetitions?.match(/\d+/u)?.[0]) < 6,
              )
            ) {
              coverage.doseViolations += 1
              failures.push({ id: 'conservative-dose', state, prescription })
            }
          }
        }
      }
    }
  }

  const negativeControls = {
    missingHistoryIsNovice:
      evaluateStrengthReturn({ history: [], generatedAt }).state === 'NOVICE_COLD_START',
    legacyRowsAreNotSessions:
      evaluateStrengthReturn({
        history: [historyRow(undefined, 70)],
        generatedAt,
      }).state === 'NOVICE_COLD_START',
    futureTimestampIgnored:
      evaluateStrengthReturn({
        history: [historyRow('real', 10), historyRow('future', -1)],
        generatedAt,
      }).breakDays === 10,
  }
  for (const [id, pass] of Object.entries(negativeControls)) {
    if (!pass) failures.push({ id })
  }

  const report = {
    policyVersion: STRENGTH_RETURN_POLICY_VERSION,
    normativeAcceptanceCases: [3, 25, 26, 27, 28],
    exactBoundaryCases: Object.fromEntries(expectedBoundaries),
    stateDistribution,
    matrixDimensions: {
      experiences,
      goals,
      equipmentProfiles: Object.keys(equipmentProfiles),
      budgets,
      breakDays,
    },
    coverage,
    negativeControls,
    failures: failures.length,
  }
  console.log(JSON.stringify(report, null, 2))
  if (
    failures.length > 0 ||
    coverage.supported !== coverage.total ||
    Object.keys(stateDistribution).length < 4
  ) {
    console.error(JSON.stringify(failures.slice(0, 5), null, 2))
    process.exitCode = 1
  }
} finally {
  await server.close()
}
