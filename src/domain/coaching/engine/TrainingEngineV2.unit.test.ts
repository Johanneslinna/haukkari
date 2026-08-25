import { describe, expect, it } from 'vitest'
import {
  AthleteStateBuilder,
  CandidateSelector,
  ConstraintEngine,
  DecisionRecorder,
  DoseEngine,
  ExerciseRanker,
  LiveAdaptationEngine,
  SessionObjectivePlanner,
} from './TrainingEngineV2'

function state() {
  return AthleteStateBuilder.build({
    goal: { primary: 'GENERAL_FITNESS', secondary: [], inputs: {} },
    experience: 'BEGINNER',
    currentEnduranceMinutes: 90,
    equipment: ['Kehonpaino', 'Käsipainot'],
    physicalLoad: 'MODERATE',
    availableDays: [1, 3, 5],
    minutesPerSession: 60,
    minutesByDay: { '3': 30 },
    fixedSessions: [],
    competitions: [],
  })
}

describe('TrainingEngineV2-kerrokset', () => {
  it('erottaa pitkäaikaisen tilan, akuutin tilan, aikataulun ja luottamuksen', () => {
    const athlete = state()
    expect(athlete.longTerm.currentEnduranceMinutes).toBe(90)
    expect(athlete.acute.physicalLoad).toBe('MODERATE')
    expect(athlete.schedule.availableDays).toEqual([1, 3, 5])
    expect(athlete.confidence.overall).toBe('HIGH')
  })

  it('käsittelee päiväkohtaisen aikarajan ehdottomana constraintina', () => {
    const athlete = state()
    expect(ConstraintEngine.capSessionMinutes(athlete, 3, 90)).toBe(30)
    expect(
      ConstraintEngine.hardViolations(athlete, { day: 3, durationMinutes: 31 }),
    ).toContain('Harjoitus ylittää päivän ehdottoman aikabudjetin.')
  })

  it('suodattaa ensin välineillä ja järjestää vasta sen jälkeen mieltymyksillä', () => {
    const candidates = [
      { code: 'A', nameFi: 'Kehonpainokyykky', category: 'Kyykky', equipment: ['Kehonpaino'] },
      { code: 'B', nameFi: 'Maljakyykky', category: 'Kyykky', equipment: ['Käsipainot'] },
      { code: 'C', nameFi: 'Jalkaprässi', category: 'Kyykky', equipment: ['Kuntosalilaitteet'] },
    ]
    const selected = CandidateSelector.select(candidates, {
      category: 'Kyykky',
      equipment: ['Kehonpaino', 'Käsipainot'],
    })
    const ranked = ExerciseRanker.rank(selected, {
      equipment: ['Kehonpaino', 'Käsipainot'],
      likes: 'maljakyykky',
    })

    expect(ranked.map((candidate) => candidate.code)).toEqual(['B', 'A'])
  })

  it('pitää tavoitteen, annoksen ja live-adaptaation erillisinä päätöksinä', () => {
    expect(SessionObjectivePlanner.plan('INTERVAL', 'ENDURANCE').primary).toBe(
      'Hallittu vauhtikestävyys',
    )
    expect(DoseEngine.clampMinutes(90, 45)).toBe(45)
    expect(
      LiveAdaptationEngine.chooseMultiplier({
        safetyOutcome: 'MODIFY',
        recoveryFlags: 2,
      }),
    ).toBe(0.6)
  })

  it('tallentaa jäljitettävän päätöksen yhdellä recorderilla', () => {
    const trace = DecisionRecorder.record({
      ruleVersion: 'test-v2',
      generatedAt: '2026-08-25T00:00:00.000Z',
      safetyOutcome: 'PROCEED',
      confidence: 'HIGH',
      inputSummary: ['testi'],
      rules: [],
    })
    expect(trace.missingData).toEqual([])
    expect(trace.ruleVersion).toBe('test-v2')
  })
})
