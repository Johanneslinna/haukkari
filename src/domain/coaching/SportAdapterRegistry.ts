import { cyclingAdapter } from './sports/cyclingAdapter'
import { generalSportSupportAdapter } from './sports/generalSportSupportAdapter'
import { powerliftingAdapter } from './sports/powerliftingAdapter'
import { runningAdapter } from './sports/runningAdapter'
import type { SportAdapter, SportAdapterMatch } from './types'

const fullAdapters: SportAdapter[] = [runningAdapter, cyclingAdapter, powerliftingAdapter]

export function getSportAdapter(discipline: string): SportAdapterMatch {
  const normalized = discipline.trim().toLocaleLowerCase('fi-FI')
  const adapter = fullAdapters.find((candidate) =>
    candidate.disciplines.includes(normalized),
  )
  if (adapter) return { supportLevel: 'FULL', adapter }
  return { supportLevel: 'GENERAL_SUPPORT', adapter: generalSportSupportAdapter }
}

export function listFullySupportedDisciplines() {
  return fullAdapters.flatMap((adapter) => adapter.disciplines)
}

export const SportAdapterRegistry = {
  get: getSportAdapter,
  listFullySupportedDisciplines,
}
