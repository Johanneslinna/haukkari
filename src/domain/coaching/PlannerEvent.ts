import type { PlannedSession, SessionIntensity } from './types'

export type PlannerEventKind =
  'ICE_PRACTICE' | 'MATCH' | 'TOURNAMENT' | 'OTHER_ACTIVITY' | 'PHYSICAL_LOAD' | 'ABSENCE'

export type PlannerEvent = {
  id: string
  kind: PlannerEventKind
  title: string
  startsAt: string
  durationMinutes: number
  intensity: SessionIntensity
  fixed: boolean
  rpe?: number
  recurrence?: {
    frequency: 'WEEKLY'
    interval: number
    until?: string
  }
  metadata: Record<string, string | number | boolean>
}

export function plannerEventWeekday(event: PlannerEvent) {
  return new Date(event.startsAt).getDay() || 7
}

export function plannerEventToSession(event: PlannerEvent): PlannedSession | null {
  if (event.kind === 'ABSENCE') return null
  const kind = event.kind === 'MATCH' || event.kind === 'TOURNAMENT' ? 'MATCH' : 'SPORT'
  return {
    id: `planner-${event.id}`,
    day: plannerEventWeekday(event),
    kind,
    title: event.title,
    durationMinutes: event.durationMinutes,
    intensity: event.intensity,
    loadRegion: event.kind === 'PHYSICAL_LOAD' ? 'FULL_BODY' : 'FULL_BODY',
    fixed: event.fixed,
    source:
      event.kind === 'MATCH' || event.kind === 'TOURNAMENT' ? 'COMPETITION' : 'SPORT',
    notes: [
      `PlannerEvent: ${event.kind}`,
      ...(event.rpe === undefined ? [] : [`Arvioitu RPE ${event.rpe}`]),
      ...(event.recurrence ? ['Toistuva viikkotapahtuma'] : []),
    ],
  }
}

export const PlannerEventModel = {
  toSession: plannerEventToSession,
  weekday: plannerEventWeekday,
}
