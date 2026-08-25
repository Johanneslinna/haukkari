import type { ExplainableDecision, NutritionDecision, NutritionInput } from './types'

const proteinRange = { min: 1.6, max: 2 }

function baseDecision(input: NutritionInput): NutritionDecision {
  const performanceFueling =
    input.goal === 'ENDURANCE' || input.goal === 'SPORT_PERFORMANCE'
      ? ['Kohdenna hiilihydraatteja kuormittavien harjoitusten ympärille.']
      : []
  const targetGuidance =
    input.goal === 'FAT_LOSS'
      ? ['Suojaa lihasmassaa voimaharjoittelulla ja riittävällä proteiinilla.']
      : input.goal === 'MAX_STRENGTH'
        ? ['Säilytä riittävä energiansaanti voimaharjoittelun tueksi.']
        : []
  return {
    energyAction: 'MAINTAIN',
    requiresUserApproval: false,
    approved: true,
    proteinGramsPerKg: proteinRange,
    usePortionModel: input.eatingDisorderHistory === true,
    deadlineAdjusted: false,
    fatLossGuidanceActive: true,
    guidance: [
      'Syö säännöllisiä aterioita.',
      'Tavoittele yleensä noin 1,6–2,0 grammaa proteiinia painokiloa kohti.',
      'Huolehdi riittävästä kokonaisenergiansaannista.',
      ...performanceFueling,
      ...targetGuidance,
    ],
  }
}

export function evaluateNutritionPolicy(
  input: NutritionInput,
): ExplainableDecision<NutritionDecision> {
  const decision = baseDecision(input)

  if (input.goal === 'FAT_LOSS' && input.lowEnergySigns.length > 0) {
    decision.energyAction = 'SUSPEND_DEFICIT'
    decision.fatLossGuidanceActive = false
    return {
      decision,
      reasons: [
        {
          code: 'LOW_ENERGY_AVAILABILITY_STOP',
          message:
            'Matalan energiansaatavuuden merkit pysäyttävät painonpudotusohjauksen.',
          priority: 'SAFETY',
        },
      ],
      warnings: [
        'Keskeytä energiavajeen tavoittelu ja hakeudu tilanteen arvioon terveydenhuollon tai urheiluravitsemuksen ammattilaiselle.',
      ],
    }
  }

  if (input.eatingDisorderHistory && input.goal === 'FAT_LOSS') {
    decision.fatLossGuidanceActive = false
    return {
      decision,
      reasons: [
        {
          code: 'EATING_DISORDER_HISTORY_SAFEGUARD',
          message:
            'Häiriintyneen syömisen historia rajaa automaattisen energiavajeohjauksen pois.',
          priority: 'SAFETY',
        },
      ],
      warnings: [
        'Käytä annosmallia ja suunnittele mahdollinen painotavoite ammattilaisen kanssa.',
      ],
    }
  }

  if (
    (input.competitionDaysUntil ?? Number.POSITIVE_INFINITY) >= 0 &&
    (input.competitionDaysUntil ?? Number.POSITIVE_INFINITY) <= 7
  ) {
    return {
      decision,
      reasons: [
        {
          code: 'NO_NEW_DEFICIT_COMPETITION_WEEK',
          message: 'Kilpailuviikolle ei aloiteta uutta energiavajetta.',
          priority: 'COACH_FIXED',
        },
      ],
      warnings: [],
    }
  }

  if (input.reliableWeeklyWeightTrend.length < 3) {
    return {
      decision,
      reasons: [
        {
          code: 'THREE_WEEK_TREND_REQUIRED',
          message:
            input.reliableWeeklyWeightTrend.length <= 1
              ? 'Yksittäinen painomittaus ei muuta ravintosuositusta.'
              : 'Energiaohjauksen muutos vaatii yleensä vähintään kolmen viikon luotettavan trendin.',
          priority: 'PRIMARY_GOAL',
        },
      ],
      warnings: [],
    }
  }

  const desiredWeeklyChange =
    (input.desiredChangeKg ?? 0) /
    Math.max(input.deadlineWeeks ?? Number.POSITIVE_INFINITY, 1)
  const maximumModerateWeeklyChange = (input.weightKg ?? 50) * 0.01
  const deadlineTooShortForTrend =
    input.goal === 'FAT_LOSS' &&
    (input.desiredChangeKg ?? 0) > 0 &&
    ((input.deadlineWeeks ?? Number.POSITIVE_INFINITY) < 3 ||
      desiredWeeklyChange > maximumModerateWeeklyChange)
  if (deadlineTooShortForTrend) decision.deadlineAdjusted = true

  if (input.goal === 'FAT_LOSS') {
    decision.energyAction = 'PROPOSE_MODERATE_DEFICIT'
    decision.requiresUserApproval = true
    decision.approved = false
    return {
      decision,
      reasons: [
        {
          code: 'MODERATE_DEFICIT_PROPOSAL',
          message: 'Luotettava trendi sallii vain maltillisen energiavaje-ehdotuksen.',
          priority: 'PRIMARY_GOAL',
        },
        ...(deadlineTooShortForTrend
          ? [
              {
                code: 'UNREALISTIC_DEADLINE_NOT_AGGRESSIVE',
                message:
                  'Liian lyhyt määräaika ei suurenna energiavajetta; aikataulua on pidennettävä.',
                priority: 'SAFETY' as const,
              },
            ]
          : []),
      ],
      warnings: deadlineTooShortForTrend
        ? ['Tavoiteaika ei mahdollista luotettavaa kolmen viikon arviojaksoa.']
        : [],
    }
  }

  if (input.goal === 'MUSCLE_GAIN') {
    decision.energyAction = 'PROPOSE_SMALL_SURPLUS'
    decision.requiresUserApproval = true
    decision.approved = false
    return {
      decision,
      reasons: [
        {
          code: 'SMALL_SURPLUS_PROPOSAL',
          message: 'Lihaskasvutavoitteelle voidaan ehdottaa pientä energiaylijäämää.',
          priority: 'PRIMARY_GOAL',
        },
      ],
      warnings: [],
    }
  }

  return {
    decision,
    reasons: [
      {
        code: 'MAINTENANCE_ENERGY_DEFAULT',
        message: 'Tavoite ei edellytä energiansaannin muuttamista.',
        priority: 'PRIMARY_GOAL',
      },
    ],
    warnings: [],
  }
}

export function approveEnergyProposal(
  proposal: ExplainableDecision<NutritionDecision>,
  userApproved: boolean,
): ExplainableDecision<NutritionDecision> {
  if (!proposal.decision.requiresUserApproval) return proposal
  return {
    ...proposal,
    decision: { ...proposal.decision, approved: userApproved },
    reasons: [
      ...proposal.reasons,
      {
        code: userApproved ? 'ENERGY_CHANGE_APPROVED' : 'ENERGY_CHANGE_DECLINED',
        message: userApproved
          ? 'Käyttäjä hyväksyi energiaan vaikuttavan ehdotuksen.'
          : 'Käyttäjä ei hyväksynyt energiaan vaikuttavaa ehdotusta, joten sitä ei oteta käyttöön.',
        priority: 'PREFERENCE',
      },
    ],
  }
}

export const NutritionPolicyEngine = {
  evaluate: evaluateNutritionPolicy,
  approve: approveEnergyProposal,
}
