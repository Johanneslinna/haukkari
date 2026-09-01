import { describe, expect, it } from 'vitest'
import {
  STRENGTH_RETURN_POLICY_VERSION,
  auditStrengthPrescriptionTime,
  generatePlan,
  prescribeAdultResistanceSession,
  resolvePrescription,
  type AdultResistanceAthleteContext,
  type AdultResistanceSetHistory,
  type StrengthTrainingBackground,
} from '.'

const generatedAt = '2026-08-25T12:00:00.000Z'
const dayMs = 86_400_000

function daysBefore(days: number) {
  return new Date(Date.parse(generatedAt) - days * dayMs).toISOString()
}

function historyRow(
  sessionId: string,
  days: number,
  patch: Partial<AdultResistanceSetHistory> = {},
): AdultResistanceSetHistory {
  return {
    sessionId,
    exerciseCode: 'GOBLET_SQUAT',
    exerciseVersion: '1.0.0',
    loadKg: 20,
    loadType: 'DUMBBELL_KG_EACH',
    loadContextId: 'adult-resistance-load-context-1.0.0:dumbbell-kg-each',
    repetitions: 10,
    rir: 3,
    completedAt: daysBefore(days),
    pain: false,
    techniqueOk: true,
    completionStatus: 'COMPLETED',
    doseCompleted: true,
    targetRirMin: 3,
    targetRirMax: 4,
    ...patch,
  }
}

function context(
  patch: Partial<AdultResistanceAthleteContext> = {},
): AdultResistanceAthleteContext {
  return {
    age: 35,
    contentReleaseId: 'adult-resistance-v1.0.0',
    ruleVersion: 'adult-resistance-rules-1.5.0',
    experience: 'INTERMEDIATE',
    goal: 'GENERAL_FITNESS',
    equipment: ['Kehonpaino', 'Käsipainot'],
    environment: 'HOME',
    availableMinutes: 45,
    generatedAt,
    physicalLoad: 'MODERATE',
    readiness: 'GREEN',
    limitationTags: [],
    dislikedExerciseCodes: [],
    likedExerciseCodes: ['GOBLET_SQUAT'],
    supervisionAvailable: false,
    ...patch,
  }
}

function userBackground(days: number): StrengthTrainingBackground {
  return {
    regularTrainingAtLeast12Weeks: true,
    lastStrengthWorkoutAt: daysBefore(days),
    source: 'USER_CONFIRMED',
    confirmedAt: generatedAt,
    policyVersion: STRENGTH_RETURN_POLICY_VERSION,
  }
}

function totalSets(value: ReturnType<typeof prescribeAdultResistanceSession>) {
  return value.exercises.reduce((sum, exercise) => sum + exercise.sets, 0)
}

describe('return policy in the production prescription route', () => {
  it('vähentää 8–14 päivän tauossa sarjat floor(alkuperäinen × 0,75) ja estää progression', () => {
    const baseline = prescribeAdultResistanceSession({
      sessionId: 'baseline',
      title: 'Voima',
      context: context({ equipment: ['Käsipainot'] }),
    })
    const returned = prescribeAdultResistanceSession({
      sessionId: 'returned',
      title: 'Voima',
      context: context({ equipment: ['Käsipainot'] }),
      history: [historyRow('previous', 8)],
    })
    expect(totalSets(returned)).toBe(Math.floor(totalSets(baseline) * 0.75))
    expect(
      returned.exercises.every((exercise) =>
        exercise.progressionDecision?.reasonCodes.includes(
          'PROGRESSION_SUPPRESSED_DURING_REENTRY',
        ),
      ),
    ).toBe(true)
    expect(auditStrengthPrescriptionTime(returned).violations).toEqual([])
    expect(returned.timeBreakdown?.bufferSeconds).toBeGreaterThanOrEqual(
      baseline.timeBreakdown?.bufferSeconds ?? 0,
    )
    expect(returned.minimumTimeBufferSeconds).toBe(baseline.timeBreakdown?.bufferSeconds)
    expect(returned.calculatedTotalSeconds).toBeLessThanOrEqual(
      returned.timeBudgetMinutes! * 60,
    )
    expect(returned.warmupMinutes).toBe(baseline.warmupMinutes)
    expect(returned.exercises.every((exercise) => exercise.restSeconds >= 60)).toBe(true)
  })

  it('vähentää 15–27 päivän tauossa sarjat 35 %, kasvattaa RIR:ää ja näyttää vanhan kuorman vain vertailuna', () => {
    const baseline = prescribeAdultResistanceSession({
      sessionId: 'baseline',
      title: 'Voima',
      context: context({ equipment: ['Käsipainot'] }),
    })
    const selected = baseline.exercises.find(
      (exercise) => exercise.keyExercise && exercise.loadContextId,
    )!
    const returned = prescribeAdultResistanceSession({
      sessionId: 'returned',
      title: 'Voima',
      context: context({ equipment: ['Käsipainot'] }),
      history: [
        historyRow('previous', 15, {
          exerciseCode: selected.code,
          exerciseVersion: selected.contentVersion,
          loadType: selected.loadType,
          loadContextId: selected.loadContextId,
        }),
      ],
    })
    expect(totalSets(returned)).toBe(Math.floor(totalSets(baseline) * 0.65))
    expect(returned.exercises.every((exercise) => (exercise.targetRir ?? 0) >= 3)).toBe(
      true,
    )
    const historicalExercise = returned.exercises.find(
      (exercise) => exercise.code === selected.code,
    )
    expect(historicalExercise?.loadGuidance).toContain(
      'Aiempi kuorma – ei tämän harjoituksen automaattinen suositus',
    )
    expect(historicalExercise?.progressionDecision?.action).toBe('RECALIBRATE_LOAD')
  })

  it.each([28, 55])(
    '%i päivän paluublokki käyttää 1–2 sarjaa, RIR 3–4 eikä raskaita alle kuuden toiston sarjoja',
    (days) => {
      const returned = prescribeAdultResistanceSession({
        sessionId: `return-${days}`,
        title: 'Voima',
        context: context(),
        history: [historyRow('previous', days)],
      })
      expect(
        returned.exercises.every((exercise) => exercise.sets >= 1 && exercise.sets <= 2),
      ).toBe(true)
      expect(
        returned.exercises.every(
          (exercise) => exercise.targetRirRange?.join('-') === '3-4',
        ),
      ).toBe(true)
      expect(
        returned.exercises.every(
          (exercise) => Number(exercise.repetitions?.match(/\d+/u)?.[0]) >= 6,
        ),
      ).toBe(true)
      expect(auditStrengthPrescriptionTime(returned).violations).toEqual([])
    },
  )

  it('ei käytä 56+ tauossa vanhaa kg-arviota ja vaatii kaksi uutta liikekohtaista kalibrointia', () => {
    const old = [140, 126, 112, 98, 91, 84, 70, 56].map((days, index) =>
      historyRow(`old-${index}`, days, { loadKg: 40 }),
    )
    const oneNew = historyRow('new-1', 2, { loadKg: 16 })
    const first = prescribeAdultResistanceSession({
      sessionId: 'first',
      title: 'Voima',
      context: context(),
      history: [
        ...old.map((item) => ({
          ...item,
          completedAt: new Date(Date.parse(item.completedAt) - 60 * dayMs).toISOString(),
        })),
        oneNew,
      ],
    })
    const firstEstimate = first.decisionTrace.capabilityEstimates?.find(
      (item) => item.exerciseCode === 'GOBLET_SQUAT',
    )
    expect(firstEstimate?.supportingSessionCount).toBe(1)
    expect(firstEstimate?.calibrationRequired).toBe(true)
    expect(
      first.exercises.find((item) => item.code === 'GOBLET_SQUAT')?.loadGuidance,
    ).not.toContain('40–')

    const rejectedSecondCalibration = prescribeAdultResistanceSession({
      sessionId: 'rejected-second',
      title: 'Voima',
      context: context(),
      history: [
        ...old.map((item) => ({
          ...item,
          completedAt: new Date(Date.parse(item.completedAt) - 60 * dayMs).toISOString(),
        })),
        oneNew,
        historyRow('new-rejected', 1, {
          loadKg: 16,
          severeRecoveryProblem: true,
        }),
      ],
    })
    expect(
      rejectedSecondCalibration.decisionTrace.capabilityEstimates?.find(
        (item) => item.exerciseCode === 'GOBLET_SQUAT',
      )?.calibrationRequired,
    ).toBe(true)
    expect(
      rejectedSecondCalibration.exercises.find((item) => item.code === 'GOBLET_SQUAT')
        ?.progressionDecision?.supportingSessionIds,
    ).toEqual(['new-1'])

    const second = prescribeAdultResistanceSession({
      sessionId: 'second',
      title: 'Voima',
      context: context({
        verifiedNextLoads: [
          {
            exerciseCode: 'GOBLET_SQUAT',
            exerciseVersion: '1.0.0',
            loadContextId: 'adult-resistance-load-context-1.0.0:dumbbell-kg-each',
            currentLoadKg: 16,
            nextAvailableLoadKg: 17,
            confirmedAt: daysBefore(10),
            policyVersion: 'verified-next-load-1.0.0',
          },
        ],
      }),
      history: [
        ...old.map((item) => ({
          ...item,
          completedAt: new Date(Date.parse(item.completedAt) - 60 * dayMs).toISOString(),
        })),
        oneNew,
        historyRow('new-2', 1, { loadKg: 16 }),
      ],
    })
    const secondEstimate = second.decisionTrace.capabilityEstimates?.find(
      (item) => item.exerciseCode === 'GOBLET_SQUAT',
    )
    expect(secondEstimate?.supportingSessionCount).toBe(2)
    expect(secondEstimate?.calibrationRequired).toBe(false)
    expect(
      second.exercises.find((item) => item.code === 'GOBLET_SQUAT')?.progressionDecision
        ?.action,
    ).toBe('KEEP_LOAD')
    expect(
      second.exercises.find((item) => item.code === 'GOBLET_SQUAT')?.loadGuidance,
    ).toContain('Kahden paluun jälkeisen harjoituksen kuorma-arvio on käytettävissä')
    expect(
      second.exercises.find((item) => item.code === 'GOBLET_SQUAT')?.progressionDecision
        ?.reasonCodes,
    ).toContain('PRE_BREAK_LOAD_AUTHORITY_REVOKED')
  })

  it('säilyttää paluuepisodin kuorma-auktoriteetin rajan ACTIVE-tilan jälkeen', () => {
    const preBreak = [140, 126, 112, 98, 91, 84, 70, 56].map((days, index) =>
      historyRow(`pre-break-${index}`, days, { loadKg: 40 }),
    )
    const shiftedPreBreak = preBreak.map((item) => ({
      ...item,
      completedAt: new Date(Date.parse(item.completedAt) - 60 * dayMs).toISOString(),
    }))
    const acceptedReturns = [6, 5, 4, 3].map((days, index) =>
      historyRow(`accepted-return-${index}`, days, {
        loadKg: 16,
        repetitions: 12,
      }),
    )
    const oldVerifiedNextLoad = {
      exerciseCode: 'GOBLET_SQUAT',
      exerciseVersion: '1.0.0',
      loadContextId: 'adult-resistance-load-context-1.0.0:dumbbell-kg-each',
      currentLoadKg: 16,
      nextAvailableLoadKg: 17,
      confirmedAt: daysBefore(120),
      policyVersion: 'verified-next-load-1.0.0',
    } as const

    const afterReentry = prescribeAdultResistanceSession({
      sessionId: 'after-reentry',
      title: 'Voima',
      context: context({ verifiedNextLoads: [oldVerifiedNextLoad] }),
      history: [...shiftedPreBreak, ...acceptedReturns],
    })
    const decision = afterReentry.exercises.find(
      (exercise) => exercise.code === 'GOBLET_SQUAT',
    )?.progressionDecision
    const capability = afterReentry.decisionTrace.capabilityEstimates?.find(
      (estimate) => estimate.exerciseCode === 'GOBLET_SQUAT',
    )

    expect(afterReentry.decisionTrace.strengthReturn).toEqual(
      expect.objectContaining({
        state: 'ACTIVE',
        approvedReturnWorkoutCount: 4,
        historyAuthorityCutoffAt: acceptedReturns[0]!.completedAt,
        reasonCodes: expect.arrayContaining([
          'RETURN_SESSION_ACCEPTED',
          'RETURN_REENTRY_COMPLETED',
          'PRIOR_TRAINING_SOURCE_APP_HISTORY',
        ]),
      }),
    )
    expect(capability).toEqual(
      expect.objectContaining({
        supportingSessionCount: 4,
        calibrationRequired: false,
      }),
    )
    expect(
      afterReentry.exercises.find((item) => item.code === 'GOBLET_SQUAT')?.loadGuidance,
    ).not.toContain('40–')
    expect(decision).toEqual(
      expect.objectContaining({
        action: 'KEEP_LOAD',
        currentLoadKg: 16,
        nextLoadKg: 16,
        reasonCodes: expect.arrayContaining(['NEXT_AVAILABLE_LOAD_NOT_CONFIRMED']),
      }),
    )

    const withPostReturnVerification = prescribeAdultResistanceSession({
      sessionId: 'after-new-verification',
      title: 'Voima',
      context: context({
        verifiedNextLoads: [
          {
            ...oldVerifiedNextLoad,
            confirmedAt: generatedAt,
          },
        ],
      }),
      history: [...shiftedPreBreak, ...acceptedReturns],
    })
    expect(
      withPostReturnVerification.exercises.find(
        (exercise) => exercise.code === 'GOBLET_SQUAT',
      )?.progressionDecision,
    ).toEqual(
      expect.objectContaining({
        action: 'INCREASE_LOAD',
        currentLoadKg: 16,
        nextLoadKg: 17,
        supportingSessionIds: ['accepted-return-2', 'accepted-return-3'],
      }),
    )
  })

  it('tallentaa täsmällisen paluuharjoituksen hylkäyssyyn prescriptionin decision traceen', () => {
    const prescription = prescribeAdultResistanceSession({
      sessionId: 'rejected-return-trace',
      title: 'Voima',
      context: context({ strengthTrainingBackground: userBackground(70) }),
      history: [
        historyRow('too-hard-return', 2, {
          difficultyTooHard: true,
          severeRecoveryProblem: true,
        }),
      ],
    })

    expect(prescription.decisionTrace.strengthReturn?.reasonCodes).toEqual(
      expect.arrayContaining([
        'PRIOR_TRAINING_SOURCE_USER_CONFIRMED',
        'RETURN_SESSION_REJECTED_DIFFICULTY_TOO_HARD',
      ]),
    )
  })

  it('kuljettaa päätöksen resolvePrescription-reitin decision traceen mutta ei muihin harjoitustyyppeihin', () => {
    const strength = resolvePrescription({
      sessionId: 'strength',
      title: 'Voima',
      kind: 'STRENGTH',
      durationMinutes: 45,
      profile: {
        goal: 'GENERAL_FITNESS',
        experience: 'INTERMEDIATE',
        equipment: ['Kehonpaino', 'Käsipainot'],
        physicalLoad: 'MODERATE',
        minutesPerSession: 45,
        age: 35,
        readiness: 'GREEN',
        generatedAt,
        strengthTrainingBackground: userBackground(70),
      },
    })
    expect(strength.status).toBe('SUPPORTED')
    if (strength.status === 'SUPPORTED') {
      expect(strength.prescription.decisionTrace.strengthReturn?.state).toBe(
        'RETURNING_56_PLUS_DAYS',
      )
    }
    const endurance = resolvePrescription({
      sessionId: 'endurance',
      title: 'Kestävyys',
      kind: 'EASY_ENDURANCE',
      durationMinutes: 30,
      profile: {
        goal: 'ENDURANCE',
        experience: 'INTERMEDIATE',
        equipment: ['Kehonpaino'],
        physicalLoad: 'MODERATE',
        minutesPerSession: 30,
        age: 35,
        readiness: 'GREEN',
        generatedAt,
        strengthTrainingBackground: userBackground(70),
      },
    })
    expect(endurance.status).toBe('SUPPORTED')
    if (endurance.status === 'SUPPORTED') {
      expect(endurance.prescription.decisionTrace.strengthReturn).toBeUndefined()
    }
  })

  it('kuljettaa versionoidun paluupäätöksen PlanGeneratorin oikeaan suunnitelmasnapshotiin', () => {
    const plan = generatePlan({
      weekAnchorDate: '2026-08-24',
      calendarTimeZone: 'Europe/Helsinki',
      localDate: '2026-08-25',
      goal: { primary: 'MUSCLE_GAIN', secondary: [], inputs: {} },
      experience: 'INTERMEDIATE',
      availableDays: [1, 3, 5],
      currentEnduranceMinutes: 0,
      fixedSessions: [],
      competitions: [],
      equipment: ['Kehonpaino', 'Käsipainot'],
      physicalLoad: 'MODERATE',
      minutesPerSession: 45,
      age: 35,
      generatedAt,
      strengthTrainingBackground: userBackground(70),
    })
    const strength = plan.decision.sessions.find((session) => session.kind === 'STRENGTH')
    expect(strength?.prescriptionDetail?.decisionTrace.strengthReturn).toEqual(
      expect.objectContaining({
        state: 'RETURNING_56_PLUS_DAYS',
        policyVersion: STRENGTH_RETURN_POLICY_VERSION,
      }),
    )
  })
})
