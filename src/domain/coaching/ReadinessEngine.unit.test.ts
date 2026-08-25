import { describe, expect, it } from 'vitest'
import { evaluateReadiness } from './ReadinessEngine'
import type { ReadinessInput, SafetySymptom } from './types'

function healthyInput(overrides: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    goal: 'ENDURANCE',
    plannedSession: 'INTERVAL',
    safetySymptoms: [],
    sleep: 'NORMAL',
    energy: 'NORMAL',
    stress: 'NORMAL',
    motivation: 'NORMAL',
    soreness: 'NORMAL',
    illnessSymptoms: false,
    availableMinutes: 60,
    ...overrides,
  }
}

describe('ReadinessEngine', () => {
  it('26: yksi palautumistekijä keventää määrää 25 % mutta ei vaihda tavoitetta', () => {
    const result = evaluateReadiness(healthyInput({ sleep: 'POOR' }))
    expect(result.decision).toMatchObject({
      state: 'YELLOW',
      volumeMultiplier: 0.75,
      maximumAttemptsAllowed: false,
      goalChanged: false,
    })
  })

  it('kaksi palautumistekijää keventää enemmän kuin yksi', () => {
    const result = evaluateReadiness(healthyInput({ sleep: 'POOR', energy: 'LOW' }))
    expect(result.decision.state).toBe('YELLOW')
    expect(result.decision.volumeMultiplier).toBe(0.6)
  })

  it('kolme palautumistekijää ohjaa palauttavaan harjoitukseen', () => {
    const result = evaluateReadiness(
      healthyInput({ sleep: 'POOR', energy: 'LOW', stress: 'HIGH' }),
    )
    expect(result.decision.state).toBe('ORANGE_RECOVERY')
    expect(result.decision.allowedSession).toBe('RECOVERY')
  })

  it('27: kävelyä muuttava polvikipu estää juoksun', () => {
    const result = evaluateReadiness(
      healthyInput({
        plannedSession: 'EASY_ENDURANCE',
        newPain: { location: 'polvi', severity: 'MODERATE', altersGait: true },
      }),
    )
    expect(result.decision.state).toBe('RED_STOP')
    expect(result.decision.allowedSession).toBe('REST')
    expect(result.decision.action).toContain('pysäyttää tämän harjoituksen')
  })

  it('28: pelkkä motivaation puute tarjoaa 10 minuutin aloituksen ilman palautumisdiagnoosia', () => {
    const result = evaluateReadiness(healthyInput({ motivation: 'LOW' }))
    expect(result.decision.state).toBe('GREEN')
    expect(result.decision.compactVariantMinutes).toBe(10)
    expect(result.reasons[0]?.code).toBe('MOTIVATION_SHORT_START')
  })

  it('ajanpuute valitsee kompaktin version mutta ei muuta valmiustilaa', () => {
    const result = evaluateReadiness(healthyInput({ availableMinutes: 20 }))
    expect(result.decision.state).toBe('GREEN')
    expect(result.decision.compactVariantMinutes).toBe(20)
  })

  it('nolla minuuttia ei koskaan avaa täyttä harjoitusta', () => {
    const result = evaluateReadiness(healthyInput({ availableMinutes: 0 }))
    expect(result.decision.allowedSession).toBe('REST')
    expect(result.decision.volumeMultiplier).toBe(0)
  })

  it('lievä uusi kipu keventää ja poistaa maksimiyritykset', () => {
    const result = evaluateReadiness(
      healthyInput({
        newPain: { location: 'olkapää', severity: 'MILD', altersGait: false },
      }),
    )
    expect(result.decision.state).toBe('YELLOW')
    expect(result.decision.volumeMultiplier).toBe(0.85)
    expect(result.decision.maximumAttemptsAllowed).toBe(false)
  })

  it('kierron vaihe ei vaikuta ilman oireita', () => {
    const result = evaluateReadiness(
      healthyInput({
        menstrualCycle: { phase: 'MENSTRUATION', symptomsImpact: 'NONE' },
      }),
    )
    expect(result.decision.state).toBe('GREEN')
  })

  it('kuukautiskiertoon liittyvien oireiden suuri vaikutus keventää palauttavaksi', () => {
    const result = evaluateReadiness(
      healthyInput({
        menstrualCycle: { phase: 'UNSURE', symptomsImpact: 'HIGH' },
      }),
    )
    expect(result.decision.state).toBe('ORANGE_RECOVERY')
  })

  it.each<SafetySymptom>([
    'CHEST_PAIN',
    'FAINTING',
    'UNUSUAL_BREATHLESSNESS',
    'NEW_NEUROLOGICAL_SYMPTOM',
    'FEVER',
    'SIGNIFICANT_DEHYDRATION',
    'SEVERE_ACUTE_PAIN',
    'JOINT_GIVING_WAY',
  ])('turvallisuusoire %s pysäyttää harjoittelun', (symptom) => {
    const result = evaluateReadiness(healthyInput({ safetySymptoms: [symptom] }))
    expect(result.decision.state).toBe('RED_STOP')
    expect(result.decision.volumeMultiplier).toBe(0)
    expect(result.reasons[0]?.priority).toBe('SAFETY')
  })

  it('sairausoire ilman erillistä hätäoiretta ohjaa palautumiseen', () => {
    const result = evaluateReadiness(healthyInput({ illnessSymptoms: true }))
    expect(result.decision.state).toBe('ORANGE_RECOVERY')
    expect(result.decision.allowedSession).toBe('RECOVERY')
  })
})
