import { trainingContentV1 } from './generatedContentV1'

export type EvidenceSource = {
  id: string
  type:
    | 'POSITION_STAND'
    | 'CONSENSUS'
    | 'SYSTEMATIC_REVIEW'
    | 'META_ANALYSIS'
    | 'RANDOMIZED_TRIAL'
    | 'EXPERT_POLICY'
  title: string
  authors?: readonly string[]
  year: number
  doi?: string
  pmid?: string
  organization?: string
  status: 'ACTIVE' | 'SUPERSEDED' | 'RETIRED'
}

export type EvidenceClaim = {
  id: string
  population: {
    readonly minimumAge?: number
    readonly maximumAge?: number
    readonly trainingStatus?: readonly string[]
    readonly healthStatus?: readonly string[]
    readonly sportCodes?: readonly string[]
    readonly sexApplicability?: readonly string[]
  }
  intervention: string
  comparator?: string
  outcomes: readonly string[]
  context: readonly string[]
  doseEnvelope?: {
    readonly sessionsPerWeek?: readonly [number, number]
    readonly setsPerExercise?: readonly [number, number]
    readonly repetitions?: readonly [number, number]
    readonly percent1Rm?: readonly [number, number]
    readonly targetRir?: readonly [number, number]
    readonly durationMinutes?: readonly [number, number]
  }
  certainty: 'HIGH' | 'MODERATE' | 'LOW' | 'VERY_LOW'
  directness: 'DIRECT' | 'ADJACENT' | 'INDIRECT'
  recommendationStrength: 'STRONG' | 'CONDITIONAL' | 'EXPERT_POLICY'
  sourceIds: readonly string[]
  technicalValidation: 'PENDING' | 'PASSED' | 'FAILED'
  scientificReview: 'PENDING_HUMAN_REVIEW' | 'HUMAN_REVIEWED'
  reviewedBy: readonly string[]
  reviewedAt?: string
  status: 'DRAFT' | 'PUBLISHED_INTERNAL' | 'PUBLISHED_REVIEWED' | 'RETIRED'
  version: string
}

export type PrescriptionRule = {
  id: string
  claimIds: readonly string[]
  version: string
  populationPredicate: string
  goalPredicate: string
  action: string
  safetyClass: 'PROCEED' | 'MODIFY' | 'STOP' | 'REFER'
  policyBasis: 'EVIDENCE' | 'PRODUCT_POLICY'
  status: 'DRAFT' | 'REVIEWED' | 'PUBLISHED' | 'RETIRED'
}

export type ExerciseDefinition = {
  id: string
  code: string
  version: string
  nameFi: string
  method:
    | 'RESISTANCE'
    | 'AEROBIC'
    | 'INTERVAL'
    | 'SPRINT'
    | 'PLYOMETRIC'
    | 'CHANGE_OF_DIRECTION'
    | 'MOBILITY'
    | 'SPORT_SKILL'
  movementPatterns: readonly string[]
  primaryMuscles: readonly string[]
  secondaryMuscles: readonly string[]
  equipment: readonly string[]
  environments: readonly string[]
  unilateral: boolean
  technicalComplexity: 1 | 2 | 3 | 4 | 5
  minimumExperience: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  supervisionRequirement: 'NONE' | 'RECOMMENDED' | 'REQUIRED'
  minimumAge?: number
  maximumAge?: number
  loadTypes: readonly string[]
  fatigue: {
    readonly systemic: 1 | 2 | 3 | 4 | 5
    readonly local: 1 | 2 | 3 | 4 | 5
    readonly neural: 1 | 2 | 3 | 4 | 5
    readonly eccentric: 1 | 2 | 3 | 4 | 5
    readonly sorenessRisk: 1 | 2 | 3 | 4 | 5
  }
  contraindicationTags: readonly string[]
  prerequisiteTags: readonly string[]
  regressionCodes: readonly string[]
  progressionCodes: readonly string[]
  substitutionCodes: readonly string[]
  adaptationTargets: readonly string[]
  sportTags: readonly string[]
  positionTags: readonly string[]
  evidenceClaimIds: readonly string[]
  instructionsFi: readonly string[]
  status: 'DRAFT' | 'PUBLISHED' | 'RETIRED'
}

export interface ExerciseCatalog {
  getReleaseId(): string
  getExercise(code: string): ExerciseDefinition | null
  listExercises(): readonly ExerciseDefinition[]
  listPublishedRules(): readonly PrescriptionRule[]
  listPublishedClaims(): readonly EvidenceClaim[]
}

export class InMemoryExerciseCatalog implements ExerciseCatalog {
  private readonly releaseId: string
  private readonly exercises: readonly ExerciseDefinition[]
  private readonly rules: readonly PrescriptionRule[]
  private readonly claims: readonly EvidenceClaim[]

  constructor(
    releaseId: string,
    exercises: readonly ExerciseDefinition[],
    rules: readonly PrescriptionRule[] = [],
    claims: readonly EvidenceClaim[] = [],
  ) {
    this.releaseId = releaseId
    this.exercises = exercises
    this.rules = rules
    this.claims = claims
  }

  getReleaseId() {
    return this.releaseId
  }

  getExercise(code: string) {
    return this.exercises.find((exercise) => exercise.code === code) ?? null
  }

  listExercises() {
    return this.exercises
  }

  listPublishedRules() {
    return this.rules.filter((rule) => rule.status === 'PUBLISHED')
  }

  listPublishedClaims() {
    return this.claims.filter(
      (claim) =>
        claim.status === 'PUBLISHED_INTERNAL' || claim.status === 'PUBLISHED_REVIEWED',
    )
  }
}

export const publishedExerciseCatalog: ExerciseCatalog = new InMemoryExerciseCatalog(
  trainingContentV1.release.releaseId,
  trainingContentV1.exercises as readonly ExerciseDefinition[],
  trainingContentV1.rules as readonly PrescriptionRule[],
  trainingContentV1.claims as readonly EvidenceClaim[],
)

export const TRAINING_CONTENT_RELEASE = trainingContentV1.release
