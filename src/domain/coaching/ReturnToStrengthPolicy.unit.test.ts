import { describe, expect, it } from 'vitest'
import {
  evaluateStrengthReturn,
  reduceReturnWorkingSets,
  STRENGTH_RETURN_POLICY_VERSION,
  type AdultResistanceSetHistory,
  type ExercisePrescription,
  type StrengthTrainingBackground,
} from '.'

const generatedAt = '2026-08-25T12:00:00.000Z'
const dayMs = 86_400_000

function daysBefore(days: number) {
  return new Date(Date.parse(generatedAt) - days * dayMs).toISOString()
}

function row(
  sessionId: string | undefined,
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
    repetitions: 8,
    rir: 3,
    completedAt: daysBefore(days),
    pain: false,
    techniqueOk: true,
    completionStatus: 'COMPLETED',
    doseCompleted: true,
    targetRirMin: 3,
    targetRirMax: 4,
    stopped: false,
    severeRecoveryProblem: false,
    difficultyTooHard: false,
    feltWorse: false,
    sessionRpeNineOrMore: false,
    ...patch,
  }
}

function background(days: number): StrengthTrainingBackground {
  return {
    regularTrainingAtLeast12Weeks: true,
    lastStrengthWorkoutAt: daysBefore(days),
    source: 'USER_CONFIRMED',
    confirmedAt: generatedAt,
    policyVersion: STRENGTH_RETURN_POLICY_VERSION,
  }
}

describe('ReturnToStrengthPolicy boundaries', () => {
  it.each([
    [7, 'ACTIVE'],
    [8, 'BREAK_8_TO_14_DAYS'],
    [14, 'BREAK_8_TO_14_DAYS'],
    [15, 'BREAK_15_TO_27_DAYS'],
    [27, 'BREAK_15_TO_27_DAYS'],
    [28, 'RETURN_BLOCK_28_TO_55_DAYS'],
    [55, 'RETURN_BLOCK_28_TO_55_DAYS'],
    [56, 'RETURNING_56_PLUS_DAYS'],
    [70, 'RETURNING_56_PLUS_DAYS'],
  ] as const)('luokittelee %i päivän tauon tilaan %s', (days, state) => {
    const decision = evaluateStrengthReturn({
      history: days >= 56 ? [] : [row('previous', days)],
      generatedAt,
      background: days >= 56 ? background(days) : undefined,
    })
    expect(decision.state).toBe(state)
    expect(decision.breakDays).toBe(days)
  })

  it('ei päättele puuttuvasta tai legacy-historiasta RETURNING-tilaa', () => {
    expect(evaluateStrengthReturn({ history: [], generatedAt }).state).toBe(
      'NOVICE_COLD_START',
    )
    expect(
      evaluateStrengthReturn({ history: [row(undefined, 70)], generatedAt }).state,
    ).toBe('NOVICE_COLD_START')
    expect(
      evaluateStrengthReturn({ history: [row('single-old-session', 70)], generatedAt })
        .state,
    ).toBe('NOVICE_COLD_START')
  })

  it('hylkää vanhentuneen tai ristiriitaisen käyttäjävahvistuksen cold start -tilaan', () => {
    expect(
      evaluateStrengthReturn({
        history: [],
        generatedAt,
        background: {
          ...background(70),
          policyVersion: 'adult-strength-return-0.9.0',
        },
      }).state,
    ).toBe('NOVICE_COLD_START')
    expect(
      evaluateStrengthReturn({
        history: [],
        generatedAt,
        background: {
          ...background(70),
          lastStrengthWorkoutAt: daysBefore(-1),
        },
      }).state,
    ).toBe('NOVICE_COLD_START')
  })

  it('jättää tulevaisuuden ja virheelliset aikaleimat huomiotta', () => {
    const decision = evaluateStrengthReturn({
      history: [
        row('real', 10),
        row('future', -2),
        row('invalid', 0, { completedAt: 'not-a-date' }),
      ],
      generatedAt,
    })
    expect(decision.state).toBe('BREAK_8_TO_14_DAYS')
    expect(decision.breakDays).toBe(10)
  })
})

describe('ReturnToStrengthPolicy episodes and approval', () => {
  const regularPreBreak = [140, 126, 112, 98, 91, 84, 70, 56].map((days, index) =>
    row(`pre-${index}`, days),
  )

  it('tunnistaa 12 viikon sovellushistorian ja vaatii neljä hyväksyttyä paluuta', () => {
    const decision = evaluateStrengthReturn({ history: regularPreBreak, generatedAt })
    expect(decision).toEqual(
      expect.objectContaining({
        state: 'RETURNING_56_PLUS_DAYS',
        source: 'APP_HISTORY',
        requiredApprovedWorkoutCount: 4,
      }),
    )
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining([
        'APP_HISTORY_CONTINUITY_CONFIRMED',
        'APP_HISTORY_EIGHT_SESSIONS_CONFIRMED',
        'APP_HISTORY_EIGHTY_FOUR_DAY_SPAN_CONFIRMED',
        'PRIOR_TRAINING_SOURCE_APP_HISTORY',
      ]),
    )
  })

  it('vaatii APP_HISTORY-lähteeltä sekä kahdeksan harjoitusta että 84 kokonaista vuorokautta', () => {
    const sevenSessions = regularPreBreak.slice(1)
    const eightSessionsOver83Days = [139, 127, 115, 103, 91, 79, 67, 56].map(
      (days, index) => row(`span-83-${index}`, days),
    )

    for (const history of [sevenSessions, eightSessionsOver83Days]) {
      const decision = evaluateStrengthReturn({ history, generatedAt })
      expect(decision.state).toBe('NOVICE_COLD_START')
      expect(decision.reasonCodes).not.toContain('APP_HISTORY_CONTINUITY_CONFIRMED')
    }
  })

  it('laskee yhden harjoituksen useat sarjat vain yhdeksi hyväksytyksi paluuksi', () => {
    const firstReturn = row('return-1', 2)
    const decision = evaluateStrengthReturn({
      history: [
        ...regularPreBreak.map((item) => ({
          ...item,
          completedAt: new Date(Date.parse(item.completedAt) - 60 * dayMs).toISOString(),
        })),
        firstReturn,
        { ...firstReturn, repetitions: 9 },
      ],
      generatedAt,
    })
    expect(decision.state).toBe('RETURNING_56_PLUS_DAYS')
    expect(decision.approvedReturnWorkoutCount).toBe(1)
    expect(decision.episodeStartedAt).toBe(daysBefore(2))
  })

  it.each([
    ['kipu', { pain: true }, 'RETURN_SESSION_REJECTED_PAIN'],
    ['tekniikkavirhe', { techniqueOk: false }, 'RETURN_SESSION_REJECTED_TECHNIQUE'],
    ['vajaa annos', { doseCompleted: false }, 'RETURN_SESSION_REJECTED_INCOMPLETE_DOSE'],
    [
      'keskeytys',
      { completionStatus: 'STOPPED' as const, stopped: true },
      'RETURN_SESSION_REJECTED_STOP',
    ],
    ['väärä RIR', { rir: 1 }, 'RETURN_SESSION_REJECTED_RIR_OUTSIDE_TARGET'],
    [
      'liian vaikea',
      { difficultyTooHard: true },
      'RETURN_SESSION_REJECTED_DIFFICULTY_TOO_HARD',
    ],
    ['huonompi olo', { feltWorse: true }, 'RETURN_SESSION_REJECTED_FELT_WORSE'],
    [
      'session RPE vähintään yhdeksän',
      { sessionRpeNineOrMore: true },
      'RETURN_SESSION_REJECTED_RPE_NINE_OR_MORE',
    ],
    [
      'legacy-palautumisongelma',
      { severeRecoveryProblem: true },
      'RETURN_SESSION_REJECTED_SEVERE_RECOVERY_PROBLEM',
    ],
  ])('%s ei kasvata hyväksyttyjen paluuharjoitusten laskuria', (_, patch, reasonCode) => {
    const shiftedPreBreak = regularPreBreak.map((item) => ({
      ...item,
      completedAt: new Date(Date.parse(item.completedAt) - 60 * dayMs).toISOString(),
    }))
    const decision = evaluateStrengthReturn({
      history: [
        shiftedPreBreak[0]!,
        ...shiftedPreBreak.slice(1),
        row('return', 2, patch),
      ],
      generatedAt,
    })
    expect(decision.approvedReturnWorkoutCount).toBe(0)
    expect(decision.reasonCodes).toContain(reasonCode)
  })

  it('poistuu sovellushistoriaan perustuvasta RETURNING-tilasta vasta neljännellä hyväksytyllä kerralla', () => {
    const shiftedPreBreak = regularPreBreak.map((item) => ({
      ...item,
      completedAt: new Date(Date.parse(item.completedAt) - 60 * dayMs).toISOString(),
    }))
    const returns = [6, 5, 4, 3].map((days, index) => row(`return-${index}`, days))
    expect(
      evaluateStrengthReturn({
        history: [...shiftedPreBreak, ...returns.slice(0, 3)],
        generatedAt,
      }).state,
    ).toBe('RETURNING_56_PLUS_DAYS')
    const completed = evaluateStrengthReturn({
      history: [...shiftedPreBreak, ...returns],
      generatedAt,
    })
    expect(completed.state).toBe('ACTIVE')
    expect(completed.historyAuthorityCutoffAt).toBe(returns[0]!.completedAt)
    expect(completed.reasonCodes).toEqual(
      expect.arrayContaining([
        'RETURN_SESSION_ACCEPTED',
        'RETURN_REENTRY_COMPLETED',
        'PRIOR_TRAINING_SOURCE_APP_HISTORY',
      ]),
    )
  })

  it('vaatii käyttäjän vahvistamaan taustaan perustuvassa paluussa kuusi hyväksyttyä harjoitusta', () => {
    const returns = [6, 5, 4, 3, 2, 1].map((days, index) =>
      row(`confirmed-return-${index}`, days),
    )
    for (const count of [4, 5]) {
      expect(
        evaluateStrengthReturn({
          history: returns.slice(0, count),
          generatedAt,
          background: background(100),
        }).state,
      ).toBe('RETURNING_56_PLUS_DAYS')
    }
    const completed = evaluateStrengthReturn({
      history: returns,
      generatedAt,
      background: background(100),
    })
    expect(completed.state).toBe('ACTIVE')
    expect(completed.approvedReturnWorkoutCount).toBe(6)
    expect(completed.requiredApprovedWorkoutCount).toBe(6)
    expect(completed.reasonCodes).toEqual(
      expect.arrayContaining([
        'PRIOR_TRAINING_SOURCE_USER_CONFIRMED',
        'RETURN_SESSION_ACCEPTED',
        'RETURN_REENTRY_COMPLETED',
      ]),
    )
  })

  it('säilyttää 8–27 päivän jakson seitsemän ja 28–55 päivän jakson 14 päivää ensimmäisestä toteutuneesta paluusta', () => {
    const short = evaluateStrengthReturn({
      history: [row('pre', 18), row('return', 5)],
      generatedAt,
    })
    expect(short.state).toBe('BREAK_8_TO_14_DAYS')
    expect(short.reentryEndsAt).toBe(
      new Date(Date.parse(daysBefore(5)) + 7 * dayMs).toISOString(),
    )

    const block = evaluateStrengthReturn({
      history: [row('pre', 45), row('return', 5)],
      generatedAt,
    })
    expect(block.state).toBe('RETURN_BLOCK_28_TO_55_DAYS')
    expect(block.reentryEndsAt).toBe(
      new Date(Date.parse(daysBefore(5)) + 14 * dayMs).toISOString(),
    )
    expect(
      evaluateStrengthReturn({
        history: [row('short-pre', 17), row('short-return', 7)],
        generatedAt,
      }).state,
    ).toBe('ACTIVE')
    expect(
      evaluateStrengthReturn({
        history: [
          row('block-pre', 60),
          row('block-return', 20),
          row('block-follow-up-1', 14),
          row('block-follow-up-2', 7),
        ],
        generatedAt,
      }).state,
    ).toBe('ACTIVE')
  })
})

describe('return working set reduction', () => {
  const exercise = (id: string, sets: number, keyExercise: boolean) =>
    ({
      id,
      code: id,
      nameFi: id,
      category: 'STRENGTH',
      equipment: ['Kehonpaino'],
      instructionsFi: 'Ohje',
      sets,
      repetitions: '8–12',
      restSeconds: 90,
      targetRpe: 7,
      targetRir: 3,
      loadGuidance: 'Ohje',
      stopCondition: 'Lopeta',
      substitutions: [],
      loadType: 'BODYWEIGHT',
      loadLabelFi: 'Variaatio',
      keyExercise,
      dose: {
        kind: 'STRENGTH_SETS',
        sets,
        repetitions: '8–12',
        restSeconds: 90,
        targetRpe: 7,
        targetRir: 3,
      },
    }) satisfies ExercisePrescription

  it('poistaa ensin apuliikesarjat ja säilyttää jokaisessa pääliikkeessä vähintään yhden', () => {
    const reduced = reduceReturnWorkingSets(
      [
        exercise('main-1', 3, true),
        exercise('main-2', 3, true),
        exercise('accessory', 4, false),
      ],
      0.65,
    )
    expect(reduced.reduce((sum, item) => sum + item.sets, 0)).toBe(6)
    expect(
      reduced.filter((item) => item.keyExercise).every((item) => item.sets >= 1),
    ).toBe(true)
    expect(reduced.find((item) => item.code === 'accessory')?.sets ?? 0).toBe(0)
  })
})
