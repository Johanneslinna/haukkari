import { z } from 'zod'

const ruleStatus = z.enum(['DRAFT', 'REVIEWED', 'PUBLISHED', 'RETIRED'])
const claimStatus = z.enum([
  'DRAFT',
  'PUBLISHED_INTERNAL',
  'PUBLISHED_REVIEWED',
  'RETIRED',
])
const pair = z.tuple([z.number(), z.number()]).refine(([min, max]) => min <= max, {
  message: 'Alarajan pitää olla enintään yläraja.',
})

export const releaseSchema = z.object({
  releaseId: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/u),
  publishedAt: z.iso.datetime(),
  status: z.enum(['DRAFT', 'INTERNAL_BETA', 'PUBLIC', 'RETIRED']),
  immutable: z.boolean(),
  minimumAge: z.number().int().min(18),
  supportedSessionKinds: z.array(z.string()).min(1),
  unsupportedSessionKinds: z.array(z.string()),
  schemaVersions: z.object({
    sources: z.number().int().positive(),
    claims: z.number().int().positive(),
    rules: z.number().int().positive(),
    exercises: z.number().int().positive(),
    substitutions: z.number().int().positive(),
  }),
  contentDigest: z.string().min(1),
})

export const evidenceSourceSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    'POSITION_STAND',
    'CONSENSUS',
    'SYSTEMATIC_REVIEW',
    'META_ANALYSIS',
    'RANDOMIZED_TRIAL',
    'EXPERT_POLICY',
  ]),
  title: z.string().min(1),
  authors: z.array(z.string()).optional(),
  year: z.number().int().min(1900).max(2200),
  doi: z.string().min(1).optional(),
  pmid: z.string().regex(/^\d+$/u).optional(),
  organization: z.string().min(1).optional(),
  status: z.enum(['ACTIVE', 'SUPERSEDED', 'RETIRED']),
})

export const evidenceClaimSchema = z.object({
  id: z.string().min(1),
  population: z.object({
    minimumAge: z.number().int().optional(),
    maximumAge: z.number().int().optional(),
    trainingStatus: z.array(z.string()).optional(),
    healthStatus: z.array(z.string()).optional(),
    sportCodes: z.array(z.string()).optional(),
    sexApplicability: z.array(z.string()).optional(),
  }),
  intervention: z.string().min(1),
  comparator: z.string().min(1).optional(),
  outcomes: z.array(z.string().min(1)).min(1),
  context: z.array(z.string().min(1)).min(1),
  doseEnvelope: z
    .object({
      sessionsPerWeek: pair.optional(),
      setsPerExercise: pair.optional(),
      repetitions: pair.optional(),
      percent1Rm: pair.optional(),
      targetRir: pair.optional(),
      durationMinutes: pair.optional(),
    })
    .optional(),
  certainty: z.enum(['HIGH', 'MODERATE', 'LOW', 'VERY_LOW']),
  directness: z.enum(['DIRECT', 'ADJACENT', 'INDIRECT']),
  recommendationStrength: z.enum(['STRONG', 'CONDITIONAL', 'EXPERT_POLICY']),
  sourceIds: z.array(z.string()).min(1),
  technicalValidation: z.enum(['PENDING', 'PASSED', 'FAILED']),
  scientificReview: z.enum(['PENDING_HUMAN_REVIEW', 'HUMAN_REVIEWED']),
  reviewedBy: z.array(z.string()),
  reviewedAt: z.iso.datetime().optional(),
  status: claimStatus,
  version: z.string().min(1),
})

export const prescriptionRuleSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  claimIds: z.array(z.string()).min(1),
  populationPredicate: z.string().min(1),
  goalPredicate: z.string().min(1),
  action: z.string().min(1),
  safetyClass: z.enum(['PROCEED', 'MODIFY', 'STOP', 'REFER']),
  policyBasis: z.enum(['EVIDENCE', 'PRODUCT_POLICY']),
  status: ruleStatus,
})

const score = z.number().int().min(1).max(5)
export const exerciseSchema = z.object({
  id: z.string().min(1),
  code: z.string().regex(/^[A-Z0-9_]+$/u),
  version: z.string().min(1),
  nameFi: z.string().min(1),
  method: z.enum([
    'RESISTANCE',
    'AEROBIC',
    'INTERVAL',
    'SPRINT',
    'PLYOMETRIC',
    'CHANGE_OF_DIRECTION',
    'MOBILITY',
    'SPORT_SKILL',
  ]),
  movementPatterns: z.array(z.string()).min(1),
  primaryMuscles: z.array(z.string()).min(1),
  secondaryMuscles: z.array(z.string()),
  equipment: z.array(z.string()),
  environments: z.array(z.string()).min(1),
  unilateral: z.boolean(),
  technicalComplexity: score,
  minimumExperience: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  supervisionRequirement: z.enum(['NONE', 'RECOMMENDED', 'REQUIRED']),
  minimumAge: z.number().int().optional(),
  maximumAge: z.number().int().optional(),
  loadTypes: z.array(z.string()).min(1),
  fatigue: z.object({
    systemic: score,
    local: score,
    neural: score,
    eccentric: score,
    sorenessRisk: score,
  }),
  contraindicationTags: z.array(z.string()),
  prerequisiteTags: z.array(z.string()),
  regressionCodes: z.array(z.string()),
  progressionCodes: z.array(z.string()),
  substitutionCodes: z.array(z.string()),
  adaptationTargets: z.array(z.string()).min(1),
  sportTags: z.array(z.string()),
  positionTags: z.array(z.string()),
  evidenceClaimIds: z.array(z.string()).min(1),
  instructionsFi: z.array(z.string().min(1)).min(1),
  status: z.enum(['DRAFT', 'PUBLISHED', 'RETIRED']),
})

export const substitutionSchema = z.object({
  fromCode: z.string().min(1),
  toCodes: z.array(z.string().min(1)).min(1),
})

export const packageSchema = z.object({
  release: releaseSchema,
  sources: z.array(evidenceSourceSchema),
  claims: z.array(evidenceClaimSchema),
  rules: z.array(prescriptionRuleSchema),
  exercises: z.array(exerciseSchema),
  substitutions: z.array(substitutionSchema),
})
