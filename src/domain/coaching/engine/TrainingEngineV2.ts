import type {
  CompetitionEvent,
  DecisionTrace,
  ExperienceLevel,
  GoalProfile,
  GoalType,
  PlannedSession,
  RuleDecision,
  SafetyOutcome,
  SessionKind,
  SessionObjective,
} from '../types'

export type AthleteState = {
  longTerm: {
    goal: GoalProfile
    experience: ExperienceLevel
    currentEnduranceMinutes: number
    equipment: string[]
    limitations: string[]
  }
  acute: {
    physicalLoad: 'LOW' | 'MODERATE' | 'HIGH'
    healthBlocked: boolean
    recoveryFlags: string[]
  }
  schedule: {
    availableDays: number[]
    defaultMaximumMinutes: number
    maximumMinutesByDay: Record<string, number>
    fixedSessions: PlannedSession[]
    competitions: CompetitionEvent[]
  }
  confidence: {
    overall: 'HIGH' | 'MODERATE' | 'LOW'
    missingData: string[]
  }
}

export type AthleteStateInput = {
  goal: GoalProfile
  experience: ExperienceLevel
  currentEnduranceMinutes: number
  equipment?: string[]
  limitations?: string
  physicalLoad?: 'LOW' | 'MODERATE' | 'HIGH'
  healthBlocked?: boolean
  recoveryFlags?: string[]
  availableDays: number[]
  minutesPerSession?: number
  minutesByDay?: Record<string, number>
  fixedSessions: PlannedSession[]
  competitions: CompetitionEvent[]
}

export const AthleteStateBuilder = {
  build(input: AthleteStateInput): AthleteState {
    const missingData: string[] = []
    if (!input.equipment?.length) missingData.push('Käytettävissä olevat välineet')
    if (!input.minutesPerSession) missingData.push('Harjoituksen enimmäiskesto')
    return {
      longTerm: {
        goal: input.goal,
        experience: input.experience,
        currentEnduranceMinutes: Math.max(0, input.currentEnduranceMinutes),
        equipment: input.equipment?.length ? [...input.equipment] : ['Kehonpaino'],
        limitations:
          input.limitations
            ?.split(/[,.·;]/u)
            .map((item) => item.trim())
            .filter(Boolean) ?? [],
      },
      acute: {
        physicalLoad: input.physicalLoad ?? 'MODERATE',
        healthBlocked: input.healthBlocked === true,
        recoveryFlags: [...(input.recoveryFlags ?? [])],
      },
      schedule: {
        availableDays: [...new Set(input.availableDays)].sort((a, b) => a - b),
        defaultMaximumMinutes: Math.max(1, input.minutesPerSession ?? 90),
        maximumMinutesByDay: { ...(input.minutesByDay ?? {}) },
        fixedSessions: input.fixedSessions.map((session) => ({ ...session })),
        competitions: input.competitions.map((competition) => ({ ...competition })),
      },
      confidence: {
        overall: missingData.length === 0 ? 'HIGH' : 'MODERATE',
        missingData,
      },
    }
  },
}

export const ConstraintEngine = {
  maximumMinutes(state: AthleteState, day: number) {
    return Math.max(
      1,
      state.schedule.maximumMinutesByDay[String(day)] ??
        state.schedule.defaultMaximumMinutes,
    )
  },
  capSessionMinutes(state: AthleteState, day: number, requestedMinutes: number) {
    return Math.max(1, Math.min(requestedMinutes, this.maximumMinutes(state, day)))
  },
  exerciseIsAvailable(equipment: string[], availableEquipment: string[]) {
    return equipment.some(
      (item) => item === 'Kehonpaino' || availableEquipment.includes(item),
    )
  },
  hardViolations(
    state: AthleteState,
    session: Pick<PlannedSession, 'day' | 'durationMinutes'>,
  ) {
    const violations: string[] = []
    if (!state.schedule.availableDays.includes(session.day)) {
      violations.push('Päivä ei ole käyttäjän käytettävissä.')
    }
    if (session.durationMinutes > this.maximumMinutes(state, session.day)) {
      violations.push('Harjoitus ylittää päivän ehdottoman aikabudjetin.')
    }
    if (state.acute.healthBlocked) {
      violations.push('Terveystieto estää kuormittavan harjoituksen.')
    }
    return violations
  },
}

type ExerciseCandidate = {
  code: string
  nameFi: string
  category: string
  equipment: string[]
}

export const CandidateSelector = {
  select<T extends ExerciseCandidate>(
    candidates: T[],
    input: { category: string; equipment: string[] },
  ) {
    return candidates.filter(
      (candidate) =>
        candidate.category === input.category &&
        ConstraintEngine.exerciseIsAvailable(candidate.equipment, input.equipment),
    )
  },
}

export const ExerciseRanker = {
  rank<T extends ExerciseCandidate>(
    candidates: T[],
    input: { equipment: string[]; likes?: string; dislikes?: string },
  ) {
    const likes = input.likes?.toLocaleLowerCase('fi-FI') ?? ''
    const dislikes = input.dislikes?.toLocaleLowerCase('fi-FI') ?? ''
    return [...candidates].sort((left, right) => {
      const score = (candidate: T) => {
        const searchable = `${candidate.nameFi} ${candidate.category}`.toLocaleLowerCase(
          'fi-FI',
        )
        const preferredEquipment = candidate.equipment.some(
          (item) => item !== 'Kehonpaino' && input.equipment.includes(item),
        )
        return (
          (preferredEquipment ? 3 : 0) +
          (likes && searchable.includes(likes) ? 4 : 0) -
          (dislikes && searchable.includes(dislikes) ? 100 : 0)
        )
      }
      return score(right) - score(left) || left.code.localeCompare(right.code)
    })
  },
}

const objectiveLabels: Record<SessionKind, string> = {
  STRENGTH: 'Voima ja kuormansietokyky',
  EASY_ENDURANCE: 'Aerobinen peruskestävyys',
  INTERVAL: 'Hallittu vauhtikestävyys',
  SPEED_POWER: 'Nopeus ja räjähtävä voima',
  MOBILITY: 'Liikkuvuus ja liikehallinta',
  SPORT: 'Lajisuoritus',
  MATCH: 'Ottelu- tai kilpailusuoritus',
  RECOVERY: 'Palautuminen',
  REST: 'Palautuminen',
}

export const SessionObjectivePlanner = {
  plan(kind: SessionKind, goal: GoalType): SessionObjective {
    return {
      primary: objectiveLabels[kind],
      secondary: goal === 'GENERAL_FITNESS' ? ['Yleinen toimintakyky'] : [],
      fatigueBudget:
        kind === 'RECOVERY' || kind === 'REST' || kind === 'MOBILITY'
          ? 'LOW'
          : kind === 'MATCH'
            ? 'HIGH'
            : 'MODERATE',
      avoid: kind === 'SPEED_POWER' ? ['Uupumukseen harjoittelu'] : [],
    }
  },
}

export const DoseEngine = {
  clampMinutes(requestedMinutes: number, maximumMinutes: number, minimumMinutes = 1) {
    return Math.max(minimumMinutes, Math.min(requestedMinutes, maximumMinutes))
  },
  confidence(hasComparableHistory: boolean, missingData: string[] = []) {
    if (missingData.length > 1) return 'LOW' as const
    return hasComparableHistory ? ('HIGH' as const) : ('MODERATE' as const)
  },
}

export const LiveAdaptationEngine = {
  chooseMultiplier(input: { safetyOutcome: SafetyOutcome; recoveryFlags: number }) {
    if (input.safetyOutcome === 'STOP' || input.safetyOutcome === 'REFER') return 0
    if (input.recoveryFlags >= 3) return 0.5
    if (input.recoveryFlags === 2) return 0.6
    if (input.recoveryFlags === 1) return 0.75
    return 1
  },
}

export const DecisionRecorder = {
  record(input: {
    ruleVersion: string
    generatedAt: string
    safetyOutcome: SafetyOutcome
    confidence: DecisionTrace['confidence']
    inputSummary: string[]
    missingData?: string[]
    rules: RuleDecision[]
  }): DecisionTrace {
    return {
      ...input,
      missingData: input.missingData ?? [],
    }
  },
}
