import type { ExerciseLoadType, VerifiedNextLoad } from './types'

export const VERIFIED_NEXT_LOAD_POLICY_VERSION = 'verified-next-load-1.0.0'

export type VerifiedNextLoadIdentity = {
  exerciseCode: string
  exerciseVersion: string
  loadType: ExerciseLoadType
  loadContextId: string | undefined
  currentLoadKg: number
}

export type VerifiedNextLoadAuthorizationContext = {
  /** Hetki, jolloin kuormannostopäätös muodostetaan. */
  evaluatedAt: string
  /** Uusimman päätöstä tukevan harjoituskerran ajankohta. */
  supportingEvidenceAt: string
}

export type VerifyNextLoadResult =
  | { ok: true; confirmation: VerifiedNextLoad }
  | {
      ok: false
      reasonCode:
        | 'KILOGRAM_LOAD_REQUIRED'
        | 'EXERCISE_IDENTITY_REQUIRED'
        | 'EXERCISE_VERSION_REQUIRED'
        | 'LOAD_CONTEXT_REQUIRED'
        | 'CURRENT_LOAD_INVALID'
        | 'NEXT_LOAD_INVALID'
        | 'NEXT_LOAD_NOT_GREATER'
        | 'NEXT_LOAD_EXCEEDS_TEN_PERCENT'
        | 'CONFIRMATION_TIME_INVALID'
      messageFi: string
    }

const MAX_AUTOMATIC_INCREASE_RATIO = 0.1
const NUMBER_TOLERANCE = 1e-9

export function isKilogramLoadType(loadType: ExerciseLoadType) {
  return (
    loadType === 'EXTERNAL_KG' ||
    loadType === 'DUMBBELL_KG_EACH' ||
    loadType === 'MACHINE_KG'
  )
}

export function isVerifiedNextLoadContext(
  loadType: ExerciseLoadType,
  loadContextId: string,
) {
  if (loadType === 'EXTERNAL_KG') {
    return /^adult-resistance-load-context-\d+\.\d+\.\d+:external-kg$/u.test(
      loadContextId,
    )
  }
  if (loadType === 'DUMBBELL_KG_EACH') {
    return /^adult-resistance-load-context-\d+\.\d+\.\d+:dumbbell-kg-each$/u.test(
      loadContextId,
    )
  }
  if (loadType === 'MACHINE_KG') {
    return /^adult-resistance-load-context-\d+\.\d+\.\d+:machine:[^:]+$/u.test(
      loadContextId,
    )
  }
  return false
}

export function automaticLoadIncreaseRatio(currentLoadKg: number, nextLoadKg: number) {
  return (nextLoadKg - currentLoadKg) / currentLoadKg
}

export function isAutomaticLoadIncreaseAllowed(
  currentLoadKg: number,
  nextLoadKg: number,
) {
  return (
    automaticLoadIncreaseRatio(currentLoadKg, nextLoadKg) -
      MAX_AUTOMATIC_INCREASE_RATIO <=
    NUMBER_TOLERANCE
  )
}

export function verifyNextLoad(input: {
  identity: VerifiedNextLoadIdentity
  nextAvailableLoadKg: number
  confirmedAt: string
}): VerifyNextLoadResult {
  const { identity } = input
  if (!isKilogramLoadType(identity.loadType)) {
    return {
      ok: false,
      reasonCode: 'KILOGRAM_LOAD_REQUIRED',
      messageFi: 'Tälle kuormatyypille ei vahvisteta kilogrammaporrasta.',
    }
  }
  if (!identity.exerciseCode.trim()) {
    return {
      ok: false,
      reasonCode: 'EXERCISE_IDENTITY_REQUIRED',
      messageFi: 'Liikkeen tunniste puuttuu, joten kuormaa ei tallennettu.',
    }
  }
  if (!identity.exerciseVersion.trim()) {
    return {
      ok: false,
      reasonCode: 'EXERCISE_VERSION_REQUIRED',
      messageFi: 'Liikeversio puuttuu, joten kuormaa ei voida yhdistää turvallisesti.',
    }
  }
  if (
    !identity.loadContextId ||
    !isVerifiedNextLoadContext(identity.loadType, identity.loadContextId)
  ) {
    return {
      ok: false,
      reasonCode: 'LOAD_CONTEXT_REQUIRED',
      messageFi:
        identity.loadType === 'MACHINE_KG'
          ? 'Tunnista käytetty laite ennen seuraavan kuorman vahvistamista.'
          : 'Kuormakonteksti puuttuu, joten kuormaa ei voida yhdistää turvallisesti.',
    }
  }
  if (!Number.isFinite(identity.currentLoadKg) || identity.currentLoadKg <= 0) {
    return {
      ok: false,
      reasonCode: 'CURRENT_LOAD_INVALID',
      messageFi: 'Nykyinen kuorma ei ole kelvollinen positiivinen kilogrammamäärä.',
    }
  }
  if (!Number.isFinite(input.nextAvailableLoadKg) || input.nextAvailableLoadKg <= 0) {
    return {
      ok: false,
      reasonCode: 'NEXT_LOAD_INVALID',
      messageFi: 'Anna seuraava kuorma numeroina kilogrammoina.',
    }
  }
  if (input.nextAvailableLoadKg <= identity.currentLoadKg) {
    return {
      ok: false,
      reasonCode: 'NEXT_LOAD_NOT_GREATER',
      messageFi: 'Seuraavan kuorman pitää olla nykyistä kuormaa suurempi.',
    }
  }
  if (
    !isAutomaticLoadIncreaseAllowed(identity.currentLoadKg, input.nextAvailableLoadKg)
  ) {
    return {
      ok: false,
      reasonCode: 'NEXT_LOAD_EXCEEDS_TEN_PERCENT',
      messageFi: 'Kuormaporras ylittää 10 %, joten kuormaa ei nosteta automaattisesti.',
    }
  }
  if (!Number.isFinite(Date.parse(input.confirmedAt))) {
    return {
      ok: false,
      reasonCode: 'CONFIRMATION_TIME_INVALID',
      messageFi: 'Vahvistuksen ajankohta puuttuu, joten kuormaa ei tallennettu.',
    }
  }
  return {
    ok: true,
    confirmation: {
      exerciseCode: identity.exerciseCode,
      exerciseVersion: identity.exerciseVersion,
      loadContextId: identity.loadContextId,
      currentLoadKg: identity.currentLoadKg,
      nextAvailableLoadKg: input.nextAvailableLoadKg,
      confirmedAt: input.confirmedAt,
      policyVersion: VERIFIED_NEXT_LOAD_POLICY_VERSION,
    },
  }
}

function isStoredConfirmation(value: unknown): value is VerifiedNextLoad {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<VerifiedNextLoad>
  return (
    typeof candidate.exerciseCode === 'string' &&
    candidate.exerciseCode.length > 0 &&
    typeof candidate.exerciseVersion === 'string' &&
    candidate.exerciseVersion.length > 0 &&
    typeof candidate.loadContextId === 'string' &&
    candidate.loadContextId.length > 0 &&
    typeof candidate.currentLoadKg === 'number' &&
    Number.isFinite(candidate.currentLoadKg) &&
    candidate.currentLoadKg > 0 &&
    typeof candidate.nextAvailableLoadKg === 'number' &&
    Number.isFinite(candidate.nextAvailableLoadKg) &&
    candidate.nextAvailableLoadKg > candidate.currentLoadKg &&
    typeof candidate.confirmedAt === 'string' &&
    Number.isFinite(Date.parse(candidate.confirmedAt)) &&
    candidate.policyVersion === VERIFIED_NEXT_LOAD_POLICY_VERSION
  )
}

export function verifiedNextLoadsFrom(value: unknown): VerifiedNextLoad[] {
  return Array.isArray(value) ? value.filter(isStoredConfirmation) : []
}

export function findVerifiedNextLoad(
  confirmations: readonly VerifiedNextLoad[],
  identity: VerifiedNextLoadIdentity,
  authorization: VerifiedNextLoadAuthorizationContext,
): VerifiedNextLoad | undefined {
  if (!identity.loadContextId || !isKilogramLoadType(identity.loadType)) {
    return undefined
  }
  const evaluatedAtMs = Date.parse(authorization.evaluatedAt)
  const supportingEvidenceAtMs = Date.parse(authorization.supportingEvidenceAt)
  if (
    !Number.isFinite(evaluatedAtMs) ||
    !Number.isFinite(supportingEvidenceAtMs) ||
    supportingEvidenceAtMs > evaluatedAtMs
  ) {
    return undefined
  }
  return [...confirmations]
    .filter((candidate) => {
      const confirmedAtMs = Date.parse(candidate.confirmedAt)
      return (
        candidate.policyVersion === VERIFIED_NEXT_LOAD_POLICY_VERSION &&
        candidate.exerciseCode === identity.exerciseCode &&
        candidate.exerciseVersion === identity.exerciseVersion &&
        candidate.loadContextId === identity.loadContextId &&
        Math.abs(candidate.currentLoadKg - identity.currentLoadKg) <= NUMBER_TOLERANCE &&
        Number.isFinite(candidate.nextAvailableLoadKg) &&
        candidate.nextAvailableLoadKg > candidate.currentLoadKg &&
        Number.isFinite(confirmedAtMs) &&
        confirmedAtMs >= supportingEvidenceAtMs &&
        confirmedAtMs <= evaluatedAtMs &&
        isVerifiedNextLoadContext(identity.loadType, candidate.loadContextId)
      )
    })
    .sort((left, right) => right.confirmedAt.localeCompare(left.confirmedAt))[0]
}

export function upsertVerifiedNextLoad(
  current: readonly VerifiedNextLoad[],
  confirmation: VerifiedNextLoad,
): VerifiedNextLoad[] {
  return [
    ...current.filter(
      (candidate) =>
        !(
          candidate.exerciseCode === confirmation.exerciseCode &&
          candidate.exerciseVersion === confirmation.exerciseVersion &&
          candidate.loadContextId === confirmation.loadContextId &&
          Math.abs(candidate.currentLoadKg - confirmation.currentLoadKg) <=
            NUMBER_TOLERANCE
        ),
    ),
    confirmation,
  ]
}
