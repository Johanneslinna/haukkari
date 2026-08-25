import type { ExplainableDecision, ProgressEvaluation, ProgressPeriod } from './types'

type EvaluationOptions = {
  higherIsBetter?: boolean
  minimumDataPoints?: number
  plateauThresholdRatio?: number
}

export function evaluateProgress(
  periods: ProgressPeriod[],
  options: EvaluationOptions = {},
): ExplainableDecision<ProgressEvaluation> {
  const minimumDataPoints = options.minimumDataPoints ?? 2
  const comparable = periods.filter(
    (period) => period.comparable && period.dataPoints >= minimumDataPoints,
  )
  if (comparable.length < 2) {
    return {
      decision: { status: 'INSUFFICIENT_DATA', delta: null },
      reasons: [
        {
          code: 'TWO_COMPARABLE_PERIODS_REQUIRED',
          message:
            'Tasanteen arviointi vaatii kaksi vertailukelpoista jaksoa ja riittävän datan.',
          priority: 'PRIMARY_GOAL',
        },
      ],
      warnings: [],
    }
  }

  const previous = comparable.at(-2)
  const current = comparable.at(-1)
  if (!previous || !current) throw new Error('Vertailujaksot puuttuvat.')
  const delta = current.metricValue - previous.metricValue
  const reference = Math.max(Math.abs(previous.metricValue), 1)
  const threshold = reference * (options.plateauThresholdRatio ?? 0.01)
  const adjustedDelta = options.higherIsBetter === false ? -delta : delta
  const status =
    Math.abs(delta) <= threshold
      ? 'PLATEAU'
      : adjustedDelta > 0
        ? 'IMPROVING'
        : 'DECLINING'

  return {
    decision: { status, delta },
    reasons: [
      {
        code: `PROGRESS_${status}`,
        message: `Arvio perustuu jaksoihin ${previous.label} ja ${current.label}.`,
        priority: 'PRIMARY_GOAL',
      },
    ],
    warnings: [],
  }
}

export const ProgressEvaluator = { evaluate: evaluateProgress }
