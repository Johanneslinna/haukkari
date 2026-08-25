import type {
  ExplainableDecision,
  GoalConflict,
  GoalConflictContext,
  GoalType,
} from './types'

function includesGoal(context: GoalConflictContext, goal: GoalType) {
  return context.primary === goal || context.secondary.includes(goal)
}

export function evaluateGoalConflicts(
  context: GoalConflictContext,
): ExplainableDecision<GoalConflict[]> {
  const conflicts: GoalConflict[] = []

  if (
    includesGoal(context, 'FAT_LOSS') &&
    includesGoal(context, 'MUSCLE_GAIN') &&
    context.maximalMuscleGainRequested
  ) {
    conflicts.push({
      code: 'FAT_LOSS_VS_MAXIMAL_MUSCLE_GAIN',
      severity: 'TRADEOFF',
      message:
        'Rasvanpudotusta ja maksimaalista lihaskasvua ei luvata samalle jaksolle. Valitse jakson tärkein suunta.',
      choices: [
        'Painota maltillista rasvanpudotusta',
        'Painota lihaskasvua',
        'Valitse ylläpitovaihe',
      ],
    })
  }

  if (
    context.energyDeficit === 'LARGE' &&
    context.competitionPeak !== undefined &&
    context.competitionPeak !== 'NONE'
  ) {
    conflicts.push({
      code: 'LARGE_DEFICIT_VS_COMPETITION',
      severity: 'TRADEOFF',
      message:
        'Suuri energiavaje voi vaarantaa A-kilpailuun valmistautumisen ja palautumisen.',
      choices: ['Keskeytä suuri energiavaje', 'Siirrä kilpailuhuippua'],
    })
  }

  if (context.marathonPeak && context.maxStrengthPeak) {
    conflicts.push({
      code: 'MARATHON_PEAK_VS_MAX_STRENGTH_PEAK',
      severity: 'TRADEOFF',
      message:
        'Maratonhuippua ja maksimivoimahuippua ei ajoiteta samaan jaksoon ilman kompromissia.',
      choices: ['Painota maratonia', 'Painota maksimivoimaa', 'Siirrä toista huippua'],
    })
  }

  if (context.highRunningVolume && context.highLowerBodyHypertrophy) {
    conflicts.push({
      code: 'RUN_VOLUME_VS_LOWER_HYPERTROPHY',
      severity: 'TRADEOFF',
      message:
        'Runsas juoksu ja suuri alavartalon hypertrofiavolyymi kilpailevat palautumisesta.',
      choices: ['Säilytä juoksumäärä', 'Painota alavartalon lihaskasvua'],
    })
  }

  if (context.speedSessionWhileFatigued) {
    conflicts.push({
      code: 'SPEED_WHILE_FATIGUED',
      severity: 'BLOCKING',
      message:
        'Nopeusharjoitusta ei tehdä selvästi väsyneenä, koska laatu ja turvallisuus heikkenevät.',
      choices: ['Siirrä nopeusharjoitus', 'Tee kevyt palauttava harjoitus'],
    })
  }

  if ((context.simultaneousAEvents ?? 0) >= 2) {
    conflicts.push({
      code: 'TWO_A_EVENTS',
      severity: 'TRADEOFF',
      message:
        'Kaksi samanaikaista A-tapahtumaa vaatii yhden ensisijaisen huipun valitsemisen.',
      choices: ['Valitse ensimmäinen A-tapahtuma', 'Valitse toinen A-tapahtuma'],
    })
  }

  if (includesGoal(context, 'FAT_LOSS') && context.lowEnergyAvailabilitySigns) {
    conflicts.push({
      code: 'WEIGHT_LOSS_VS_LOW_ENERGY',
      severity: 'BLOCKING',
      message: 'Matalan energiansaatavuuden merkit pysäyttävät painonpudotusohjauksen.',
      choices: [
        'Keskeytä energiavaje ja arvioi tilanne terveydenhuollon ammattilaisen kanssa',
      ],
    })
  }

  return {
    decision: conflicts,
    reasons: conflicts.map((conflict) => ({
      code: conflict.code,
      message: conflict.message,
      priority: conflict.severity === 'BLOCKING' ? 'SAFETY' : 'PRIMARY_GOAL',
    })),
    warnings: conflicts.map((conflict) => conflict.message),
  }
}
