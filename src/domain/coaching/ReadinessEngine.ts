import type {
  ExplainableDecision,
  ReadinessDecision,
  ReadinessInput,
  SafetySymptom,
} from './types'

const emergencySymptoms = new Set<SafetySymptom>([
  'CHEST_PAIN',
  'FAINTING',
  'UNUSUAL_BREATHLESSNESS',
  'NEW_NEUROLOGICAL_SYMPTOM',
])

const safetyLabels: Record<SafetySymptom, string> = {
  CHEST_PAIN: 'rintakipu',
  FAINTING: 'pyörtyminen',
  UNUSUAL_BREATHLESSNESS: 'poikkeava hengitysvaikeus',
  NEW_NEUROLOGICAL_SYMPTOM: 'uusi neurologinen oire',
  FEVER: 'kuume',
  SIGNIFICANT_DEHYDRATION: 'merkittävä kuivuminen',
  SEVERE_ACUTE_PAIN: 'voimakas akuutti kipu',
  JOINT_GIVING_WAY: 'nivelen pettäminen',
}

const calfAssessmentAction =
  'Älä harjoittele. Hakeudu nopeasti terveydenhuollon arvioon toispuoleisen, lisääntyvän pohjeturvotuksen ja levossa tuntuvan kivun vuoksi.'

function compactVariant(availableMinutes: number): 10 | 20 | 30 | null {
  if (availableMinutes < 10) return null
  if (availableMinutes < 20) return 10
  if (availableMinutes < 30) return 20
  if (availableMinutes < 45) return 30
  return null
}

export function evaluateReadiness(
  input: ReadinessInput,
): ExplainableDecision<ReadinessDecision> {
  const gaitAlteringPain = input.newPain?.altersGait === true
  const severeNewPain = input.newPain?.severity === 'SEVERE'
  const unilateralCalfAssessment =
    input.vascularSymptoms?.rapidlyIncreasingUnilateralCalfSwelling === true &&
    input.vascularSymptoms?.painAtRest === true

  if (
    input.safetySymptoms.length > 0 ||
    gaitAlteringPain ||
    severeNewPain ||
    unilateralCalfAssessment
  ) {
    const hasEmergencySymptom = input.safetySymptoms.some((symptom) =>
      emergencySymptoms.has(symptom),
    )
    const symptoms = input.safetySymptoms
      .map((symptom) => safetyLabels[symptom])
      .join(', ')
    const gaitInstruction = gaitAlteringPain
      ? 'Kävelyä tai askelta muuttava kipu pysäyttää tämän harjoituksen. Hakeudu oireen arvioon ennen kuormittavan harjoittelun jatkamista.'
      : null
    const action = hasEmergencySymptom
      ? 'Älä harjoittele. Hakeudu heti päivystysarvioon; henkeä uhkaavassa tilanteessa soita 112.'
      : unilateralCalfAssessment
        ? calfAssessmentAction
        : (gaitInstruction ??
          'Älä harjoittele. Hakeudu oireeseen sopivaan terveydenhuollon arvioon.')
    return {
      decision: {
        state: 'RED_STOP',
        allowedSession: 'REST',
        volumeMultiplier: 0,
        maximumAttemptsAllowed: false,
        compactVariantMinutes: null,
        goalChanged: false,
        action,
      },
      reasons: [
        {
          code: gaitAlteringPain
            ? 'GAIT_ALTERING_PAIN'
            : unilateralCalfAssessment
              ? 'UNILATERAL_CALF_SWELLING_WITH_REST_PAIN'
              : 'SAFETY_STOP',
          message:
            gaitInstruction ??
            (unilateralCalfAssessment
              ? 'Nopeasti lisääntyvä toispuoleinen pohjeturvotus ja kipu levossa edellyttävät arviota ennen harjoittelua.'
              : `Turvallisuusoire pysäyttää harjoituksen: ${symptoms}.`),
          priority: 'SAFETY',
        },
      ],
      warnings: [action],
    }
  }

  if (input.availableMinutes === 0) {
    return {
      decision: {
        state: 'GREEN',
        allowedSession: 'REST',
        volumeMultiplier: 0,
        maximumAttemptsAllowed: false,
        compactVariantMinutes: null,
        goalChanged: false,
        action:
          'Tänään ei ole aikaa harjoitukselle. Harjoitus jää väliin eikä sitä siirretä automaattisesti toiselle päivälle.',
      },
      reasons: [
        {
          code: 'NO_TIME_TODAY',
          message: 'Käytettävissä oleva aika on 0 minuuttia.',
          priority: 'TIME',
        },
      ],
      warnings: [],
    }
  }

  if (input.illnessSymptoms) {
    return {
      decision: {
        state: 'ORANGE_RECOVERY',
        allowedSession: 'RECOVERY',
        volumeMultiplier: 0,
        maximumAttemptsAllowed: false,
        compactVariantMinutes: null,
        goalChanged: false,
        action:
          'Pidä lepopäivä tai tee vain hyvin kevyt palauttava liike oireiden salliessa.',
      },
      reasons: [
        {
          code: 'ILLNESS_RECOVERY',
          message: 'Sairausoireet ohjaavat lepoon tai kevyeen palauttavaan liikkeeseen.',
          priority: 'SAFETY',
        },
      ],
      warnings: [],
    }
  }

  const cycleImpact = input.menstrualCycle?.symptomsImpact
  if (cycleImpact === 'HIGH') {
    return {
      decision: {
        state: 'ORANGE_RECOVERY',
        allowedSession: 'RECOVERY',
        volumeMultiplier: 0,
        maximumAttemptsAllowed: false,
        compactVariantMinutes: null,
        goalChanged: false,
        action:
          'Ilmoittamasi oireiden voimakas vaikutus ohjaa tänään lepoon tai erittäin kevyeen palauttavaan liikkeeseen.',
      },
      reasons: [
        {
          code: 'USER_REPORTED_CYCLE_SYMPTOM_IMPACT',
          message:
            'Harjoitusta muuttaa käyttäjän ilmoittama oireiden vaikutus, ei kuukautiskierron oletettu vaihe.',
          priority: 'RECOVERY',
        },
      ],
      warnings: [],
    }
  }
  const recoveryFlags = [
    input.sleep === 'POOR',
    input.energy === 'LOW',
    input.stress === 'HIGH',
    input.soreness === 'HIGH',
    input.newPain?.severity === 'MODERATE',
    cycleImpact === 'MODERATE',
  ].filter(Boolean).length
  const recoveryReasons = [
    ...(input.sleep === 'POOR'
      ? [{ code: 'POOR_SLEEP', message: 'Uni oli tavallista huonompaa.' }]
      : []),
    ...(input.energy === 'LOW'
      ? [{ code: 'LOW_ENERGY', message: 'Energia oli tavallista matalampi.' }]
      : []),
    ...(input.stress === 'HIGH'
      ? [{ code: 'HIGH_STRESS', message: 'Stressi oli tavallista korkeampi.' }]
      : []),
    ...(input.soreness === 'HIGH'
      ? [{ code: 'HIGH_SORENESS', message: 'Lihasarkuus oli tavallista suurempi.' }]
      : []),
    ...(input.newPain?.severity === 'MODERATE'
      ? [
          {
            code: 'MODERATE_NEW_PAIN',
            message: 'Uuden kivun voimakkuus oli kohtalainen.',
          },
        ]
      : []),
    ...(cycleImpact === 'MODERATE'
      ? [
          {
            code: 'USER_REPORTED_CYCLE_SYMPTOM_IMPACT',
            message:
              'Käyttäjän ilmoittama oireiden vaikutus oli kohtalainen; kierron vaihetta ei käytetty oletuksena.',
          },
        ]
      : []),
  ].map((reason) => ({ ...reason, priority: 'RECOVERY' as const }))

  if (recoveryFlags >= 3) {
    return {
      decision: {
        state: 'ORANGE_RECOVERY',
        allowedSession: 'RECOVERY',
        volumeMultiplier: 0,
        maximumAttemptsAllowed: false,
        compactVariantMinutes: null,
        goalChanged: false,
        action:
          'Useat samanaikaiset palautumistekijät ohjaavat tänään lepoon tai erittäin kevyeen palauttavaan liikkeeseen.',
      },
      reasons: [
        {
          code: 'MULTIPLE_RECOVERY_FLAGS',
          message: `${recoveryFlags} samanaikaista palautumistekijää muuttaa päivän harjoituksen palauttavaksi.`,
          priority: 'RECOVERY',
        },
        ...recoveryReasons,
      ],
      warnings: [],
    }
  }

  if (recoveryFlags > 0) {
    const volumeMultiplier = recoveryFlags === 1 ? 0.75 : 0.6
    const reductionPercent = Math.round((1 - volumeMultiplier) * 100)
    return {
      decision: {
        state: 'YELLOW',
        allowedSession: input.plannedSession,
        volumeMultiplier,
        maximumAttemptsAllowed: false,
        compactVariantMinutes:
          input.motivation === 'LOW' && input.availableMinutes >= 10
            ? 10
            : compactVariant(input.availableMinutes),
        goalChanged: false,
        action: `Tee suunniteltu harjoitustyyppi ${reductionPercent} % pienemmällä määrällä ilman maksimiyrityksiä.`,
      },
      reasons: [
        {
          code: 'RECOVERY_LOAD_REDUCTION',
          message: `${recoveryFlags} palautumistekijää keventää päivän kuormaa.`,
          priority: 'RECOVERY',
        },
        ...recoveryReasons,
      ],
      warnings: [],
    }
  }

  if (input.newPain?.severity === 'MILD') {
    return {
      decision: {
        state: 'YELLOW',
        allowedSession: input.plannedSession,
        volumeMultiplier: 0.85,
        maximumAttemptsAllowed: false,
        compactVariantMinutes:
          input.motivation === 'LOW' && input.availableMinutes >= 10
            ? 10
            : compactVariant(input.availableMinutes),
        goalChanged: false,
        action:
          'Aloita kevyesti ja vaihda kipua provosoiva liike. Lopeta, jos kipu voimistuu tai muuttaa liikkumista.',
      },
      reasons: [
        {
          code: 'MILD_NEW_PAIN',
          message: `Uusi lievä kipu (${input.newPain.location}) huomioidaan liikevalinnoissa ja kuormassa.`,
          priority: 'SAFETY',
        },
      ],
      warnings: [],
    }
  }

  const lowMotivation = input.motivation === 'LOW'
  return {
    decision: {
      state: 'GREEN',
      allowedSession: input.plannedSession,
      volumeMultiplier: 1,
      maximumAttemptsAllowed: true,
      compactVariantMinutes:
        lowMotivation && input.availableMinutes >= 10
          ? 10
          : compactVariant(input.availableMinutes),
      goalChanged: false,
      action: lowMotivation
        ? 'Aloita 10 minuutin kompaktilla versiolla ja jatka halutessasi.'
        : 'Tee suunniteltu harjoitus tai käytettävissä olevaan aikaan sopiva versio.',
    },
    reasons: [
      {
        code: lowMotivation ? 'MOTIVATION_SHORT_START' : 'READINESS_GREEN',
        message: lowMotivation
          ? 'Pelkkä motivaation puute tarjoaa lyhyen aloituksen eikä muuta palautumistilaa.'
          : 'Kuntotarkistus ei osoita tarvetta muuttaa päivän kuormaa.',
        priority: lowMotivation ? 'PREFERENCE' : 'RECOVERY',
      },
    ],
    warnings: [],
  }
}

export const ReadinessEngine = { evaluate: evaluateReadiness }
