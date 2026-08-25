import { evaluateGoalConflicts } from './ConflictEngine'
import { getGoalStrategy } from './strategies'
import type {
  ExplainableDecision,
  GoalChangePreview,
  GoalConflictCode,
  GoalConflictContext,
  GoalHistory,
  GoalPeriod,
  GoalProfile,
  PlanVersion,
} from './types'

type PreviewOptions = {
  today: string
  startsOn?: string
  providedInputs: string[]
  conflictContext?: Partial<GoalConflictContext>
}

type Confirmation = {
  confirmed: boolean
  conflictChoices?: Partial<Record<GoalConflictCode, string>>
  goalPeriodId: string
  planVersionId: string
  createdAt: string
}

type ActivatedGoal = {
  history: GoalHistory
  planVersion: PlanVersion
  goalPeriod: GoalPeriod
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function nextMonday(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`)
  const weekday = value.getUTCDay()
  const daysUntilMonday = weekday === 1 ? 7 : (8 - weekday) % 7
  return addDays(date, daysUntilMonday)
}

function activePeriod(history: GoalHistory) {
  return history.periods.find((period) => period.id === history.activePeriodId) ?? null
}

function makePreviewToken(
  currentPeriodId: string | null,
  proposedGoal: GoalProfile,
  startsOn: string,
) {
  return [
    currentPeriodId ?? 'NEW',
    proposedGoal.primary,
    proposedGoal.secondary.join(','),
    startsOn,
  ].join('|')
}

function validateProfile(profile: GoalProfile) {
  if (profile.secondary.length > 2) {
    throw new Error('Sivutavoitteita voi olla korkeintaan kaksi.')
  }
  if (profile.secondary.includes(profile.primary)) {
    throw new Error('Päätavoite ei voi olla samalla sivutavoite.')
  }
}

export function previewGoalChange(
  history: GoalHistory,
  proposedGoal: GoalProfile,
  options: PreviewOptions,
): ExplainableDecision<GoalChangePreview> {
  validateProfile(proposedGoal)
  const currentPeriod = activePeriod(history)
  const currentStrategy = currentPeriod
    ? getGoalStrategy(currentPeriod.goal.primary)
    : null
  const proposedStrategy = getGoalStrategy(proposedGoal.primary)
  const provided = new Set(options.providedInputs)
  const missingInputs = proposedStrategy.requiredInputs.filter(
    (input) => !provided.has(input),
  )
  const context: GoalConflictContext = {
    primary: proposedGoal.primary,
    secondary: proposedGoal.secondary,
    ...options.conflictContext,
  }
  const conflicts = evaluateGoalConflicts(context)
  const startsOn = options.startsOn ?? nextMonday(options.today)
  const token = makePreviewToken(currentPeriod?.id ?? null, proposedGoal, startsOn)

  return {
    decision: {
      kind: 'GOAL_CHANGE_PREVIEW',
      token,
      currentGoal: currentPeriod?.goal.primary ?? null,
      proposedGoal,
      startsOn,
      transitionWeek:
        currentPeriod !== null && currentPeriod.goal.primary !== proposedGoal.primary,
      missingInputs,
      conflicts: conflicts.decision,
      comparison: {
        currentWeeklyStructure: currentStrategy?.weeklyStructure ?? null,
        proposedWeeklyStructure: proposedStrategy.weeklyStructure,
        currentNutritionFocus: currentStrategy?.nutrition.energyFocus ?? null,
        proposedNutritionFocus: proposedStrategy.nutrition.energyFocus,
        developed: proposedStrategy.metrics,
        maintained: proposedGoal.secondary.flatMap((goal) =>
          getGoalStrategy(goal).metrics.slice(0, 1),
        ),
        metrics: proposedStrategy.metrics,
      },
    },
    reasons: [
      {
        code: 'GOAL_CHANGE_PREVIEW_CREATED',
        message:
          'Uusi tavoite aktivoidaan vasta tämän vertailun ja erillisen vahvistuksen jälkeen.',
        priority: 'PRIMARY_GOAL',
      },
      ...conflicts.reasons,
    ],
    warnings: conflicts.warnings,
  }
}

export function confirmGoalChange(
  history: GoalHistory,
  preview: unknown,
  confirmation: Confirmation,
): ExplainableDecision<ActivatedGoal> {
  if (
    typeof preview !== 'object' ||
    preview === null ||
    !('kind' in preview) ||
    preview.kind !== 'GOAL_CHANGE_PREVIEW'
  ) {
    throw new Error('Tavoitteen vaihto vaatii GoalEngine-esikatselun.')
  }
  const typedPreview = preview as GoalChangePreview
  const currentPeriod = activePeriod(history)
  const expectedToken = makePreviewToken(
    currentPeriod?.id ?? null,
    typedPreview.proposedGoal,
    typedPreview.startsOn,
  )
  if (typedPreview.token !== expectedToken) {
    throw new Error('Tavoitteen vaihdon esikatselu on virheellinen tai vanhentunut.')
  }
  if (!confirmation.confirmed) {
    throw new Error('Tavoitteen vaihtoa ei ole vahvistettu.')
  }
  if (typedPreview.missingInputs.length > 0) {
    throw new Error('Tavoitekohtaisia lähtötietoja puuttuu.')
  }
  for (const conflict of typedPreview.conflicts) {
    const choice = confirmation.conflictChoices?.[conflict.code]
    if (!choice || !conflict.choices.includes(choice)) {
      throw new Error(`Konflikti ${conflict.code} vaatii käyttäjän valinnan.`)
    }
  }

  const oldActive = currentPeriod
  const planVersion: PlanVersion = {
    id: confirmation.planVersionId,
    goalPeriodId: confirmation.goalPeriodId,
    goal: typedPreview.proposedGoal,
    startsOn: typedPreview.startsOn,
    createdAt: confirmation.createdAt,
    transitionWeek: typedPreview.transitionWeek,
    strategyId: typedPreview.proposedGoal.primary,
  }
  const goalPeriod: GoalPeriod = {
    id: confirmation.goalPeriodId,
    goal: typedPreview.proposedGoal,
    startsOn: typedPreview.startsOn,
    endsOn: null,
    planVersionId: planVersion.id,
  }
  const periods = history.periods.map((period) =>
    period.id === oldActive?.id
      ? { ...period, endsOn: addDays(typedPreview.startsOn, -1) }
      : period,
  )
  periods.push(goalPeriod)

  return {
    decision: {
      history: {
        activePeriodId: goalPeriod.id,
        periods,
        planVersions: [...history.planVersions, planVersion],
      },
      planVersion,
      goalPeriod,
    },
    reasons: [
      {
        code: 'GOAL_CHANGE_CONFIRMED',
        message: `Uusi tavoite alkaa ${typedPreview.startsOn}; aiempi jakso ja historia säilyvät.`,
        priority: 'PRIMARY_GOAL',
      },
    ],
    warnings: [],
  }
}

export function previewPreviousGoalRestore(
  history: GoalHistory,
  options: Omit<PreviewOptions, 'providedInputs'>,
): ExplainableDecision<GoalChangePreview> {
  const current = activePeriod(history)
  const previous = history.periods
    .filter((period) => period.id !== current?.id)
    .sort((left, right) => right.startsOn.localeCompare(left.startsOn))
    .at(0)
  if (!previous) throw new Error('Palautettavaa aiempaa tavoiteversiota ei ole.')
  const preview = previewGoalChange(history, previous.goal, {
    ...options,
    providedInputs: getGoalStrategy(previous.goal.primary).requiredInputs,
  })
  return {
    ...preview,
    reasons: [
      {
        code: 'PREVIOUS_GOAL_RESTORE_PREVIEW',
        message:
          'Aiempi tavoite palautetaan uutena muuttumattomana versiona vasta vahvistuksen jälkeen.',
        priority: 'PRIMARY_GOAL',
      },
      ...preview.reasons,
    ],
  }
}

export const GoalEngine = {
  previewGoalChange,
  previewPreviousGoalRestore,
  confirmGoalChange,
}
