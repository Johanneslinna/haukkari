import { createServer } from '../../node_modules/vite/dist/node/index.js'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const server = await createServer({
  root: repoRoot,
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const budgets = [10, 20, 30, 45, 60, 90]
const generatedAt = '2026-08-27T08:00:00.000Z'

try {
  const engine = await server.ssrLoadModule('/src/domain/coaching/index.ts')
  const { auditStrengthPrescriptionTime, resolvePrescription } = engine
  const examples = []

  for (const budget of budgets) {
    const result = resolvePrescription({
      sessionId: `time-example-${budget}`,
      title: 'Kokovartalon voima',
      kind: 'STRENGTH',
      durationMinutes: budget,
      profile: {
        goal: 'GENERAL_FITNESS',
        experience: 'INTERMEDIATE',
        equipment: [
          'Kehonpaino',
          'Vastuskuminauhat',
          'Käsipainot',
          'Kuntosalilaitteet',
          'Levytanko ja painot',
        ],
        physicalLoad: 'MODERATE',
        minutesPerSession: budget,
        age: 35,
        readiness: 'GREEN',
        healthBlocked: false,
        generatedAt,
      },
    })
    if (result.status !== 'SUPPORTED') {
      throw new Error(`${budget} min example was blocked: ${result.reasonCode}`)
    }
    const audit = auditStrengthPrescriptionTime(result.prescription)
    if (audit.violations.length > 0) {
      throw new Error(`${budget} min example violated: ${audit.violations.join(', ')}`)
    }
    examples.push({
      timeBudgetMinutes: budget,
      durationMinutes: result.prescription.durationMinutes,
      calculatedTotalSeconds: result.prescription.calculatedTotalSeconds,
      exerciseCount: result.prescription.exercises.length,
      workSetCount: result.prescription.exercises.reduce(
        (total, exercise) => total + exercise.sets,
        0,
      ),
      timeAdjustmentReasonCodes: result.prescription.timeAdjustmentReasonCodes,
      timeBreakdown: result.prescription.timeBreakdown,
    })
  }

  console.log(
    JSON.stringify(
      {
        policyVersion: examples[0]?.timeBreakdown.policyVersion,
        generatedExamples: examples.length,
        examples,
        violationCount: 0,
      },
      null,
      2,
    ),
  )
} finally {
  await server.close()
}
