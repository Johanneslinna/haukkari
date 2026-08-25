import type { ExplainableDecision, ProgressionDecision, ProgressionInput } from './types'

function roundVolume(value: number) {
  return Math.max(0, Math.round(value * 10) / 10)
}

export function evaluateProgression(
  input: ProgressionInput,
): ExplainableDecision<ProgressionDecision> {
  const yellowDays = input.recentReadiness.filter((state) => state === 'YELLOW').length
  const orangeDays = input.recentReadiness.filter(
    (state) => state === 'ORANGE_RECOVERY',
  ).length

  if (yellowDays >= 3 || orangeDays >= 2) {
    return {
      decision: {
        action: 'DELOAD',
        nextWeeklyVolume: roundVolume(input.currentWeeklyVolume * 0.7),
        changedVariable: 'VOLUME',
        missedLoadCarriedOver: false,
      },
      reasons: [
        {
          code: 'READINESS_DELOAD',
          message:
            'Kolme keltaista tai kaksi oranssia päivää keventää viikkomäärää 30 %.',
          priority: 'RECOVERY',
        },
      ],
      warnings: [],
    }
  }

  if (input.adherence < 0.7) {
    return {
      decision: {
        action: 'SIMPLIFY',
        nextWeeklyVolume: roundVolume(input.currentWeeklyVolume * 0.85),
        changedVariable: 'VOLUME',
        missedLoadCarriedOver: false,
      },
      reasons: [
        {
          code: 'LOW_ADHERENCE_SIMPLIFY',
          message:
            'Alle 70 %:n toteuma yksinkertaistaa ohjelmaa kuorman lisäämisen sijasta.',
          priority: 'TIME',
        },
      ],
      warnings: [],
    }
  }

  if (input.missedSession) {
    return {
      decision: {
        action: 'MAINTAIN',
        nextWeeklyVolume: input.currentWeeklyVolume,
        changedVariable: null,
        missedLoadCarriedOver: false,
      },
      reasons: [
        {
          code: 'NO_DOUBLE_LOAD',
          message: 'Väliin jäänyttä harjoitusta ei korvata tuplakuormalla.',
          priority: 'RECOVERY',
        },
      ],
      warnings: [],
    }
  }

  if (input.comparablePlateauPeriods >= 2) {
    return {
      decision: {
        action: 'EVALUATE_PLATEAU',
        nextWeeklyVolume: input.currentWeeklyVolume,
        changedVariable: null,
        missedLoadCarriedOver: false,
      },
      reasons: [
        {
          code: 'PLATEAU_CONFIRMED',
          message:
            'Kaksi vertailukelpoista arviojaksoa mahdollistaa tasanteen syiden arvioinnin.',
          priority: 'PRIMARY_GOAL',
        },
      ],
      warnings: [],
    }
  }

  if (input.previousChangedVariable !== null) {
    return {
      decision: {
        action: 'MAINTAIN',
        nextWeeklyVolume: input.currentWeeklyVolume,
        changedVariable: null,
        missedLoadCarriedOver: false,
      },
      reasons: [
        {
          code: 'ONE_VARIABLE_PER_WEEK',
          message: 'Tälle viikolle on jo muutettu yhtä olennaista harjoittelumuuttujaa.',
          priority: 'RECOVERY',
        },
      ],
      warnings: [],
    }
  }

  if (input.adherence >= 0.85) {
    return {
      decision: {
        action: 'PROGRESS',
        nextWeeklyVolume: roundVolume(input.currentWeeklyVolume * 1.05),
        changedVariable: 'VOLUME',
        missedLoadCarriedOver: false,
      },
      reasons: [
        {
          code: 'CONTROLLED_SINGLE_VARIABLE_PROGRESS',
          message:
            'Hyvä toteuma sallii maltillisen 5 %:n määrän progression yhtenä muuttujana.',
          priority: 'PRIMARY_GOAL',
        },
      ],
      warnings: [],
    }
  }

  return {
    decision: {
      action: 'MAINTAIN',
      nextWeeklyVolume: input.currentWeeklyVolume,
      changedVariable: null,
      missedLoadCarriedOver: false,
    },
    reasons: [
      {
        code: 'MAINTAIN_LOAD',
        message:
          'Nykyinen kuorma säilytetään, koska muutokselle ei ole riittävää perustetta.',
        priority: 'RECOVERY',
      },
    ],
    warnings: [],
  }
}

export const ProgressionEngine = { evaluate: evaluateProgression }
