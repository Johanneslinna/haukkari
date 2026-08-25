import type {
  ExplainableDecision,
  PrescribedSession,
  WorkoutFeedback,
  WorkoutProgressionDecision,
} from './types'
import {
  legacyDose,
  normalizePrescriptionV2,
  withExerciseDose,
} from './PrescriptionContract'

function isSuccessful(feedback: WorkoutFeedback) {
  const reportedRirs =
    feedback.exerciseResults?.flatMap((result) =>
      (result.rirs ?? []).flatMap((rir) =>
        typeof rir === 'number'
          ? [{ rir, target: Math.max(0, 10 - result.targetRpe) }]
          : [],
      ),
    ) ?? []
  const rirAcceptable =
    reportedRirs.length === 0 ||
    reportedRirs.every(({ rir, target }) => rir >= target && rir <= target + 1)
  return (
    feedback.completionStatus === 'COMPLETED' &&
    feedback.pain === 'NONE' &&
    feedback.felt !== 'WORSE' &&
    feedback.sessionRpe >= 4 &&
    feedback.sessionRpe <= 8 &&
    rirAcceptable
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
        message:
          'Vertailukelpoinen toteuma puuttuu. Kirjaa vastaavasta harjoituksesta tehdyt sarjat tai työosuudet sekä koko harjoituksen RPE ja kipupalaute.',
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
        'Nykyinen annos säilyy. Kuorman nostaminen vaatii kaksi peräkkäistä onnistunutta, kivutonta ja vertailukelpoista toteumaa; tämänhetkinen palaute ei vielä täytä ehtoa.',
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
  const normalized = normalizePrescriptionV2(prescription)
  if (
    decision.action === 'MAINTAIN' ||
    decision.action === 'RECOVERY' ||
    decision.action === 'REFER'
  ) {
    return {
      ...normalized,
      decisionTrace: {
        ...normalized.decisionTrace,
        safetyOutcome:
          decision.safetyOutcome === 'REFER'
            ? 'REFER'
            : normalized.decisionTrace.safetyOutcome,
        rules: [
          ...normalized.decisionTrace.rules,
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

  const exercises = normalized.exercises.map((exercise) => {
    if (decision.action !== 'REDUCE_LOAD') return exercise
    const dose = legacyDose(exercise)
    const targetRpe = Math.max(3, dose.targetRpe - 1)
    switch (dose.kind) {
      case 'STRENGTH_SETS':
        return withExerciseDose(exercise, {
          ...dose,
          sets: Math.max(1, dose.sets - 1),
          targetRpe,
          targetRir: dose.targetRir ? Math.min(5, dose.targetRir + 1) : undefined,
        })
      case 'CONTINUOUS_TIME':
        return withExerciseDose(exercise, {
          ...dose,
          durationSeconds: Math.max(60, Math.round(dose.durationSeconds * 0.8)),
          targetRpe,
        })
      case 'INTERVAL_BLOCKS':
      case 'SPRINT_REPS':
        return withExerciseDose(exercise, {
          ...dose,
          repetitions: Math.max(1, dose.repetitions - 1),
          targetRpe,
        })
      case 'JUMP_REPS':
        return withExerciseDose(exercise, {
          ...dose,
          sets: Math.max(1, dose.sets - 1),
          targetRpe,
        })
      case 'SKILL_DRILL':
        return withExerciseDose(exercise, {
          ...dose,
          sets: Math.max(1, dose.sets - 1),
          durationSeconds: dose.durationSeconds
            ? Math.max(60, Math.round(dose.durationSeconds * 0.8))
            : undefined,
          targetRpe,
        })
    }
  })
  return {
    ...normalized,
    exercises,
    blocks: exercises,
    decisionTrace: {
      ...normalized.decisionTrace,
      safetyOutcome:
        decision.safetyOutcome === 'MODIFY'
          ? 'MODIFY'
          : normalized.decisionTrace.safetyOutcome,
      rules: [
        ...normalized.decisionTrace.rules,
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
