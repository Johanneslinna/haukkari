import type { AdultResistanceSetHistory } from './AdultResistanceEngine'
import type {
  ExercisePrescription,
  StrengthReturnDecisionTrace,
  StrengthReturnState,
} from './types'

export const STRENGTH_RETURN_POLICY_VERSION = 'adult-strength-return-1.0.0'

const DAY_MS = 86_400_000
const APP_HISTORY_MINIMUM_SESSIONS = 8
const APP_HISTORY_REGULAR_SPAN_DAYS = 84

export type StrengthTrainingBackground = {
  regularTrainingAtLeast12Weeks: boolean
  lastStrengthWorkoutAt: string
  source: 'APP_HISTORY' | 'USER_CONFIRMED'
  confirmedAt: string
  policyVersion: string
}

export type StrengthReturnDecision = StrengthReturnDecisionTrace & {
  progressionSuppressed: boolean
  previousLoadDisplayOnly: boolean
}

type StrengthSession = {
  id: string
  completedAt: string
  rows: AdultResistanceSetHistory[]
  completed: boolean
  qualityCompleted: boolean
  approvedReturnWorkout: boolean
  reasonCodes: string[]
}

function returnSessionReasonCodes(rows: readonly AdultResistanceSetHistory[]) {
  const reasonCodes: string[] = []
  if (rows.some((row) => row.pain === true)) {
    reasonCodes.push('RETURN_SESSION_REJECTED_PAIN')
  }
  if (rows.some((row) => row.completionStatus === 'STOPPED' || row.stopped === true)) {
    reasonCodes.push('RETURN_SESSION_REJECTED_STOP')
  }
  if (
    rows.some((row) => row.completionStatus !== 'COMPLETED' || row.doseCompleted !== true)
  ) {
    reasonCodes.push('RETURN_SESSION_REJECTED_INCOMPLETE_DOSE')
  }
  if (
    rows.some(
      (row) =>
        typeof row.rir !== 'number' ||
        typeof row.targetRirMin !== 'number' ||
        typeof row.targetRirMax !== 'number' ||
        row.rir < row.targetRirMin ||
        row.rir > row.targetRirMax,
    )
  ) {
    reasonCodes.push('RETURN_SESSION_REJECTED_RIR_OUTSIDE_TARGET')
  }
  if (rows.some((row) => row.techniqueOk !== true)) {
    reasonCodes.push('RETURN_SESSION_REJECTED_TECHNIQUE')
  }
  if (rows.some((row) => row.difficultyTooHard === true)) {
    reasonCodes.push('RETURN_SESSION_REJECTED_DIFFICULTY_TOO_HARD')
  }
  if (rows.some((row) => row.feltWorse === true)) {
    reasonCodes.push('RETURN_SESSION_REJECTED_FELT_WORSE')
  }
  if (rows.some((row) => row.sessionRpeNineOrMore === true)) {
    reasonCodes.push('RETURN_SESSION_REJECTED_RPE_NINE_OR_MORE')
  }
  if (rows.some((row) => row.severeDomsDeload === true)) {
    reasonCodes.push('RETURN_SESSION_REJECTED_SEVERE_DOMS_DELOAD')
  }
  if (
    reasonCodes.length === 0 &&
    rows.some((row) => row.severeRecoveryProblem === true)
  ) {
    reasonCodes.push('RETURN_SESSION_REJECTED_SEVERE_RECOVERY_PROBLEM')
  }
  return reasonCodes.length === 0 ? ['RETURN_SESSION_ACCEPTED'] : reasonCodes
}

function validTimestamp(value: string, generatedAtMs: number) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) && parsed <= generatedAtMs ? parsed : null
}

function daysBetween(earlier: string, later: string) {
  return Math.floor((Date.parse(later) - Date.parse(earlier)) / DAY_MS)
}

function collapseSessions(
  history: readonly AdultResistanceSetHistory[],
  generatedAt: string,
): StrengthSession[] {
  const generatedAtMs = Date.parse(generatedAt)
  if (!Number.isFinite(generatedAtMs)) return []
  const groups = new Map<string, AdultResistanceSetHistory[]>()
  for (const row of history) {
    if (!row.sessionId || validTimestamp(row.completedAt, generatedAtMs) === null)
      continue
    const rows = groups.get(row.sessionId) ?? []
    rows.push(row)
    groups.set(row.sessionId, rows)
  }
  return [...groups.entries()]
    .flatMap(([id, rows]) => {
      const completedAt = [...rows]
        .map((row) => row.completedAt)
        .sort((left, right) => left.localeCompare(right))
        .at(-1)
      if (!completedAt) return []
      const completed = rows.every((row) => row.completionStatus === 'COMPLETED')
      const qualityCompleted = rows.every(
        (row) =>
          row.completionStatus === 'COMPLETED' &&
          row.doseCompleted === true &&
          row.pain === false &&
          row.techniqueOk === true &&
          row.stopped !== true &&
          row.severeRecoveryProblem !== true &&
          row.difficultyTooHard !== true &&
          row.feltWorse !== true &&
          row.sessionRpeNineOrMore !== true &&
          row.severeDomsDeload !== true,
      )
      const reasonCodes = returnSessionReasonCodes(rows)
      const approvedReturnWorkout = reasonCodes.includes('RETURN_SESSION_ACCEPTED')
      return [
        {
          id,
          completedAt,
          rows,
          completed,
          qualityCompleted,
          approvedReturnWorkout,
          reasonCodes,
        },
      ]
    })
    .sort(
      (left, right) =>
        left.completedAt.localeCompare(right.completedAt) ||
        left.id.localeCompare(right.id),
    )
}

function validBackground(
  value: StrengthTrainingBackground | undefined,
  generatedAt: string,
) {
  if (
    !value ||
    value.policyVersion !== STRENGTH_RETURN_POLICY_VERSION ||
    value.source !== 'USER_CONFIRMED' ||
    value.regularTrainingAtLeast12Weeks !== true
  ) {
    return null
  }
  const generatedAtMs = Date.parse(generatedAt)
  const lastAt = validTimestamp(value.lastStrengthWorkoutAt, generatedAtMs)
  const confirmedAt = validTimestamp(value.confirmedAt, generatedAtMs)
  if (lastAt === null || confirmedAt === null || confirmedAt < lastAt) return null
  return value
}

function appHistoryProvesRegularTraining(sessions: readonly StrengthSession[]) {
  const qualifying = sessions.filter((session) => session.qualityCompleted)
  const first = qualifying.at(0)
  const last = qualifying.at(-1)
  return (
    qualifying.length >= APP_HISTORY_MINIMUM_SESSIONS &&
    Boolean(first && last) &&
    daysBetween(first!.completedAt, last!.completedAt) >= APP_HISTORY_REGULAR_SPAN_DAYS
  )
}

function sourceReasonCodes(input: {
  source: StrengthReturnDecision['source']
  appHistoryReliable: boolean
}) {
  if (input.source === 'USER_CONFIRMED') {
    return ['PRIOR_TRAINING_SOURCE_USER_CONFIRMED']
  }
  if (input.source !== 'APP_HISTORY') return []
  return [
    'PRIOR_TRAINING_SOURCE_APP_HISTORY',
    ...(input.appHistoryReliable
      ? [
          'APP_HISTORY_CONTINUITY_CONFIRMED',
          'APP_HISTORY_EIGHT_SESSIONS_CONFIRMED',
          'APP_HISTORY_EIGHTY_FOUR_DAY_SPAN_CONFIRMED',
        ]
      : []),
  ]
}

function stateForBreakDays(days: number): StrengthReturnState {
  if (days <= 7) return 'ACTIVE'
  if (days <= 14) return 'BREAK_8_TO_14_DAYS'
  if (days <= 27) return 'BREAK_15_TO_27_DAYS'
  if (days <= 55) return 'RETURN_BLOCK_28_TO_55_DAYS'
  return 'RETURNING_56_PLUS_DAYS'
}

function reasonCodesFor(state: StrengthReturnState) {
  switch (state) {
    case 'BREAK_8_TO_14_DAYS':
      return [
        'BREAK_8_TO_14_DAYS',
        'FIRST_RETURN_WEEK',
        'WORKING_SETS_REDUCED_25_PERCENT',
        'PROGRESSION_SUPPRESSED_DURING_REENTRY',
      ]
    case 'BREAK_15_TO_27_DAYS':
      return [
        'BREAK_15_TO_27_DAYS',
        'WORKING_SETS_REDUCED_35_PERCENT',
        'TARGET_RIR_INCREASED',
        'PREVIOUS_LOAD_REFERENCE_ONLY',
        'LOAD_RECALIBRATION_REQUIRED',
        'PROGRESSION_SUPPRESSED_DURING_REENTRY',
      ]
    case 'RETURN_BLOCK_28_TO_55_DAYS':
      return [
        'RETURN_BLOCK_28_TO_55_DAYS',
        'TWO_WEEK_REENTRY_BLOCK',
        'SETS_CAPPED_AT_TWO',
        'RIR_CONSERVATIVE',
        'HEAVY_REPETITION_RANGE_WITHHELD',
        'OLD_LOAD_REFERENCE_ONLY',
        'LOAD_RECALIBRATION_REQUIRED',
        'PROGRESSION_SUPPRESSED_DURING_REENTRY',
      ]
    case 'RETURNING_56_PLUS_DAYS':
      return [
        'RETURNING_56_PLUS_DAYS',
        'BREAK_REENTRY',
        'OLD_LOAD_HISTORY_DISPLAY_ONLY',
        'TWO_POST_BREAK_CALIBRATIONS_REQUIRED',
        'PRE_BREAK_LOAD_AUTHORITY_REVOKED',
        'PROGRESSION_SUPPRESSED_DURING_REENTRY',
      ]
    case 'NOVICE_COLD_START':
      return ['STRENGTH_CONTINUITY_NOT_CONFIRMED', 'NOVICE_COLD_START']
    case 'ACTIVE':
      return []
  }
}

export function strengthTrainingBackgroundFrom(
  value: unknown,
): StrengthTrainingBackground | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Record<string, unknown>
  if (
    candidate.regularTrainingAtLeast12Weeks !== true ||
    typeof candidate.lastStrengthWorkoutAt !== 'string' ||
    (candidate.source !== 'APP_HISTORY' && candidate.source !== 'USER_CONFIRMED') ||
    typeof candidate.confirmedAt !== 'string' ||
    typeof candidate.policyVersion !== 'string'
  ) {
    return undefined
  }
  return candidate as StrengthTrainingBackground
}

export function evaluateStrengthReturn(input: {
  history: readonly AdultResistanceSetHistory[]
  generatedAt: string
  background?: StrengthTrainingBackground
}): StrengthReturnDecision {
  const generatedAtMs = Date.parse(input.generatedAt)
  if (!Number.isFinite(generatedAtMs)) {
    return {
      state: 'NOVICE_COLD_START',
      policyVersion: STRENGTH_RETURN_POLICY_VERSION,
      source: 'NONE',
      breakDays: null,
      episodeStartedAt: null,
      approvedReturnWorkoutCount: 0,
      requiredApprovedWorkoutCount: 0,
      reentryEndsAt: null,
      historyAuthorityCutoffAt: null,
      reasonCodes: ['EVALUATION_TIME_INVALID', 'NOVICE_COLD_START'],
      progressionSuppressed: false,
      previousLoadDisplayOnly: false,
    }
  }
  const sessions = collapseSessions(input.history, input.generatedAt)
  const background = validBackground(input.background, input.generatedAt)

  let breakStartAt: string | null = null
  let returnSessions: StrengthSession[] = []
  let preBreakSessions: StrengthSession[] = []
  let source: StrengthReturnDecision['source'] = 'NONE'

  const latestSession = sessions.at(-1)
  if (latestSession && daysBetween(latestSession.completedAt, input.generatedAt) >= 8) {
    breakStartAt = latestSession.completedAt
    preBreakSessions = sessions
    source = 'APP_HISTORY'
  } else {
    for (let index = sessions.length - 1; index > 0; index -= 1) {
      const previous = sessions[index - 1]!
      const current = sessions[index]!
      if (daysBetween(previous.completedAt, current.completedAt) >= 8) {
        breakStartAt = previous.completedAt
        preBreakSessions = sessions.slice(0, index)
        returnSessions = sessions.slice(index)
        source = 'APP_HISTORY'
        break
      }
    }
  }

  if (!breakStartAt && background) {
    const afterBackground = sessions.filter(
      (session) =>
        Date.parse(session.completedAt) > Date.parse(background.lastStrengthWorkoutAt),
    )
    const firstAfterBackground = afterBackground.at(0)
    const breakEnd = firstAfterBackground?.completedAt ?? input.generatedAt
    if (daysBetween(background.lastStrengthWorkoutAt, breakEnd) >= 8) {
      breakStartAt = background.lastStrengthWorkoutAt
      returnSessions = afterBackground
      source = 'USER_CONFIRMED'
    }
  }

  if (!breakStartAt) {
    const state: StrengthReturnState =
      sessions.length === 0 ? 'NOVICE_COLD_START' : 'ACTIVE'
    const resolvedSource = state === 'ACTIVE' ? 'APP_HISTORY' : 'NONE'
    return {
      state,
      policyVersion: STRENGTH_RETURN_POLICY_VERSION,
      source: resolvedSource,
      breakDays:
        sessions.length === 0
          ? null
          : Math.max(0, daysBetween(latestSession!.completedAt, input.generatedAt)),
      episodeStartedAt: null,
      approvedReturnWorkoutCount: 0,
      requiredApprovedWorkoutCount: 0,
      reentryEndsAt: null,
      historyAuthorityCutoffAt: null,
      reasonCodes: [
        ...reasonCodesFor(state),
        ...sourceReasonCodes({
          source: resolvedSource,
          appHistoryReliable: appHistoryProvesRegularTraining(sessions),
        }),
      ],
      progressionSuppressed: false,
      previousLoadDisplayOnly: false,
    }
  }

  const firstReturnSession = returnSessions.at(0)
  const breakEndAt = firstReturnSession?.completedAt ?? input.generatedAt
  const breakDays = daysBetween(breakStartAt, breakEndAt)
  let state = stateForBreakDays(breakDays)
  const completedReturnSession = returnSessions.find((session) => session.completed)
  const episodeStartedAt = completedReturnSession?.completedAt ?? null
  const approvedReturnSessions = episodeStartedAt
    ? returnSessions.filter(
        (session) =>
          Date.parse(session.completedAt) >= Date.parse(episodeStartedAt) &&
          session.approvedReturnWorkout,
      )
    : []

  const appHistoryReliable = appHistoryProvesRegularTraining(preBreakSessions)
  if (state === 'RETURNING_56_PLUS_DAYS' && !appHistoryReliable && !background) {
    state = 'NOVICE_COLD_START'
    source = 'NONE'
  } else if (state === 'RETURNING_56_PLUS_DAYS') {
    source = appHistoryReliable ? 'APP_HISTORY' : 'USER_CONFIRMED'
  }

  const requiredApprovedWorkoutCount =
    state === 'RETURNING_56_PLUS_DAYS' ? (source === 'APP_HISTORY' ? 4 : 6) : 0
  const persistenceDays =
    state === 'BREAK_8_TO_14_DAYS' || state === 'BREAK_15_TO_27_DAYS'
      ? 7
      : state === 'RETURN_BLOCK_28_TO_55_DAYS'
        ? 14
        : null
  const reentryEndsAt =
    episodeStartedAt && persistenceDays !== null
      ? new Date(Date.parse(episodeStartedAt) + persistenceDays * DAY_MS).toISOString()
      : null

  if (
    persistenceDays !== null &&
    reentryEndsAt &&
    generatedAtMs >= Date.parse(reentryEndsAt)
  ) {
    state = 'ACTIVE'
  }
  if (
    state === 'RETURNING_56_PLUS_DAYS' &&
    approvedReturnSessions.length >= requiredApprovedWorkoutCount
  ) {
    state = 'ACTIVE'
  }

  const longBreak = breakDays >= 56
  const historyAuthorityCutoffAt =
    longBreak || state === 'BREAK_15_TO_27_DAYS' || state === 'RETURN_BLOCK_28_TO_55_DAYS'
      ? (firstReturnSession?.completedAt ?? input.generatedAt)
      : null
  const activeReentry =
    state === 'BREAK_8_TO_14_DAYS' ||
    state === 'BREAK_15_TO_27_DAYS' ||
    state === 'RETURN_BLOCK_28_TO_55_DAYS' ||
    state === 'RETURNING_56_PLUS_DAYS'

  const reasonCodes = [
    ...reasonCodesFor(state),
    ...sourceReasonCodes({ source, appHistoryReliable }),
    ...returnSessions.flatMap((session) => session.reasonCodes),
    ...(longBreak && state === 'ACTIVE' ? ['RETURN_REENTRY_COMPLETED'] : []),
  ]

  return {
    state,
    policyVersion: STRENGTH_RETURN_POLICY_VERSION,
    source,
    breakDays,
    episodeStartedAt,
    approvedReturnWorkoutCount: approvedReturnSessions.length,
    requiredApprovedWorkoutCount,
    reentryEndsAt,
    historyAuthorityCutoffAt,
    reasonCodes: [...new Set(reasonCodes)],
    progressionSuppressed: activeReentry,
    previousLoadDisplayOnly:
      state === 'BREAK_15_TO_27_DAYS' ||
      state === 'RETURN_BLOCK_28_TO_55_DAYS' ||
      state === 'RETURNING_56_PLUS_DAYS',
  }
}

function withSets(exercise: ExercisePrescription, sets: number) {
  return {
    ...exercise,
    sets,
    dose:
      exercise.dose?.kind === 'STRENGTH_SETS'
        ? { ...exercise.dose, sets }
        : exercise.dose,
  }
}

export function reduceReturnWorkingSets(
  exercises: readonly ExercisePrescription[],
  multiplier: 0.75 | 0.65,
) {
  const result = exercises.map((exercise) => withSets(exercise, exercise.sets))
  const target = Math.max(
    result.filter((exercise) => exercise.keyExercise).length,
    Math.floor(result.reduce((sum, exercise) => sum + exercise.sets, 0) * multiplier),
  )
  let remaining = result.reduce((sum, exercise) => sum + exercise.sets, 0) - target
  const reduce = (keyExercise: boolean) => {
    for (let index = result.length - 1; index >= 0 && remaining > 0; index -= 1) {
      const exercise = result[index]!
      if (exercise.keyExercise !== keyExercise) continue
      const minimum = keyExercise ? 1 : 0
      const removable = Math.min(remaining, Math.max(0, exercise.sets - minimum))
      if (removable <= 0) continue
      result[index] = withSets(exercise, exercise.sets - removable)
      remaining -= removable
    }
  }
  reduce(false)
  reduce(true)
  return result.filter((exercise) => exercise.sets > 0)
}

export const ReturnToStrengthPolicy = {
  evaluate: evaluateStrengthReturn,
  reduceWorkingSets: reduceReturnWorkingSets,
}
