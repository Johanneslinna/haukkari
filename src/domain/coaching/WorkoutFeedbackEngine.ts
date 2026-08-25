import type {
  ExplainableDecision,
  PrescribedSession,
  WorkoutFeedback,
  WorkoutProgressionDecision,
} from './types'

function isSuccessful(feedback: WorkoutFeedback) {
  return (
    feedback.completionStatus === 'COMPLETED' &&
    feedback.pain === 'NONE' &&
    feedback.felt !== 'WORSE' &&
    feedback.sessionRpe >= 4 &&
    feedback.sessionRpe <= 8
  )
}

export function evaluateWorkoutFeedback(
  feedback: WorkoutFeedback[],
  currentExerciseCodes: string[] = [],
): ExplainableDecision<WorkoutProgressionDecision> {
  const comparableFeedback = currentExerciseCodes.length
    ? feedback.filter((item) =>
        item.exerciseResults?.some((result) =>
          currentExerciseCodes.includes(result.exerciseCode),
        ),
      )
    : feedback
  const latest = comparableFeedback.at(-1)
  if (!latest) {
    return {
      decision: {
        action: 'MAINTAIN',
        safetyOutcome: 'PROCEED',
        setDelta: 0,
        targetRpeDelta: 0,
        message: 'Palautetta ei ole vielä riittävästi muutokseen.',
        ruleId: 'FEEDBACK-NONE-001',
      },
      reasons: [],
      warnings: [],
    }
  }

  if (latest.pain === 'SEVERE') {
    return {
      decision: {
        action: 'REFER',
        safetyOutcome: 'REFER',
        setDelta: -1,
        targetRpeDelta: -1,
        message:
          'Voimakas kipupalaute estää kuorman nostamisen ja ohjaa terveydenhuollon arvioon ennen kovaa harjoittelua.',
        ruleId: 'FEEDBACK-PAIN-RED-001',
      },
      reasons: [
        {
          code: 'SEVERE_PAIN_REQUIRES_REVIEW',
          message: 'Edellisessä harjoituksessa kirjattiin voimakasta kipua.',
          priority: 'SAFETY',
        },
      ],
      warnings: ['Älä käytä sovellusta vamman diagnoosiin tai hoidon korvaamiseen.'],
    }
  }

  if (
    latest.pain === 'MODERATE' ||
    (latest.completionStatus === 'STOPPED' &&
      latest.stopReason !== 'EQUIPMENT' &&
      latest.stopReason !== 'TECHNIQUE') ||
    latest.felt === 'WORSE'
  ) {
    return {
      decision: {
        action: 'RECOVERY',
        safetyOutcome: 'MODIFY',
        setDelta: -1,
        targetRpeDelta: -1,
        message:
          'Kipu, keskeytys tai huonontunut olo vaihtaa seuraavan kovan ärsykkeen palauttavaan versioon.',
        ruleId: 'FEEDBACK-RECOVERY-001',
      },
      reasons: [
        {
          code: 'RECOVERY_AFTER_ADVERSE_RESPONSE',
          message: 'Edellisen harjoituksen vaste ei tue kuorman lisäämistä.',
          priority: 'SAFETY',
        },
      ],
      warnings: [],
    }
  }

  if (
    latest.completionStatus === 'PARTIAL' ||
    latest.difficulty === 'TOO_HARD' ||
    latest.sessionRpe >= 9
  ) {
    return {
      decision: {
        action: 'REDUCE_LOAD',
        safetyOutcome: 'MODIFY',
        setDelta: -1,
        targetRpeDelta: -1,
        message:
          'Seuraavasta harjoituksesta vähennetään yksi sarja ja tavoite-RPE:tä lasketaan yhdellä.',
        ruleId: 'FEEDBACK-LOAD-DOWN-001',
      },
      reasons: [
        {
          code: 'LOAD_EXCEEDED_TOLERANCE',
          message: 'Toteuma tai koettu rasittavuus ylitti tavoitellun kuormituksen.',
          priority: 'RECOVERY',
        },
      ],
      warnings: [],
    }
  }

  const recentSuccesses = comparableFeedback.slice(-2).filter(isSuccessful).length
  if (recentSuccesses === 2 && latest.difficulty === 'TOO_EASY') {
    return {
      decision: {
        action: 'PROGRESS_LOAD',
        safetyOutcome: 'PROCEED',
        setDelta: 0,
        targetRpeDelta: 0,
        message:
          'Kaksi vertailukelpoista, onnistunutta ja kivutonta toteumaa tukevat pienintä mahdollista kuorman lisäystä tai yhtä lisätoistoa.',
        ruleId: 'FEEDBACK-PROGRESS-001',
      },
      reasons: [
        {
          code: 'TWO_SUCCESSFUL_EXPOSURES',
          message:
            'Vertailukelpoinen palaute tukee yhden muuttujan maltillista etenemistä.',
          priority: 'PRIMARY_GOAL',
        },
      ],
      warnings: [],
    }
  }

  return {
    decision: {
      action: 'MAINTAIN',
      safetyOutcome: 'PROCEED',
      setDelta: 0,
      targetRpeDelta: 0,
      message:
        'Nykyinen annos säilytetään, kunnes vertailukelpoista palautetta on lisää.',
      ruleId: 'FEEDBACK-MAINTAIN-001',
    },
    reasons: [
      {
        code: 'NO_SINGLE_SESSION_OVERREACTION',
        message: 'Yksi tavallinen harjoitus ei yksinään käynnistä progression muutosta.',
        priority: 'RECOVERY',
      },
    ],
    warnings: [],
  }
}

export function applyWorkoutProgression(
  prescription: PrescribedSession,
  decision: WorkoutProgressionDecision,
): PrescribedSession {
  if (
    decision.action === 'MAINTAIN' ||
    decision.action === 'RECOVERY' ||
    decision.action === 'REFER'
  ) {
    return {
      ...prescription,
      decisionTrace: {
        ...prescription.decisionTrace,
        safetyOutcome:
          decision.safetyOutcome === 'REFER'
            ? 'REFER'
            : prescription.decisionTrace.safetyOutcome,
        rules: [
          ...prescription.decisionTrace.rules,
          {
            ruleId: decision.ruleId,
            outcome: decision.safetyOutcome,
            message: decision.message,
            evidenceIds: ['APP-FEEDBACK-PROGRESSION-RULE'],
          },
        ],
      },
    }
  }

  return {
    ...prescription,
    exercises: prescription.exercises.map((exercise) => {
      if (decision.action === 'REDUCE_LOAD') {
        return {
          ...exercise,
          sets: Math.max(1, exercise.sets - 1),
          targetRpe: Math.max(3, exercise.targetRpe - 1),
          targetRir: exercise.targetRir ? Math.min(5, exercise.targetRir + 1) : undefined,
        }
      }
      return exercise
    }),
    decisionTrace: {
      ...prescription.decisionTrace,
      safetyOutcome:
        decision.safetyOutcome === 'MODIFY'
          ? 'MODIFY'
          : prescription.decisionTrace.safetyOutcome,
      rules: [
        ...prescription.decisionTrace.rules,
        {
          ruleId: decision.ruleId,
          outcome: decision.safetyOutcome,
          message: decision.message,
          evidenceIds: ['APP-FEEDBACK-PROGRESSION-RULE'],
        },
      ],
    },
  }
}

export const WorkoutFeedbackEngine = {
  apply: applyWorkoutProgression,
  evaluate: evaluateWorkoutFeedback,
}
