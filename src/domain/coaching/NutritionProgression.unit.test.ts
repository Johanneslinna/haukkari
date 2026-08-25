import { describe, expect, it } from 'vitest'
import { approveEnergyProposal, evaluateNutritionPolicy } from './NutritionPolicyEngine'
import { evaluateProgress } from './ProgressEvaluator'
import { evaluateProgression } from './ProgressionEngine'
import type { LowEnergySign } from './types'

describe('NutritionPolicyEngine', () => {
  it('20: epärealistinen määräaika ei aiheuta rajumpaa dieettiä', () => {
    const result = evaluateNutritionPolicy({
      goal: 'FAT_LOSS',
      weightKg: 60,
      reliableWeeklyWeightTrend: [60.2, 60.1, 60],
      lowEnergySigns: [],
      desiredChangeKg: 10,
      deadlineWeeks: 2,
    })
    expect(result.decision.energyAction).toBe('PROPOSE_MODERATE_DEFICIT')
    expect(result.decision.deadlineAdjusted).toBe(true)
    expect(result.decision.approved).toBe(false)
  })

  it('30: yksittäinen painolukema ei muuta ravintoa', () => {
    const result = evaluateNutritionPolicy({
      goal: 'FAT_LOSS',
      weightKg: 60,
      reliableWeeklyWeightTrend: [60],
      lowEnergySigns: [],
    })
    expect(result.decision.energyAction).toBe('MAINTAIN')
    expect(result.decision.requiresUserApproval).toBe(false)
    expect(result.reasons[0]?.message).toContain('Yksittäinen')
  })

  it.each<LowEnergySign>([
    'MENSTRUAL_CHANGE',
    'DECLINING_PERFORMANCE',
    'PERSISTENT_FATIGUE_OR_COLD',
    'REPEATED_ILLNESS_OR_STRESS_INJURY',
    'CONCERNING_EATING_BEHAVIOUR',
  ])(
    '31: matalan energiansaatavuuden merkki %s pysäyttää painonpudotusohjauksen',
    (sign) => {
      const result = evaluateNutritionPolicy({
        goal: 'FAT_LOSS',
        reliableWeeklyWeightTrend: [60.5, 60.2, 60],
        lowEnergySigns: [sign],
      })
      expect(result.decision.energyAction).toBe('SUSPEND_DEFICIT')
      expect(result.decision.fatLossGuidanceActive).toBe(false)
      expect(result.reasons[0]?.priority).toBe('SAFETY')
    },
  )

  it('ei aloita energiavajetta kilpailuviikolla', () => {
    const result = evaluateNutritionPolicy({
      goal: 'FAT_LOSS',
      reliableWeeklyWeightTrend: [60.5, 60.2, 60],
      lowEnergySigns: [],
      competitionDaysUntil: 4,
    })
    expect(result.decision.energyAction).toBe('MAINTAIN')
    expect(result.reasons[0]?.code).toBe('NO_NEW_DEFICIT_COMPETITION_WEEK')
  })

  it('ei ota energiaehdotusta käyttöön ennen käyttäjän hyväksyntää', () => {
    const proposal = evaluateNutritionPolicy({
      goal: 'MUSCLE_GAIN',
      reliableWeeklyWeightTrend: [60, 60, 60],
      lowEnergySigns: [],
    })
    expect(proposal.decision.requiresUserApproval).toBe(true)
    expect(proposal.decision.approved).toBe(false)
    expect(approveEnergyProposal(proposal, true).decision.approved).toBe(true)
  })

  it('antaa yhteiset proteiini-, ateriarytmi- ja kestävyyden tankkausohjeet', () => {
    const result = evaluateNutritionPolicy({
      goal: 'ENDURANCE',
      reliableWeeklyWeightTrend: [60, 60, 60],
      lowEnergySigns: [],
    })
    expect(result.decision.proteinGramsPerKg).toEqual({ min: 1.6, max: 2 })
    expect(result.decision.guidance.join(' ')).toContain('säännöllisiä aterioita')
    expect(result.decision.guidance.join(' ')).toContain('hiilihydraatteja')
  })
})

describe('ProgressionEngine ja ProgressEvaluator', () => {
  it('kolme keltaista päivää keventää viikkomäärää 30 %', () => {
    const result = evaluateProgression({
      currentWeeklyVolume: 200,
      adherence: 0.9,
      recentReadiness: ['YELLOW', 'GREEN', 'YELLOW', 'YELLOW'],
      missedSession: false,
      comparablePlateauPeriods: 0,
      previousChangedVariable: null,
    })
    expect(result.decision.action).toBe('DELOAD')
    expect(result.decision.nextWeeklyVolume).toBe(140)
  })

  it('kaksi oranssia päivää käynnistää saman kevennyksen', () => {
    const result = evaluateProgression({
      currentWeeklyVolume: 100,
      adherence: 0.9,
      recentReadiness: ['ORANGE_RECOVERY', 'GREEN', 'ORANGE_RECOVERY'],
      missedSession: false,
      comparablePlateauPeriods: 0,
      previousChangedVariable: null,
    })
    expect(result.decision.action).toBe('DELOAD')
    expect(result.decision.nextWeeklyVolume).toBe(70)
  })

  it('alle 70 %:n toteuma yksinkertaistaa ohjelmaa eikä lisää kuormaa', () => {
    const result = evaluateProgression({
      currentWeeklyVolume: 100,
      adherence: 0.69,
      recentReadiness: ['GREEN'],
      missedSession: false,
      comparablePlateauPeriods: 0,
      previousChangedVariable: null,
    })
    expect(result.decision.action).toBe('SIMPLIFY')
    expect(result.decision.nextWeeklyVolume).toBeLessThan(100)
  })

  it('muuttaa korkeintaan yhtä olennaista muuttujaa viikossa', () => {
    const result = evaluateProgression({
      currentWeeklyVolume: 100,
      adherence: 0.95,
      recentReadiness: ['GREEN'],
      missedSession: false,
      comparablePlateauPeriods: 0,
      previousChangedVariable: 'INTENSITY',
    })
    expect(result.decision.action).toBe('MAINTAIN')
    expect(result.decision.changedVariable).toBeNull()
  })

  it('ei nimeä yhtä arviojaksoa tasanteeksi', () => {
    const result = evaluateProgress([
      { label: 'Viikot 1–3', comparable: true, metricValue: 100, dataPoints: 3 },
    ])
    expect(result.decision.status).toBe('INSUFFICIENT_DATA')
  })

  it('arvioi tasanteen vasta kahdesta vertailukelpoisesta jaksosta', () => {
    const result = evaluateProgress([
      { label: 'Viikot 1–3', comparable: true, metricValue: 100, dataPoints: 3 },
      { label: 'Viikot 4–6', comparable: true, metricValue: 100.5, dataPoints: 3 },
    ])
    expect(result.decision.status).toBe('PLATEAU')
  })
})
