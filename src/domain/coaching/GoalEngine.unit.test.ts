import { describe, expect, it } from 'vitest'
import { evaluateGoalConflicts } from './ConflictEngine'
import {
  confirmGoalChange,
  previewGoalChange,
  previewPreviousGoalRestore,
} from './GoalEngine'
import { getGoalStrategy, goalStrategies } from './strategies'
import type {
  GoalConflictCode,
  GoalConflictContext,
  GoalHistory,
  GoalProfile,
} from './types'

const originalGoal: GoalProfile = {
  primary: 'GENERAL_FITNESS',
  secondary: ['BODY_RECOMPOSITION'],
  inputs: {},
}

function existingHistory(): GoalHistory {
  return {
    activePeriodId: 'period-old',
    periods: [
      {
        id: 'period-old',
        goal: originalGoal,
        startsOn: '2026-06-01',
        endsOn: null,
        planVersionId: 'plan-old',
      },
    ],
    planVersions: [
      {
        id: 'plan-old',
        goalPeriodId: 'period-old',
        goal: originalGoal,
        startsOn: '2026-06-01',
        createdAt: '2026-05-30T10:00:00.000Z',
        transitionWeek: false,
        strategyId: 'GENERAL_FITNESS',
      },
    ],
  }
}

describe('GoalEngine ja ConflictEngine', () => {
  it('16: vaihtaa päätavoitteen uutena versiona ja säilyttää vanhan historian', () => {
    const history = existingHistory()
    const proposed: GoalProfile = { primary: 'ENDURANCE', secondary: [], inputs: {} }
    const preview = previewGoalChange(history, proposed, {
      today: '2026-08-24',
      providedInputs: getGoalStrategy('ENDURANCE').requiredInputs,
    })
    const result = confirmGoalChange(history, preview.decision, {
      confirmed: true,
      goalPeriodId: 'period-new',
      planVersionId: 'plan-new',
      createdAt: '2026-08-24T12:00:00.000Z',
    })

    expect(result.decision.history.activePeriodId).toBe('period-new')
    expect(result.decision.history.periods).toHaveLength(2)
    expect(result.decision.history.planVersions.map((plan) => plan.id)).toEqual([
      'plan-old',
      'plan-new',
    ])
    expect(result.decision.history.periods[0]?.endsOn).toBe('2026-08-30')
    expect(history.periods[0]?.endsOn).toBeNull()
  })

  it('17: ei aktivoi tavoitetta ilman GoalEngine-esikatselua ja vahvistusta', () => {
    const history = existingHistory()
    expect(() =>
      confirmGoalChange(
        history,
        { kind: 'väärä' },
        {
          confirmed: true,
          goalPeriodId: 'new',
          planVersionId: 'new-plan',
          createdAt: '2026-08-24T12:00:00.000Z',
        },
      ),
    ).toThrow('esikatselun')

    const preview = previewGoalChange(
      history,
      { primary: 'GENERAL_FITNESS', secondary: [], inputs: {} },
      {
        today: '2026-08-24',
        providedInputs: getGoalStrategy('GENERAL_FITNESS').requiredInputs,
      },
    )
    expect(() =>
      confirmGoalChange(history, preview.decision, {
        confirmed: false,
        goalPeriodId: 'new',
        planVersionId: 'new-plan',
        createdAt: '2026-08-24T12:00:00.000Z',
      }),
    ).toThrow('vahvistettu')
  })

  it('18: rasvanpudotus ja maksimaalinen lihaskasvu tuottavat konfliktin', () => {
    const result = evaluateGoalConflicts({
      primary: 'FAT_LOSS',
      secondary: ['MUSCLE_GAIN'],
      maximalMuscleGainRequested: true,
    })
    expect(result.decision.map((conflict) => conflict.code)).toContain(
      'FAT_LOSS_VS_MAXIMAL_MUSCLE_GAIN',
    )
  })

  it('19: maraton- ja maksimivoimahuippu vaativat käyttäjän kompromissin', () => {
    const history = existingHistory()
    const preview = previewGoalChange(
      history,
      { primary: 'ENDURANCE', secondary: ['MAX_STRENGTH'], inputs: {} },
      {
        today: '2026-08-24',
        providedInputs: getGoalStrategy('ENDURANCE').requiredInputs,
        conflictContext: { marathonPeak: true, maxStrengthPeak: true },
      },
    )
    expect(preview.decision.conflicts[0]?.code).toBe('MARATHON_PEAK_VS_MAX_STRENGTH_PEAK')
    expect(() =>
      confirmGoalChange(history, preview.decision, {
        confirmed: true,
        goalPeriodId: 'new',
        planVersionId: 'new-plan',
        createdAt: '2026-08-24T12:00:00.000Z',
      }),
    ).toThrow('käyttäjän valinnan')
  })

  it('toteuttaa kaikki yhdeksän tavoitetta erillisinä strategioina', () => {
    expect(Object.keys(goalStrategies)).toHaveLength(9)
    expect(
      new Set(Object.values(goalStrategies).map((strategy) => strategy.id)).size,
    ).toBe(9)
    for (const strategy of Object.values(goalStrategies)) {
      expect(strategy.requiredInputs.length).toBeGreaterThan(0)
      expect(strategy.progression.length).toBeGreaterThan(0)
      expect(strategy.metrics.length).toBeGreaterThan(0)
    }
  })

  it.each<{ code: GoalConflictCode; context: GoalConflictContext }>([
    {
      code: 'FAT_LOSS_VS_MAXIMAL_MUSCLE_GAIN',
      context: {
        primary: 'FAT_LOSS',
        secondary: ['MUSCLE_GAIN'],
        maximalMuscleGainRequested: true,
      },
    },
    {
      code: 'LARGE_DEFICIT_VS_COMPETITION',
      context: {
        primary: 'SPORT_PERFORMANCE',
        secondary: [],
        energyDeficit: 'LARGE',
        competitionPeak: 'A_EVENT',
      },
    },
    {
      code: 'MARATHON_PEAK_VS_MAX_STRENGTH_PEAK',
      context: {
        primary: 'ENDURANCE',
        secondary: ['MAX_STRENGTH'],
        marathonPeak: true,
        maxStrengthPeak: true,
      },
    },
    {
      code: 'RUN_VOLUME_VS_LOWER_HYPERTROPHY',
      context: {
        primary: 'MUSCLE_GAIN',
        secondary: ['ENDURANCE'],
        highRunningVolume: true,
        highLowerBodyHypertrophy: true,
      },
    },
    {
      code: 'SPEED_WHILE_FATIGUED',
      context: {
        primary: 'SPEED_POWER',
        secondary: [],
        speedSessionWhileFatigued: true,
      },
    },
    {
      code: 'TWO_A_EVENTS',
      context: {
        primary: 'SPORT_PERFORMANCE',
        secondary: [],
        simultaneousAEvents: 2,
      },
    },
    {
      code: 'WEIGHT_LOSS_VS_LOW_ENERGY',
      context: {
        primary: 'FAT_LOSS',
        secondary: [],
        lowEnergyAvailabilitySigns: true,
      },
    },
  ])('tunnistaa konfliktisäännön $code', ({ code, context }) => {
    expect(
      evaluateGoalConflicts(context).decision.map((conflict) => conflict.code),
    ).toContain(code)
  })

  it('hylkää vanhentuneen tai muokatun esikatselun', () => {
    const history = existingHistory()
    const preview = previewGoalChange(
      history,
      { primary: 'GENERAL_FITNESS', secondary: [], inputs: {} },
      {
        today: '2026-08-24',
        providedInputs: getGoalStrategy('GENERAL_FITNESS').requiredInputs,
      },
    )
    expect(() =>
      confirmGoalChange(
        history,
        { ...preview.decision, token: 'muokattu' },
        {
          confirmed: true,
          goalPeriodId: 'new',
          planVersionId: 'new-plan',
          createdAt: '2026-08-24T12:00:00.000Z',
        },
      ),
    ).toThrow('virheellinen tai vanhentunut')
  })

  it('palauttaa aiemman tavoitteen vain uutena esikatseltavana versiona', () => {
    const history = existingHistory()
    const firstPreview = previewGoalChange(
      history,
      { primary: 'ENDURANCE', secondary: [], inputs: {} },
      {
        today: '2026-08-24',
        providedInputs: getGoalStrategy('ENDURANCE').requiredInputs,
      },
    )
    const changed = confirmGoalChange(history, firstPreview.decision, {
      confirmed: true,
      goalPeriodId: 'period-new',
      planVersionId: 'plan-new',
      createdAt: '2026-08-24T12:00:00.000Z',
    })
    const restorePreview = previewPreviousGoalRestore(changed.decision.history, {
      today: '2026-09-01',
    })

    expect(restorePreview.decision.proposedGoal.primary).toBe('GENERAL_FITNESS')
    expect(restorePreview.reasons[0]?.code).toBe('PREVIOUS_GOAL_RESTORE_PREVIEW')
    expect(changed.decision.history.periods).toHaveLength(2)
  })

  it('turvallisuuskonflikti ohittaa painonpudotustavoitteen', () => {
    const result = evaluateGoalConflicts({
      primary: 'FAT_LOSS',
      secondary: [],
      lowEnergyAvailabilitySigns: true,
    })
    expect(result.decision[0]).toMatchObject({
      code: 'WEIGHT_LOSS_VS_LOW_ENERGY',
      severity: 'BLOCKING',
    })
    expect(result.reasons[0]?.priority).toBe('SAFETY')
  })
})
