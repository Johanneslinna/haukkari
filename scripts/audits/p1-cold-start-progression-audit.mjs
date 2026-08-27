import { createServer } from '../../node_modules/vite/dist/node/index.js'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const generatedAt = '2026-08-27T08:00:00.000Z'
const externalLoadContext = 'adult-resistance-load-context-1.0.0:external-kg'
const dumbbellLoadContext = 'adult-resistance-load-context-1.0.0:dumbbell-kg-each'
const server = await createServer({
  root: repoRoot,
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

try {
  const engine = await server.ssrLoadModule('/src/domain/coaching/index.ts')
  const {
    createResistanceSessionObjective,
    decideInterSessionProgression,
    estimateAdultResistanceCapability,
    prescribeResistanceDose,
    publishedExerciseCatalog,
    resolvePrescription,
  } = engine

  const cases = []
  const record = (id, pass, observed) => cases.push({ id, pass, observed })
  const historySet = (patch = {}) => ({
    sessionId: 'workout-1',
    exerciseCode: 'TEST_LIFT',
    exerciseVersion: '1.0.0',
    loadKg: 40,
    loadType: 'EXTERNAL_KG',
    loadContextId: externalLoadContext,
    loadIncrementKg: 2.5,
    repetitions: 8,
    rir: 2,
    completedAt: '2026-08-20T08:00:00.000Z',
    pain: false,
    techniqueOk: true,
    completionStatus: 'COMPLETED',
    doseCompleted: true,
    ...patch,
  })
  const progression = (history, patch = {}) =>
    decideInterSessionProgression({
      comparableSessions: history,
      targetExerciseCode: 'TEST_LIFT',
      targetExerciseVersion: '1.0.0',
      targetLoadType: 'EXTERNAL_KG',
      targetLoadContextId: externalLoadContext,
      targetRir: [2, 3],
      maximumRepetitions: 8,
      loadIncrementKg: 2.5,
      generatedAt,
      ...patch,
    })

  const sameWorkout = progression([
    historySet({ sessionId: 'same' }),
    historySet({ sessionId: 'same' }),
  ])
  record(
    'distinct-session-same-workout',
    sameWorkout.action === 'KEEP_LOAD' && sameWorkout.supportingSessionIds.length === 1,
    sameWorkout,
  )

  const twoWorkouts = progression([
    historySet({ sessionId: 'one' }),
    historySet({ sessionId: 'two', completedAt: '2026-08-24T08:00:00.000Z' }),
  ])
  record(
    'distinct-session-two-workouts',
    twoWorkouts.action === 'INCREASE_LOAD' && twoWorkouts.nextLoadKg === 42.5,
    twoWorkouts,
  )

  const legacy = progression([historySet({ sessionId: undefined })])
  record(
    'legacy-fail-closed',
    legacy.action === 'RECALIBRATE_LOAD' &&
      legacy.reasonCodes.includes('SESSION_IDENTITY_REQUIRED'),
    legacy,
  )

  const oneBelowMaximum = progression([historySet({ repetitions: 7 })])
  record(
    'one-session-add-repetition',
    oneBelowMaximum.action === 'INCREASE_REPETITIONS' &&
      oneBelowMaximum.nextLoadKg === 40 &&
      oneBelowMaximum.nextRepetitions === 8,
    oneBelowMaximum,
  )

  const tooLargeIncrement = progression(
    [
      historySet({ sessionId: 'one', loadKg: 5, loadIncrementKg: 1 }),
      historySet({
        sessionId: 'two',
        loadKg: 5,
        loadIncrementKg: 1,
        completedAt: '2026-08-24T08:00:00.000Z',
      }),
    ],
    { loadIncrementKg: 1 },
  )
  record(
    'five-to-six-blocked',
    tooLargeIncrement.action === 'KEEP_LOAD' &&
      tooLargeIncrement.nextLoadKg === 5 &&
      tooLargeIncrement.reasonCodes.includes('LOAD_INCREMENT_EXCEEDS_TEN_PERCENT'),
    tooLargeIncrement,
  )

  for (const [id, patch] of [
    ['pain-breaks-streak', { pain: true }],
    ['technique-breaks-streak', { techniqueOk: false }],
    ['stopped-breaks-streak', { completionStatus: 'STOPPED', doseCompleted: false }],
  ]) {
    const decision = progression([
      historySet({ sessionId: 'one' }),
      historySet({
        sessionId: 'two',
        completedAt: '2026-08-24T08:00:00.000Z',
        ...patch,
      }),
    ])
    record(
      id,
      decision.action === 'KEEP_LOAD' &&
        decision.reasonCodes.includes('SUCCESS_STREAK_BROKEN'),
      decision,
    )
  }

  for (const experience of ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']) {
    const exercise = publishedExerciseCatalog.getExercise('GOBLET_SQUAT')
    const athlete = {
      age: 35,
      contentReleaseId: 'adult-resistance-v1.0.0',
      ruleVersion: 'adult-resistance-rules-1.2.0',
      experience,
      goal: 'MAX_STRENGTH',
      equipment: ['Kehonpaino', 'Käsipainot'],
      environment: 'HOME',
      availableMinutes: 45,
      generatedAt,
      physicalLoad: 'MODERATE',
      readiness: 'GREEN',
      limitationTags: [],
      dislikedExerciseCodes: [],
      likedExerciseCodes: [],
      supervisionAvailable: false,
    }
    const reliableHistory =
      experience === 'BEGINNER'
        ? []
        : [
            historySet({
              sessionId: 'goblet-one',
              exerciseCode: exercise.code,
              exerciseVersion: exercise.version,
              loadType: 'DUMBBELL_KG_EACH',
              loadContextId: dumbbellLoadContext,
            }),
            historySet({
              sessionId: 'goblet-two',
              exerciseCode: exercise.code,
              exerciseVersion: exercise.version,
              loadType: 'DUMBBELL_KG_EACH',
              loadContextId: dumbbellLoadContext,
              completedAt: '2026-08-24T08:00:00.000Z',
            }),
          ]
    const capability = estimateAdultResistanceCapability(
      exercise,
      reliableHistory,
      generatedAt,
      experience,
    )
    const dose = prescribeResistanceDose(
      createResistanceSessionObjective(athlete),
      exercise,
      capability,
      athlete,
      { comparableSetsThisWeek: 0 },
    )
    const expected =
      experience === 'BEGINNER'
        ? [6, 10]
        : experience === 'INTERMEDIATE'
          ? [5, 8]
          : [4, 6]
    record(
      `cold-start-${experience.toLocaleLowerCase('en-US')}`,
      JSON.stringify(dose.repetitions) === JSON.stringify(expected),
      {
        repetitions: dose.repetitions,
        calibrationRequired: capability.calibrationRequired,
      },
    )
  }

  const profile = {
    goal: 'MAX_STRENGTH',
    experience: 'INTERMEDIATE',
    equipment: ['Käsipainot'],
    physicalLoad: 'MODERATE',
    minutesPerSession: 45,
    age: 35,
    generatedAt,
    readiness: 'GREEN',
  }
  const baseline = resolvePrescription({
    sessionId: 'audit-baseline',
    title: 'Voima',
    kind: 'STRENGTH',
    durationMinutes: 45,
    profile,
  })
  const exercise =
    baseline.status === 'SUPPORTED'
      ? baseline.prescription.exercises.find((item) => item.loadContextId)
      : null
  const maximumRepetitions = Number(exercise?.repetitions?.match(/\d+$/u)?.[0])
  const production = exercise
    ? resolvePrescription({
        sessionId: 'audit-next',
        title: 'Voima',
        kind: 'STRENGTH',
        durationMinutes: 45,
        profile: {
          ...profile,
          strengthHistory: [
            historySet({
              sessionId: 'audit-real-workout',
              exerciseCode: exercise.code,
              exerciseVersion: exercise.contentVersion,
              loadType: exercise.loadType,
              loadContextId: exercise.loadContextId,
              repetitions: maximumRepetitions - 1,
              rir: exercise.targetRir,
            }),
          ],
        },
      })
    : null
  const productionExercise =
    production?.status === 'SUPPORTED'
      ? production.prescription.exercises.find((item) => item.code === exercise?.code)
      : null
  record(
    'production-resolve-route',
    productionExercise?.progressionDecision?.action === 'INCREASE_REPETITIONS' &&
      productionExercise.progressionDecision.supportingSessionIds[0] ===
        'audit-real-workout' &&
      production?.status === 'SUPPORTED' &&
      production.prescription.decisionTrace.adaptations?.some((item) =>
        item.reasonCodes.includes('ONE_SUCCESSFUL_DISTINCT_SESSION'),
      ),
    productionExercise?.progressionDecision ?? production,
  )

  const actionDistribution = cases.reduce((summary, item) => {
    const action = item.observed?.action ?? 'DOSE'
    summary[action] = (summary[action] ?? 0) + 1
    return summary
  }, {})
  const summary = {
    caseCount: cases.length,
    passedCount: cases.filter((item) => item.pass).length,
    failedCount: cases.filter((item) => !item.pass).length,
    actionDistribution,
    cases,
  }
  console.log(JSON.stringify(summary, null, 2))
  if (summary.failedCount > 0) process.exitCode = 1
} finally {
  await server.close()
}
