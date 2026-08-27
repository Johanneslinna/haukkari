import { describe, expect, it } from 'vitest'
import {
  adaptPrescription,
  applyWorkoutProgression,
  evaluateWorkoutFeedback,
  normalizePrescriptionV2,
  prescriptionDurationSeconds,
  prescribeSession,
  resolvePrescription,
} from './index'
import type {
  PrescriptionAdaptationSafetyContext,
  PrescriptionProfile,
} from './TrainingPrescriptionEngine'
import type { WorkoutFeedback, WorkoutVariant } from './types'

const generatedAt = '2026-08-25T08:00:00.000Z'

function profile(patch: Partial<PrescriptionProfile> = {}): PrescriptionProfile {
  return {
    goal: 'GENERAL_FITNESS',
    experience: 'BEGINNER',
    equipment: ['Kehonpaino'],
    physicalLoad: 'MODERATE',
    minutesPerSession: 45,
    age: 30,
    readiness: 'GREEN',
    generatedAt,
    ...patch,
  }
}

function feedback(patch: Partial<WorkoutFeedback> = {}): WorkoutFeedback {
  return {
    completionStatus: 'COMPLETED',
    sessionRpe: 6,
    difficulty: 'RIGHT',
    pain: 'NONE',
    painLocation: '',
    felt: 'SAME',
    notes: '',
    ...patch,
  }
}

const compact10: WorkoutVariant = {
  kind: 'COMPACT_10',
  durationMinutes: 10,
  volumeMultiplier: 0.35,
}

const adaptationSafety: PrescriptionAdaptationSafetyContext = {
  age: 30,
  readiness: 'GREEN',
  healthBlocked: false,
  safetyInformationComplete: true,
}

describe('TrainingPrescriptionEngine – kultaiset käyttäjäprofiilit', () => {
  it('luo kehonpainoa käyttävälle aloittelijalle täysin suoritettavan ohjelman', () => {
    const result = prescribeSession({
      sessionId: 'golden-home-beginner',
      title: 'Kokovartalon voima',
      kind: 'STRENGTH',
      durationMinutes: 45,
      profile: profile(),
    })

    expect(result.exercises.length).toBeGreaterThanOrEqual(4)
    expect(result.exercises.map((item) => item.nameFi)).toEqual(
      expect.arrayContaining([
        'Tuolilta ylösnousu',
        'Lantionnosto',
        'Korotettu punnerrus',
        'Dead bug',
      ]),
    )
    expect(
      result.exercises.every(
        (item) =>
          item.sets > 0 &&
          item.restSeconds >= 0 &&
          item.targetRpe > 0 &&
          item.stopCondition.length > 0,
      ),
    ).toBe(true)
    expect(result.decisionTrace.ruleVersion).toBe('adult-resistance-rules-1.4.0')
    expect(result.decisionTrace.contentReleaseId).toBe('adult-resistance-v1.0.0')
  })

  it('käyttää ilmoitettuja kuntosalivälineitä ja lihaskasvun annosta', () => {
    const result = prescribeSession({
      sessionId: 'golden-gym-hypertrophy',
      title: 'Lihaskasvun voima',
      kind: 'STRENGTH',
      durationMinutes: 60,
      profile: profile({
        goal: 'MUSCLE_GAIN',
        experience: 'INTERMEDIATE',
        equipment: ['Kuntosalilaitteet', 'Käsipainot'],
        minutesPerSession: 60,
      }),
    })

    expect(result.exercises[0]?.nameFi).toMatch(/Jalkaprässi|Maljakyykky/u)
    expect(result.exercises.every((item) => item.repetitions === '8–12')).toBe(true)
    expect(result.exercises.every((item) => item.sets === 3)).toBe(true)
  })

  it('vähentää annosta korkean fyysisen työkuorman profiilissa', () => {
    const normal = prescribeSession({
      sessionId: 'normal-load',
      title: 'Voima',
      kind: 'STRENGTH',
      durationMinutes: 45,
      profile: profile({ experience: 'INTERMEDIATE' }),
    })
    const high = prescribeSession({
      sessionId: 'high-load',
      title: 'Voima',
      kind: 'STRENGTH',
      durationMinutes: 45,
      profile: profile({ experience: 'INTERMEDIATE', physicalLoad: 'HIGH' }),
    })

    expect(high.exercises[0]!.sets).toBe(normal.exercises[0]!.sets - 1)
    expect(high.exercises[0]!.targetRpe).toBe(normal.exercises[0]!.targetRpe - 1)
    expect(high.decisionTrace.safetyOutcome).toBe('MODIFY')
  })

  it('10 minuutin versio säilyttää avainliikkeet mutta rajaa kokonaismäärää', () => {
    const full = prescribeSession({
      sessionId: 'compact',
      title: 'Voima',
      kind: 'STRENGTH',
      durationMinutes: 45,
      profile: profile(),
    })
    const adaptation = adaptPrescription(full, compact10, adaptationSafety)
    expect(adaptation.status).toBe('SUPPORTED')
    if (adaptation.status !== 'SUPPORTED') throw new Error(adaptation.reasonCode)
    const compact = adaptation.prescription

    expect(compact.durationMinutes).toBeLessThanOrEqual(10)
    expect(compact.exercises).toHaveLength(2)
    expect(compact.exercises.every((item) => item.keyExercise)).toBe(true)
    expect(compact.decisionTrace.rules.map((rule) => rule.ruleId)).toContain(
      'TIME-COMPACT-001',
    )
  })

  it('kompakti kestävyysharjoitus mahduttaa lämmittelyn, työosuuden ja jäähdyttelyn aikarajaan', () => {
    const full = prescribeSession({
      sessionId: 'compact-endurance',
      title: 'Helppo peruskestävyys',
      kind: 'EASY_ENDURANCE',
      durationMinutes: 40,
      profile: profile(),
    })
    const adaptation = adaptPrescription(
      full,
      { kind: 'COMPACT_30', durationMinutes: 30, volumeMultiplier: 0.75 },
      adaptationSafety,
    )
    expect(adaptation.status).toBe('SUPPORTED')
    if (adaptation.status !== 'SUPPORTED') throw new Error(adaptation.reasonCode)
    const compact = adaptation.prescription

    expect(compact.warmup[0]).toContain('5 min')
    expect(compact.exercises[0]?.durationSeconds).toBe(20 * 60)
    expect(compact.cooldown[0]).toContain('5 min')
  })

  it('terveysesto ei muodosta prescriptionia väärillä säännöillä', () => {
    const result = resolvePrescription({
      sessionId: 'health-block',
      title: 'Intervalli',
      kind: 'INTERVAL',
      durationMinutes: 35,
      profile: profile({ healthBlocked: true }),
    })

    expect(result).toEqual({
      status: 'UNSUPPORTED',
      sessionKind: 'INTERVAL',
      reasonCode: 'HEALTH_ENGINE_NOT_AVAILABLE',
      userMessage: expect.stringContaining('terveysrajoitteen'),
    })
  })

  it('käyttää sykkeen sijasta RPE:tä ja puhetestiä lääkityksen vaikuttaessa sykkeeseen', () => {
    const result = prescribeSession({
      sessionId: 'heart-rate-medication',
      title: 'Helppo kestävyys',
      kind: 'EASY_ENDURANCE',
      durationMinutes: 40,
      profile: profile({ medicationAffectsHeartRate: true }),
    })

    expect(result.decisionTrace.rules.map((rule) => rule.ruleId)).toContain(
      'END-HR-MEDICATION-001',
    )
    expect(result.exercises[0]?.loadGuidance).toContain('puhetestillä')
  })

  it('merkitsee puuttuvan kestävyystaustan kalibrointia vaativaksi', () => {
    const result = prescribeSession({
      sessionId: 'endurance-calibration',
      title: 'Helppo kestävyys',
      kind: 'EASY_ENDURANCE',
      durationMinutes: 40,
      profile: profile({ enduranceBackgroundKnown: false }),
    })

    expect(result.confidence).toBe('MODERATE')
    expect(result.decisionTrace.missingData).toContain(
      'Kestävyys- ja lajitaustan vertailukelpoinen lähtötieto',
    )
  })

  it('sama syöte tuottaa saman reseptin ja päätöspolun', () => {
    const input = {
      sessionId: 'deterministic',
      title: 'Voima',
      kind: 'STRENGTH' as const,
      durationMinutes: 45,
      profile: profile({ equipment: ['Käsipainot'] }),
    }
    expect(prescribeSession(input)).toEqual(prescribeSession(input))
  })

  it('ei valitse liikettä, joka vaatii puuttuvan välineen', () => {
    const available = ['Käsipainot']
    const result = prescribeSession({
      sessionId: 'equipment-hard-constraint',
      title: 'Voima',
      kind: 'STRENGTH',
      durationMinutes: 45,
      profile: profile({ equipment: available, experience: 'INTERMEDIATE' }),
    })

    expect(
      result.exercises.every((exercise) =>
        exercise.equipment.some(
          (item) => item === 'Kehonpaino' || available.includes(item),
        ),
      ),
    ).toBe(true)
  })

  it('käyttää vastuskuminauhalle vastustasoa kilogrammojen sijaan', () => {
    const result = prescribeSession({
      sessionId: 'band-load-unit',
      title: 'Voima',
      kind: 'STRENGTH',
      durationMinutes: 45,
      profile: profile({ equipment: ['Vastuskuminauhat'] }),
    })
    const bandExercise = result.exercises.find((exercise) =>
      exercise.equipment.includes('Vastuskuminauhat'),
    )

    expect(bandExercise?.loadType).toBe('BAND')
    expect(bandExercise?.loadLabelFi).toBe('Nauhan vastus')
  })

  it('tuottaa v2-sopimuksen ja laskee kaikki osat aikabudjettiin', () => {
    const result = prescribeSession({
      sessionId: 'v2-contract',
      title: 'Voima',
      kind: 'STRENGTH',
      durationMinutes: 45,
      profile: profile(),
    })

    expect(result.schemaVersion).toBe(2)
    expect(result.engineVersion).toBe('adult-resistance-1.4.0')
    expect(result.blocks).toEqual(result.exercises)
    expect(result.objective?.primary).toBeTruthy()
    expect(prescriptionDurationSeconds(result)).toBeLessThanOrEqual(45 * 60)
    expect(result.durationMinutes).toBe(
      Math.ceil(prescriptionDurationSeconds(result) / 60),
    )
    expect(result.timePolicyVersion).toBe('adult-strength-time-1.1.0')
    expect(result.calculatedTotalSeconds).toBe(result.timeBreakdown?.totalSeconds)
    expect(result.timeBreakdown).toMatchObject({
      warmupSeconds: expect.any(Number),
      exerciseWarmupSeconds: expect.any(Number),
      workSeconds: expect.any(Number),
      restSeconds: expect.any(Number),
      transitionSeconds: expect.any(Number),
      equipmentSetupSeconds: expect.any(Number),
      cooldownSeconds: expect.any(Number),
      bufferSeconds: expect.any(Number),
      policyVersion: 'adult-strength-time-1.1.0',
    })
  })

  it('mallintaa intervallin vetoina ja palautuksina eikä pitkänä toistona', () => {
    const result = prescribeSession({
      sessionId: 'interval-v2',
      title: 'Hallittu intervalli',
      kind: 'INTERVAL',
      durationMinutes: 35,
      profile: profile(),
    })
    const dose = result.exercises[0]?.dose

    expect(dose?.kind).toBe('INTERVAL_BLOCKS')
    if (dose?.kind !== 'INTERVAL_BLOCKS') throw new Error('Intervalliannos puuttuu')
    expect(dose.repetitions).toBeGreaterThanOrEqual(2)
    expect(dose.workSeconds).toBe(180)
    expect(dose.recoverySeconds).toBe(120)
    expect(prescriptionDurationSeconds(result)).toBeLessThanOrEqual(35 * 60)
  })

  it('ei muodosta nopeusharjoitusta ennen asiantuntijatarkastusta', () => {
    const result = resolvePrescription({
      sessionId: 'speed-v2',
      title: 'Nopeus ja teho',
      kind: 'SPEED_POWER',
      durationMinutes: 35,
      profile: profile({ age: 30 }),
    })

    expect(result).toMatchObject({
      status: 'UNSUPPORTED',
      reasonCode: 'SPEED_POWER_ENGINE_NOT_REVIEWED',
    })
  })

  it('avaa vanhan reseptin muuttamatta sen aiemmin näytettyä kestoa', () => {
    const current = prescribeSession({
      sessionId: 'legacy-source',
      title: 'Voima',
      kind: 'STRENGTH',
      durationMinutes: 45,
      profile: profile(),
    })
    const legacy = {
      ...current,
      schemaVersion: undefined,
      engineVersion: undefined,
      blocks: undefined,
      durationMinutes: 45,
      exercises: current.exercises.map(({ dose: _dose, ...exercise }) => exercise),
    }
    const normalized = normalizePrescriptionV2(legacy)

    expect(normalized.schemaVersion).toBe(2)
    expect(normalized.durationMinutes).toBe(45)
    expect(normalized.exercises.every((exercise) => Boolean(exercise.dose))).toBe(true)
    expect(normalized.timePolicyVersion).toBeUndefined()
    expect(normalized.timeBreakdown).toBeUndefined()

    const reauthorized = adaptPrescription(
      legacy,
      { kind: 'FULL', timeBudgetMinutes: 45, durationMinutes: 45, volumeMultiplier: 1 },
      adaptationSafety,
    )
    expect(reauthorized.status).toBe('SUPPORTED')
    if (reauthorized.status !== 'SUPPORTED') throw new Error(reauthorized.reasonCode)
    expect(reauthorized.prescription.timePolicyVersion).toBe('adult-strength-time-1.1.0')
    expect(reauthorized.prescription.timeAdjustmentReasonCodes).toContain(
      'TIME_LEGACY_REAUTHORIZED',
    )
    expect(reauthorized.prescription.durationMinutes).toBe(
      Math.ceil(reauthorized.prescription.timeBreakdown!.totalSeconds / 60),
    )

    const incompleteLegacy = {
      ...legacy,
      exercises: legacy.exercises.map((exercise, index) =>
        index === 0 ? { ...exercise, restSeconds: Number.NaN } : exercise,
      ),
    }
    expect(
      adaptPrescription(
        incompleteLegacy,
        {
          kind: 'FULL',
          timeBudgetMinutes: 45,
          durationMinutes: 45,
          volumeMultiplier: 1,
        },
        adaptationSafety,
      ),
    ).toMatchObject({
      status: 'UNSUPPORTED',
      reasonCode: 'NO_SAFE_STRENGTH_DOSE_AVAILABLE',
    })
  })
})

describe('WorkoutFeedbackEngine', () => {
  it('ei nosta kuormaa yhden tavallisen harjoituksen perusteella', () => {
    expect(evaluateWorkoutFeedback([feedback()]).decision.action).toBe('MAINTAIN')
  })

  it('ohjaa voimakkaasta kivusta arvioon eikä progressioon', () => {
    const decision = evaluateWorkoutFeedback([
      feedback({ pain: 'SEVERE', felt: 'WORSE' }),
    ]).decision
    expect(decision.action).toBe('REFER')
    expect(decision.safetyOutcome).toBe('REFER')
  })

  it('muuttaa vain yhtä kuormitusmuuttujaa kahden onnistuneen helpon toteuman jälkeen', () => {
    const result = prescribeSession({
      sessionId: 'progress',
      title: 'Voima',
      kind: 'STRENGTH',
      durationMinutes: 45,
      profile: profile(),
    })
    const decision = evaluateWorkoutFeedback([
      feedback(),
      feedback({ difficulty: 'TOO_EASY' }),
    ]).decision
    const progressed = applyWorkoutProgression(result, decision)
    const setChanges = progressed.exercises.filter(
      (exercise, index) => exercise.sets !== result.exercises[index]?.sets,
    )

    expect(decision.action).toBe('PROGRESS_LOAD')
    expect(setChanges).toHaveLength(0)
  })

  it('ei nosta kuormaa, jos toteutunut RIR jää tavoitetta pienemmäksi', () => {
    const exerciseResult = {
      exerciseCode: 'GOBLET_SQUAT',
      exerciseName: 'Maljakyykky',
      loadType: 'EXTERNAL_KG' as const,
      completedSets: 2,
      plannedSets: 2,
      repetitions: [8, 8],
      loads: ['30', '30'],
      rirs: [0, 1],
      targetRepetitions: '8–10',
      targetRpe: 7,
    }
    const decision = evaluateWorkoutFeedback([
      feedback({ difficulty: 'TOO_EASY', exerciseResults: [exerciseResult] }),
      feedback({ difficulty: 'TOO_EASY', exerciseResults: [exerciseResult] }),
    ]).decision

    expect(decision.action).toBe('MAINTAIN')
  })
})
