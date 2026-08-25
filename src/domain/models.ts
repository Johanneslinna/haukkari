import type {
  ExplainableDecision,
  GoalConflict,
  GoalPeriod,
  GoalProfile,
  GoalStrategy,
  GoalType,
  PlanVersion,
  ReadinessDecision,
  SportAdapter,
  SportDemandProfile,
  TrainingPlan,
  WorkoutVariant,
} from './coaching/types'
import type { JsonObject, SyncableTable } from './sync/types'

export type EntityId = string
export type IsoDate = string
export type IsoDateTime = string

export type VersionedUserEntity = {
  id: EntityId
  userId: EntityId
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
  deletedAt: IsoDateTime | null
  version: number
}

export type AppSettings = {
  locale: 'fi-FI'
  timezone: string
  theme: 'LIGHT' | 'DARK' | 'SYSTEM'
  availableDays: number[]
  minutesPerSession: number
  trackingMode: 'PORTIONS' | 'CALORIES'
  menstrualTrackingOptIn: boolean
  desiredMetrics: string[]
}

export type UserProfile = VersionedUserEntity & {
  displayName: string | null
  birthDate: IsoDate | null
  heightCm: number | null
  weightKg: number | null
  onboardingCompleted: boolean
  sensitiveDataConsentAt: IsoDateTime | null
  settings: AppSettings
}

export type HealthScreening = VersionedUserEntity & {
  screenedOn: IsoDate
  status: 'CLEAR' | 'HIGH_INTENSITY_BLOCKED' | 'NEEDS_REVIEW'
  answers: JsonObject
  consentAt: IsoDateTime
}

export type GoalMetric = {
  code: string
  label: string
  unit: string | null
  higherIsBetter: boolean
}

export type Exercise = {
  id: EntityId
  nameFi: string
  movementPattern: string
  equipment: string[]
  contraindications: string[]
}

export type ExerciseSubstitution = {
  exerciseId: EntityId
  substituteExerciseId: EntityId
  reason: string
  preservesMovementPattern: boolean
}

export type WorkoutTemplate = VersionedUserEntity & {
  name: string
  goal: GoalType
  exercises: EntityId[]
  variants: WorkoutVariant[]
}

export type SportProfile = VersionedUserEntity & {
  sportCode: string
  subtype: string
  level: string | null
  experienceYears: number | null
  demandProfile: SportDemandProfile
  settings: JsonObject
}

export type CompetitionEvent = VersionedUserEntity & {
  sportProfileId: EntityId | null
  name: string
  startsAt: IsoDateTime
  priority: 'A' | 'B' | 'TRAINING'
}

export type FixedTrainingSession = VersionedUserEntity & {
  sportProfileId: EntityId
  startsAt: IsoDateTime
  durationMinutes: number
  rpe: number
  coachDefined: boolean
}

export type BaselineTest = VersionedUserEntity & {
  testedOn: IsoDate
  testType: string
  result: JsonObject
}

export type DailyCheckIn = VersionedUserEntity & {
  checkInDate: IsoDate
  answers: JsonObject
  decision: ExplainableDecision<ReadinessDecision>
}

export type WorkoutLog = VersionedUserEntity & {
  workoutId: EntityId | null
  performedAt: IsoDateTime
  durationMinutes: number
  rpe: number
  notes: string
}

export type ExerciseSetLog = VersionedUserEntity & {
  workoutLogId: EntityId
  workoutExerciseId: EntityId
  setNumber: number
  repetitions: number | null
  loadKg: number | null
  rir: number | null
}

export type RunLog = VersionedUserEntity & {
  workoutLogId: EntityId | null
  startedAt: IsoDateTime
  distanceMeters: number
  durationSeconds: number
  averageHeartRate: number | null
}

export type NutritionLog = VersionedUserEntity & {
  loggedAt: IsoDateTime
  trackingMode: 'PORTIONS' | 'CALORIES'
  energyKcal: number | null
  proteinGrams: number | null
  meals: JsonObject[]
}

export type BodyMetric = VersionedUserEntity & {
  measuredOn: IsoDate
  weightKg: number | null
  waistCm: number | null
  bodyFatPercent: number | null
  measurements: JsonObject
}

export type Reassessment = VersionedUserEntity & {
  assessedOn: IsoDate
  result: JsonObject
}

export type Reminder = VersionedUserEntity & {
  title: string
  channel: 'IN_APP' | 'PUSH' | 'CALENDAR'
  localTime: string
  timezone: string
  weekdays: number[]
  enabled: boolean
}

export type PushSubscription = VersionedUserEntity & {
  deviceKey: string
  endpoint: string
  expiresAt: IsoDateTime | null
}

export type SyncDevice = VersionedUserEntity & {
  deviceKey: string
  displayName: string
  lastPulledAt: IsoDateTime | null
  lastPulledId: EntityId | null
  lastSeenAt: IsoDateTime | null
}

export type SyncConflict = VersionedUserEntity & {
  entityTable: SyncableTable
  entityId: EntityId
  localVersion: number
  remoteVersion: number
  localSnapshot: JsonObject
  remoteSnapshot: JsonObject
  resolution: JsonObject | null
  status: 'OPEN' | 'RESOLVED'
}

export type {
  GoalConflict,
  GoalPeriod,
  GoalProfile,
  GoalStrategy,
  GoalType,
  PlanVersion,
  ReadinessDecision,
  SportAdapter,
  SportDemandProfile,
  TrainingPlan,
  WorkoutVariant,
}
