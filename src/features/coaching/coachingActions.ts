import {
  confirmGoalChange,
  approveEnergyProposal,
  evaluateNutritionPolicy,
  evaluateProgress,
  evaluateReadiness,
  generatePlan,
  getGoalStrategy,
  previewGoalChange,
  previewPreviousGoalRestore,
} from '../../domain/coaching'
import type {
  CompletedSet,
  DecisionTrace,
  ExplainableDecision,
  GoalConflictCode,
  GoalHistory,
  GoalProfile,
  NutritionInput,
  NutritionDecision,
  ReadinessInput,
  PrescribedSession,
  WorkoutFeedback,
} from '../../domain/coaching/types'
import type { LocalRecord } from '../../domain/sync/types'
import type {
  AppDataContextValue,
  GoalChangeDraft,
} from '../app-data/appDataContextValue'
import { objectValue, stringValue, toJsonObject, todayIso } from './coachingData'

export type OnboardingInput = {
  displayName: string
  age: number
  heightCm: number
  weightKg: number
  primaryGoal: GoalProfile['primary']
  secondaryGoals: GoalProfile['secondary']
  targetDate: string
  experience: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  availableDays: number[]
  minutesPerSession: number
  minutesByDay: Record<string, number>
  currentEnduranceMinutes: number
  currentWeeklyTraining: string
  enduranceSportBackground: string
  physicalLoad: 'LOW' | 'MODERATE' | 'HIGH'
  equipment: string[]
  likes: string
  dislikes: string
  sleepHours: number
  dietRestrictions: string
  trackingMode: 'PORTIONS' | 'CALORIES'
  healthConcern: boolean
  healthNotes: string
  medicationAffectsHeartRate: boolean
  pregnancyStatus:
    'NOT_APPLICABLE' | 'PREGNANT' | 'BREASTFEEDING' | 'POSTPARTUM' | 'PREFER_NOT_TO_SAY'
  doctorRestrictions: string
  currentInjuries: string
  pelvicFloorSymptoms: string
  exertionWarningSymptoms: boolean
  eatingDisorderHistory: boolean
  menstrualTrackingOptIn: boolean
  desiredMetrics: string[]
  sensitiveConsent: boolean
}

export function hasMeaningfulRestrictionText(value: string) {
  const normalized = value.trim().toLocaleLowerCase('fi-FI')
  if (!normalized) return false
  return !/^(?:-|ei|ei ole|ei mitään|ei rajoitteita|ei sairauksia|ei vammoja|terve|none)$/u.test(
    normalized,
  )
}

function birthDateFromAge(age: number) {
  return `${new Date().getFullYear() - age}-01-01`
}

function currentHistory(data: AppDataContextValue): GoalHistory {
  const planVersions = data.list('plan_versions')
  const periods = data.list('goal_periods').flatMap((record) => {
    const summary = objectValue(record.data.summary)
    const goal = objectValue(summary.goal)
    const primary = stringValue(goal.primary) as GoalProfile['primary']
    if (!primary) return []
    const plan = planVersions.find(
      (candidate) => stringValue(candidate.data.goal_period_id) === record.id,
    )
    return [
      {
        id: record.id,
        goal: {
          primary,
          secondary: Array.isArray(goal.secondary)
            ? (goal.secondary.filter(
                (value): value is GoalProfile['primary'] => typeof value === 'string',
              ) as GoalProfile['secondary'])
            : [],
          inputs: objectValue(goal.inputs),
        },
        startsOn: stringValue(record.data.starts_on, todayIso()),
        endsOn: stringValue(record.data.ends_on) || null,
        planVersionId: plan?.id ?? stringValue(summary.plan_version_id),
      },
    ]
  })
  return {
    activePeriodId:
      data.list('goal_periods').find((record) => record.data.status === 'ACTIVE')?.id ??
      null,
    periods,
    planVersions: planVersions.flatMap((record) => {
      const snapshot = objectValue(record.data.snapshot)
      const goal = objectValue(snapshot.goal)
      const primary = stringValue(goal.primary) as GoalProfile['primary']
      if (!primary) return []
      return [
        {
          id: record.id,
          goalPeriodId: stringValue(record.data.goal_period_id),
          goal: {
            primary,
            secondary: Array.isArray(goal.secondary)
              ? (goal.secondary.filter(
                  (value): value is GoalProfile['primary'] => typeof value === 'string',
                ) as GoalProfile['secondary'])
              : [],
            inputs: objectValue(goal.inputs),
          },
          startsOn: stringValue(record.data.effective_from),
          createdAt: record.createdAt,
          transitionWeek: snapshot.transition_week === true,
          strategyId: primary,
        },
      ]
    }),
  }
}

function planFromPreferences(
  goal: GoalProfile,
  preferences: OnboardingInput | Record<string, unknown>,
  healthBlocked = false,
) {
  const sportDiscipline =
    'sportDiscipline' in preferences && typeof preferences.sportDiscipline === 'string'
      ? preferences.sportDiscipline
      : undefined
  const availableDays = Array.isArray(preferences.availableDays)
    ? preferences.availableDays.filter(
        (value): value is number => typeof value === 'number',
      )
    : [1, 3, 5]
  const generated = generatePlan({
    goal,
    experience:
      preferences.experience === 'INTERMEDIATE' || preferences.experience === 'ADVANCED'
        ? preferences.experience
        : 'BEGINNER',
    availableDays,
    currentEnduranceMinutes:
      typeof preferences.currentEnduranceMinutes === 'number'
        ? preferences.currentEnduranceMinutes
        : 0,
    fixedSessions: [],
    competitions: [],
    sportDiscipline,
    equipment: Array.isArray(preferences.equipment)
      ? preferences.equipment.filter(
          (value): value is string => typeof value === 'string',
        )
      : ['Kehonpaino'],
    physicalLoad:
      preferences.physicalLoad === 'LOW' || preferences.physicalLoad === 'HIGH'
        ? preferences.physicalLoad
        : 'MODERATE',
    minutesPerSession:
      typeof preferences.minutesPerSession === 'number'
        ? preferences.minutesPerSession
        : 45,
    minutesByDay:
      'minutesByDay' in preferences &&
      typeof preferences.minutesByDay === 'object' &&
      preferences.minutesByDay !== null
        ? (preferences.minutesByDay as Record<string, number>)
        : undefined,
    likes: typeof preferences.likes === 'string' ? preferences.likes : undefined,
    dislikes: typeof preferences.dislikes === 'string' ? preferences.dislikes : undefined,
    limitations: [
      typeof preferences.currentInjuries === 'string' &&
      hasMeaningfulRestrictionText(preferences.currentInjuries)
        ? preferences.currentInjuries
        : '',
      typeof preferences.doctorRestrictions === 'string' &&
      hasMeaningfulRestrictionText(preferences.doctorRestrictions)
        ? preferences.doctorRestrictions
        : '',
    ]
      .filter(Boolean)
      .join(' · '),
    healthBlocked,
  })
  if (healthBlocked) {
    generated.decision.sessions = generated.decision.sessions
      .filter((session) => session.kind !== 'INTERVAL' && session.kind !== 'SPEED_POWER')
      .map((session) => ({
        ...session,
        intensity:
          session.intensity === 'HARD' ? ('MODERATE' as const) : session.intensity,
        notes: [
          ...(session.notes ?? []),
          'Kovatehoinen harjoittelu odottaa terveysoireen arviota.',
        ],
      }))
    generated.warnings.push(
      'Kovatehoinen harjoittelu on estetty, kunnes oire on selvitetty.',
    )
  }
  return generated
}

export async function completeOnboarding(
  data: AppDataContextValue,
  input: OnboardingInput,
) {
  const safetyReviewRequired = input.healthConcern || input.exertionWarningSymptoms
  const highIntensityBlocked =
    safetyReviewRequired ||
    hasMeaningfulRestrictionText(input.doctorRestrictions) ||
    hasMeaningfulRestrictionText(input.currentInjuries) ||
    hasMeaningfulRestrictionText(input.pelvicFloorSymptoms) ||
    input.pregnancyStatus === 'PREGNANT' ||
    input.pregnancyStatus === 'POSTPARTUM'
  const goal: GoalProfile = {
    primary: input.primaryGoal,
    secondary: input.secondaryGoals,
    inputs: toJsonObject(input),
  }
  const goalPeriodId = crypto.randomUUID()
  const planVersionId = crypto.randomUUID()
  const preview = previewGoalChange(
    { activePeriodId: null, periods: [], planVersions: [] },
    goal,
    {
      today: todayIso(),
      providedInputs: getGoalStrategy(goal.primary).requiredInputs,
    },
  )
  const activation = confirmGoalChange(
    { activePeriodId: null, periods: [], planVersions: [] },
    preview.decision,
    {
      confirmed: true,
      goalPeriodId,
      planVersionId,
      createdAt: new Date().toISOString(),
    },
  )
  const plan = planFromPreferences(goal, input, highIntensityBlocked)
  const profileId = crypto.randomUUID()
  const goalProfileId = crypto.randomUUID()
  const consentAt = input.sensitiveConsent ? new Date().toISOString() : null

  const profilePayload = toJsonObject({
    display_name: input.displayName,
    locale: 'fi-FI',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Helsinki',
    birth_date: birthDateFromAge(input.age),
    height_cm: input.heightCm,
    weight_kg: input.weightKg,
    onboarding_completed: false,
    sensitive_data_consent_at: consentAt,
    app_settings: {
      availableDays: input.availableDays,
      minutesPerSession: input.minutesPerSession,
      minutesByDay: input.minutesByDay,
      currentEnduranceMinutes: input.currentEnduranceMinutes,
      experience: input.experience,
      currentWeeklyTraining: input.currentWeeklyTraining,
      enduranceSportBackground: input.enduranceSportBackground,
      physicalLoad: input.physicalLoad,
      equipment: input.equipment,
      desiredMetrics: input.desiredMetrics,
      trackingMode: input.trackingMode,
      likes: input.likes,
      dislikes: input.dislikes,
      sleepHours: input.sleepHours,
      dietRestrictions: input.dietRestrictions,
      menstrualTrackingOptIn: input.menstrualTrackingOptIn,
      medicationAffectsHeartRate: input.medicationAffectsHeartRate,
      eatingDisorderHistory: input.eatingDisorderHistory,
    },
  })
  const existingProfile = data.latest('profiles')
  const profileRecord = existingProfile
    ? await data.update(existingProfile, profilePayload)
    : await data.create('profiles', profilePayload, profileId)
  if (input.sensitiveConsent) {
    await data.create(
      'health_screenings',
      toJsonObject({
        screened_on: todayIso(),
        status: safetyReviewRequired
          ? 'NEEDS_REVIEW'
          : highIntensityBlocked
            ? 'HIGH_INTENSITY_BLOCKED'
            : 'CLEAR',
        answers: {
          health_notes: input.healthNotes,
          medication_affects_heart_rate: input.medicationAffectsHeartRate,
          pregnancy_status: input.pregnancyStatus,
          doctor_restrictions: input.doctorRestrictions,
          current_injuries_surgeries_and_mobility_limits: input.currentInjuries,
          pelvic_floor_symptoms: input.pelvicFloorSymptoms,
          exertion_warning_symptoms: input.exertionWarningSymptoms,
          eating_disorder_history: input.eatingDisorderHistory,
          menstrual_tracking_opt_in: input.menstrualTrackingOptIn,
        },
        consent_at: consentAt,
        consent: {
          version: 'health-personalisation-v1',
          purpose: 'Turvallisen ja yksilöllisen harjoitusohjelman muodostaminen',
          categories: [
            'terveysseulonta',
            'vammat ja rajoitteet',
            'palautumiseen vaikuttavat terveystiedot',
          ],
          withdrawn_at: null,
        },
      }),
    )
  }
  await data.create(
    'goal_profiles',
    toJsonObject({
      primary_goal: goal.primary,
      secondary_goals: goal.secondary,
      target_date: input.targetDate || null,
      preferences: input,
    }),
    goalProfileId,
  )
  await data.create(
    'goal_periods',
    toJsonObject({
      goal_profile_id: goalProfileId,
      starts_on: activation.decision.goalPeriod.startsOn,
      ends_on: null,
      status: 'ACTIVE',
      summary: {
        goal,
        plan_version_id: planVersionId,
        warnings: plan.warnings,
      },
    }),
    goalPeriodId,
  )
  await data.create(
    'plan_versions',
    toJsonObject({
      goal_period_id: goalPeriodId,
      previous_plan_version_id: null,
      version_number: 1,
      effective_from: activation.decision.planVersion.startsOn,
      change_reason: 'Aloituskartoitus',
      snapshot: { ...activation.decision.planVersion, plan: plan.decision },
    }),
    planVersionId,
  )
  await data.create(
    'training_plans',
    toJsonObject({
      plan_version_id: planVersionId,
      week_count: 4,
      status: 'ACTIVE',
      plan: plan.decision,
    }),
  )
  await data.update(profileRecord, toJsonObject({ onboarding_completed: true }))
}

export function createGoalChangeDraft(
  data: AppDataContextValue,
  profile: GoalProfile,
): GoalChangeDraft {
  const preview = previewGoalChange(currentHistory(data), profile, {
    today: todayIso(),
    providedInputs: getGoalStrategy(profile.primary).requiredInputs,
    conflictContext: {
      maximalMuscleGainRequested:
        profile.primary === 'MUSCLE_GAIN' || profile.secondary.includes('MUSCLE_GAIN'),
    },
  })
  return { profile, preview: preview.decision }
}

export function createPreviousGoalRestoreDraft(
  data: AppDataContextValue,
): GoalChangeDraft {
  const preview = previewPreviousGoalRestore(currentHistory(data), { today: todayIso() })
  return { profile: preview.decision.proposedGoal, preview: preview.decision }
}

export async function activateGoalDraft(
  data: AppDataContextValue,
  draft: GoalChangeDraft,
  conflictChoices: Partial<Record<GoalConflictCode, string>>,
) {
  const history = currentHistory(data)
  const goalPeriodId = crypto.randomUUID()
  const planVersionId = crypto.randomUUID()
  const activation = confirmGoalChange(history, draft.preview, {
    confirmed: true,
    conflictChoices,
    goalPeriodId,
    planVersionId,
    createdAt: new Date().toISOString(),
  })
  const profileRecord = data.latest('profiles')
  const settings = profileRecord ? objectValue(profileRecord.data.app_settings) : {}
  const screeningStatus = stringValue(data.latest('health_screenings')?.data.status)
  const plan = planFromPreferences(
    draft.profile,
    settings,
    screeningStatus === 'HIGH_INTENSITY_BLOCKED' || screeningStatus === 'NEEDS_REVIEW',
  )
  const previousPeriod = data
    .list('goal_periods')
    .find((record) => record.data.status === 'ACTIVE')
  if (previousPeriod) {
    await data.update(
      previousPeriod,
      toJsonObject({
        status: 'COMPLETED',
        ends_on: activation.decision.history.periods.at(-2)?.endsOn,
      }),
    )
  }
  const goalProfileId = crypto.randomUUID()
  await data.create(
    'goal_profiles',
    toJsonObject({
      primary_goal: draft.profile.primary,
      secondary_goals: draft.profile.secondary,
      target_date: null,
      preferences: draft.profile.inputs,
    }),
    goalProfileId,
  )
  await data.create(
    'goal_periods',
    toJsonObject({
      goal_profile_id: goalProfileId,
      starts_on: activation.decision.goalPeriod.startsOn,
      ends_on: null,
      status: 'ACTIVE',
      summary: { goal: draft.profile, plan_version_id: planVersionId },
    }),
    goalPeriodId,
  )
  await data.create(
    'plan_versions',
    toJsonObject({
      goal_period_id: goalPeriodId,
      previous_plan_version_id: history.planVersions.at(-1)?.id ?? null,
      version_number: history.planVersions.length + 1,
      effective_from: activation.decision.planVersion.startsOn,
      change_reason: 'Käyttäjän vahvistama tavoitteen vaihto',
      snapshot: { ...activation.decision.planVersion, plan: plan.decision },
    }),
    planVersionId,
  )
  await data.create(
    'training_plans',
    toJsonObject({
      plan_version_id: planVersionId,
      week_count: 4,
      status: 'ACTIVE',
      plan: plan.decision,
    }),
  )
}

export async function saveDailyCheckIn(data: AppDataContextValue, input: ReadinessInput) {
  const result = evaluateReadiness(input)
  const existing = data
    .list('daily_checkins')
    .find((record) => record.data.checkin_date === todayIso())
  const payload = toJsonObject({
    checkin_date: todayIso(),
    readiness: result.decision.state,
    answers: { ...input, recommendation: result.decision },
    reasons: result.reasons.map((reason) => reason.message),
  })
  if (existing) await data.update(existing, payload)
  else await data.create('daily_checkins', payload)
  return result
}

export async function logWorkout(
  data: AppDataContextValue,
  input: {
    workoutId?: string
    durationMinutes: number
    rpe: number
    notes: string
    feedback?: WorkoutFeedback
    decisionTrace?: DecisionTrace
  },
) {
  return data.create(
    'workout_logs',
    toJsonObject({
      workout_id: input.workoutId ?? null,
      performed_at: new Date().toISOString(),
      duration_minutes: input.durationMinutes,
      rpe: input.rpe,
      notes: input.notes,
      completion_status: input.feedback?.completionStatus ?? 'COMPLETED',
      feedback: input.feedback ?? {},
      decision_trace: input.decisionTrace ?? {},
    }),
  )
}

export async function startWorkout(
  data: AppDataContextValue,
  input: {
    title: string
    durationMinutes: number
    intensity: string
    variants: unknown
    prescription: PrescribedSession
  },
) {
  const existing = data
    .list('workouts')
    .find(
      (record) =>
        stringValue(record.data.scheduled_for).slice(0, 10) === todayIso() &&
        record.data.status === 'PLANNED',
    )
  if (existing) {
    const saved = objectValue(existing.data.prescription)
    if (typeof saved.id !== 'string') {
      await data.update(
        existing,
        toJsonObject({
          prescription: input.prescription,
          decision_trace: input.prescription.decisionTrace,
        }),
      )
    }
    await ensureWorkoutExercises(data, existing.id, input.prescription)
    await ensureActiveWorkoutLog(data, existing.id, input.prescription.decisionTrace)
    return existing
  }
  const trainingPlan = data.latest('training_plans')
  const workout = await data.create(
    'workouts',
    toJsonObject({
      training_plan_id: trainingPlan?.id ?? null,
      workout_template_id: null,
      scheduled_for: new Date().toISOString(),
      title: input.title,
      duration_minutes: Math.max(5, input.durationMinutes),
      intensity: input.intensity === 'RECOVERY' ? 'RECOVERY' : input.intensity,
      status: 'PLANNED',
      variants: input.variants,
      prescription: input.prescription,
      decision_trace: input.prescription.decisionTrace,
    }),
  )
  await ensureWorkoutExercises(data, workout.id, input.prescription)
  await ensureActiveWorkoutLog(data, workout.id, input.prescription.decisionTrace)
  return workout
}

async function ensureActiveWorkoutLog(
  data: AppDataContextValue,
  workoutId: string,
  decisionTrace: DecisionTrace,
) {
  const existing = data
    .list('workout_logs')
    .find(
      (record) =>
        record.data.workout_id === workoutId &&
        record.data.completion_status === 'IN_PROGRESS',
    )
  if (existing) return existing
  return data.create(
    'workout_logs',
    toJsonObject({
      workout_id: workoutId,
      performed_at: new Date().toISOString(),
      duration_minutes: null,
      rpe: null,
      notes: null,
      completion_status: 'IN_PROGRESS',
      feedback: {},
      decision_trace: decisionTrace,
    }),
  )
}

async function ensureWorkoutExercises(
  data: AppDataContextValue,
  workoutId: string,
  prescription: PrescribedSession,
) {
  const existingOrdinals = new Set(
    data
      .list('workout_exercises')
      .filter((record) => record.data.workout_id === workoutId)
      .map((record) => record.data.ordinal),
  )
  for (const [index, exercise] of prescription.exercises.entries()) {
    const ordinal = index + 1
    if (existingOrdinals.has(ordinal)) continue
    await data.create(
      'workout_exercises',
      toJsonObject({
        workout_id: workoutId,
        exercise_id: null,
        ordinal,
        prescription: exercise,
      }),
    )
  }
}

function completedSetOrdinal(prescription: PrescribedSession, set: CompletedSet) {
  let ordinal = set.setNumber
  for (const exercise of prescription.exercises) {
    if (exercise.id === set.exerciseId) return ordinal
    ordinal += exercise.sets
  }
  return ordinal
}

export async function saveWorkoutSet(
  data: AppDataContextValue,
  workout: LocalRecord,
  prescription: PrescribedSession,
  set: CompletedSet,
) {
  const workoutLog = await ensureActiveWorkoutLog(
    data,
    workout.id,
    prescription.decisionTrace,
  )
  const ordinal = completedSetOrdinal(prescription, set)
  const exerciseOrdinal = prescription.exercises.findIndex(
    (exercise) => exercise.id === set.exerciseId,
  )
  const prescribedExercise = prescription.exercises[exerciseOrdinal]
  const workoutExercise = data
    .list('workout_exercises')
    .find(
      (record) =>
        record.data.workout_id === workout.id &&
        record.data.ordinal === exerciseOrdinal + 1,
    )
  const payload = toJsonObject({
    workout_log_id: workoutLog.id,
    workout_exercise_id: workoutExercise?.id,
    ordinal,
    repetitions: set.repetitions,
    load_kg: set.loadKg,
    rir: null,
    data: {
      exercise_id: set.exerciseId,
      set_number: set.setNumber,
      completed: set.completed,
      load_text: set.loadText ?? null,
      load_type: prescribedExercise?.loadType ?? 'NONE',
      exercise_code: prescribedExercise?.code ?? '',
    },
  })
  const existing = data
    .list('exercise_set_logs')
    .find(
      (record) =>
        record.data.workout_log_id === workoutLog.id && record.data.ordinal === ordinal,
    )
  return existing
    ? data.update(existing, payload)
    : data.create('exercise_set_logs', payload)
}

export async function completeWorkout(
  data: AppDataContextValue,
  workout: LocalRecord,
  input: {
    durationMinutes: number
    feedback: WorkoutFeedback
    sets: CompletedSet[]
    prescription: PrescribedSession
  },
) {
  for (const set of input.sets) {
    await saveWorkoutSet(data, workout, input.prescription, set)
  }
  const draft = data
    .list('workout_logs')
    .find(
      (record) =>
        record.data.workout_id === workout.id &&
        record.data.completion_status === 'IN_PROGRESS',
    )
  const finalPayload = toJsonObject({
    workout_id: workout.id,
    performed_at: new Date().toISOString(),
    duration_minutes: input.durationMinutes,
    rpe: input.feedback.sessionRpe,
    notes: input.feedback.notes,
    completion_status: input.feedback.completionStatus,
    feedback: input.feedback,
    decision_trace: input.prescription.decisionTrace,
  })
  const workoutLog = draft
    ? await data.update(draft, finalPayload)
    : await data.create('workout_logs', finalPayload)
  await data.update(workout, toJsonObject({ status: 'COMPLETED' }))
  return workoutLog
}

export async function logNutrition(
  data: AppDataContextValue,
  input: NutritionInput & {
    trackingMode: 'PORTIONS' | 'CALORIES'
    energyKcal?: number
    proteinG?: number
    meals: string[]
  },
) {
  const policy = evaluateNutritionPolicy(input)
  await data.create(
    'nutrition_logs',
    toJsonObject({
      logged_at: new Date().toISOString(),
      tracking_mode: input.trackingMode,
      energy_kcal: input.energyKcal ?? null,
      protein_g: input.proteinG ?? null,
      carbohydrate_g: null,
      fat_g: null,
      meals: input.meals,
    }),
  )
  return policy
}

export function approveNutritionProposal(
  proposal: ExplainableDecision<NutritionDecision>,
  approved: boolean,
) {
  return approveEnergyProposal(proposal, approved)
}

export async function addBodyMetric(
  data: AppDataContextValue,
  input: { weightKg?: number; waistCm?: number },
) {
  return data.create(
    'body_metrics',
    toJsonObject({
      measured_on: todayIso(),
      weight_kg: input.weightKg ?? null,
      waist_cm: input.waistCm ?? null,
      body_fat_percent: null,
      measurements: {},
    }),
  )
}

export async function addFixedSportSession(
  data: AppDataContextValue,
  input: {
    sportCode: string
    startsAt: string
    durationMinutes: number
    rpe: number
    coachDefined: boolean
  },
) {
  let sportProfile = [...data.list('sport_profiles')]
    .reverse()
    .find((record) => record.data.sport_code === input.sportCode)
  if (!sportProfile) {
    sportProfile = await data.create(
      'sport_profiles',
      toJsonObject({
        sport_code: input.sportCode,
        subtype: input.sportCode,
        priority: 'SUPPORT',
        experience_years: null,
        demand_profile: {},
        settings: {},
      }),
    )
  }
  return data.create(
    'fixed_sport_sessions',
    toJsonObject({
      sport_profile_id: sportProfile.id,
      starts_at: new Date(input.startsAt).toISOString(),
      duration_minutes: input.durationMinutes,
      rpe: input.rpe,
      coach_defined: input.coachDefined,
      session_data: { sport_code: input.sportCode },
    }),
  )
}

export async function addCompetition(
  data: AppDataContextValue,
  input: { name: string; startsAt: string; priority: 'A' | 'B' | 'TRAINING' },
) {
  return data.create(
    'competition_events',
    toJsonObject({
      sport_profile_id: data.latest('sport_profiles')?.id ?? null,
      name: input.name,
      starts_at: new Date(input.startsAt).toISOString(),
      priority: input.priority,
      details: {},
    }),
  )
}

export function activeTrainingPlan(data: AppDataContextValue) {
  const plans = data.list('training_plans')
  const active = [...plans].reverse().find((record) => record.data.status === 'ACTIVE')
  return active ? objectValue(active.data.plan) : null
}

export function activeGoalRecord(data: AppDataContextValue): LocalRecord | null {
  return [...data.list('goal_profiles')].reverse().at(0) ?? null
}

export function evaluateWeightProgress(data: AppDataContextValue) {
  const weights = data
    .list('body_metrics')
    .map((record) => ({
      value:
        typeof record.data.weight_kg === 'number' ? record.data.weight_kg : Number.NaN,
      date: stringValue(record.data.measured_on, record.createdAt.slice(0, 10)),
    }))
    .filter((item) => Number.isFinite(item.value))
    .slice(-4)
  const midpoint = Math.floor(weights.length / 2)
  const groups = [weights.slice(0, midpoint), weights.slice(midpoint)].filter(
    (group) => group.length > 0,
  )
  return evaluateProgress(
    groups.map((group) => ({
      label: `${group[0]?.date ?? ''}–${group.at(-1)?.date ?? ''}`,
      comparable: true,
      metricValue: group.reduce((sum, item) => sum + item.value, 0) / group.length,
      dataPoints: group.length,
    })),
    { higherIsBetter: false, minimumDataPoints: 2 },
  )
}
