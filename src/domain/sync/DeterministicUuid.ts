const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

function uuidBytes(value: string) {
  if (!UUID_PATTERN.test(value)) throw new Error('INVALID_UUID_NAMESPACE')
  return Uint8Array.from(
    value
      .replaceAll('-', '')
      .match(/.{2}/gu)!
      .map((part) => Number.parseInt(part, 16)),
  )
}

function bytesUuid(bytes: Uint8Array) {
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20, 32)}`
}

/** RFC 9562 UUIDv5: sama nimi ja namespace tuottavat kaikilla laitteilla saman id:n. */
export async function deterministicUuid(namespace: string, name: string) {
  if (!name) throw new Error('DETERMINISTIC_UUID_NAME_REQUIRED')
  const namespaceBytes = uuidBytes(namespace)
  const nameBytes = new TextEncoder().encode(name)
  const source = new Uint8Array(namespaceBytes.length + nameBytes.length)
  source.set(namespaceBytes)
  source.set(nameBytes, namespaceBytes.length)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', source))
  const result = digest.slice(0, 16)
  result[6] = (result[6]! & 0x0f) | 0x50
  result[8] = (result[8]! & 0x3f) | 0x80
  return bytesUuid(result)
}

export const HAUKKARI_WEEKLY_PLAN_NAMESPACE = '8d182d9f-66a5-5f6d-92d2-29c45997ac38'

export function weeklyMaterializationIdempotencyKey(input: {
  goalPeriodId: string
  weekAnchorDate: string
  calendarPolicyVersion: string
  strengthWeekPolicyVersion: string
}) {
  return [
    'weekly',
    input.goalPeriodId,
    input.weekAnchorDate,
    input.calendarPolicyVersion,
    input.strengthWeekPolicyVersion,
  ].join(':')
}

export async function deterministicWeeklyPlanIds(input: {
  userId: string
  goalPeriodId: string
  weekAnchorDate: string
  calendarPolicyVersion: string
  strengthWeekPolicyVersion: string
}) {
  const authority = [
    input.userId,
    input.goalPeriodId,
    input.weekAnchorDate,
    input.calendarPolicyVersion,
    input.strengthWeekPolicyVersion,
  ].join(':')
  const [planVersionId, trainingPlanId] = await Promise.all([
    deterministicUuid(HAUKKARI_WEEKLY_PLAN_NAMESPACE, `plan-version:${authority}`),
    deterministicUuid(HAUKKARI_WEEKLY_PLAN_NAMESPACE, `training-plan:${authority}`),
  ])
  return { planVersionId, trainingPlanId }
}
