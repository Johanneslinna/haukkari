import type { GoalStrategy, GoalType } from '../types'
import { bodyRecompositionStrategy } from './bodyRecompositionStrategy'
import { enduranceStrategy } from './enduranceStrategy'
import { fatLossStrategy } from './fatLossStrategy'
import { generalFitnessStrategy } from './generalFitnessStrategy'
import { maxStrengthStrategy } from './maxStrengthStrategy'
import { muscleGainStrategy } from './muscleGainStrategy'
import { postureMobilityStrategy } from './postureMobilityStrategy'
import { speedPowerStrategy } from './speedPowerStrategy'
import { sportPerformanceStrategy } from './sportPerformanceStrategy'

export const goalStrategies: Record<GoalType, GoalStrategy> = {
  BODY_RECOMPOSITION: bodyRecompositionStrategy,
  FAT_LOSS: fatLossStrategy,
  MUSCLE_GAIN: muscleGainStrategy,
  MAX_STRENGTH: maxStrengthStrategy,
  ENDURANCE: enduranceStrategy,
  SPEED_POWER: speedPowerStrategy,
  GENERAL_FITNESS: generalFitnessStrategy,
  POSTURE_MOBILITY: postureMobilityStrategy,
  SPORT_PERFORMANCE: sportPerformanceStrategy,
}

export function getGoalStrategy(goal: GoalType): GoalStrategy {
  return goalStrategies[goal]
}
