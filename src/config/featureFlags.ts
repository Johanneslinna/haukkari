function enabled(value: string | undefined) {
  return value === 'true'
}

const trainingEngineV2 = enabled(import.meta.env.VITE_TRAINING_ENGINE_V2)

/**
 * Turvallisuutta ja aikabudjettia korjaavat yhteensopivuusmuutokset ovat aina
 * käytössä. Uudet beta-moduulit avataan vain näillä julkaisuympäristön lipuilla.
 */
export const featureFlags = Object.freeze({
  trainingEngineV2,
  hockeyBeta: trainingEngineV2 && enabled(import.meta.env.VITE_HOCKEY_BETA),
})
