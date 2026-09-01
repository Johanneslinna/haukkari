import type { ReadinessState, SessionKind } from './types'

export type StrengthSafetyGateReasonCode =
  | 'HEALTH_ENGINE_NOT_AVAILABLE'
  | 'SAFETY_INFORMATION_INCOMPLETE'
  | 'YOUTH_ENGINE_NOT_AVAILABLE'
  | 'OLDER_ADULT_ENGINE_NOT_AVAILABLE'
  | 'READINESS_RED_STOP'
  | 'READINESS_RECOVERY_ONLY'

export type StrengthSafetyGateInput = {
  sessionKind: SessionKind
  age?: number
  readiness?: ReadinessState
  healthBlocked?: boolean
  /** False when legacy safety text still needs user confirmation as typed tags. */
  safetyInformationComplete?: boolean
}

export type StrengthSafetyGateDecision =
  { allowed: true } | { allowed: false; reasonCode: StrengthSafetyGateReasonCode }

/**
 * Yksi fail-closed-portti kaikille aikuisten beta-voimaharjoituksen
 * muodostamisreiteille. Käyttöliittymä ei saa korvata tätä tarkistusta.
 */
export function evaluateStrengthSafetyGate(
  input: StrengthSafetyGateInput,
): StrengthSafetyGateDecision {
  if (input.healthBlocked === true) {
    return { allowed: false, reasonCode: 'HEALTH_ENGINE_NOT_AVAILABLE' }
  }
  if (input.readiness === 'RED_STOP') {
    return { allowed: false, reasonCode: 'READINESS_RED_STOP' }
  }
  if (input.sessionKind !== 'STRENGTH') return { allowed: true }
  if (
    input.age === undefined ||
    input.readiness === undefined ||
    input.safetyInformationComplete === false
  ) {
    return { allowed: false, reasonCode: 'SAFETY_INFORMATION_INCOMPLETE' }
  }
  if (input.age < 18) {
    return { allowed: false, reasonCode: 'YOUTH_ENGINE_NOT_AVAILABLE' }
  }
  if (input.age >= 65) {
    return { allowed: false, reasonCode: 'OLDER_ADULT_ENGINE_NOT_AVAILABLE' }
  }
  if (input.readiness === 'ORANGE_RECOVERY') {
    return { allowed: false, reasonCode: 'READINESS_RECOVERY_ONLY' }
  }
  return { allowed: true }
}

export function strengthSafetyGateMessage(
  reasonCode: StrengthSafetyGateReasonCode,
): string {
  switch (reasonCode) {
    case 'HEALTH_ENGINE_NOT_AVAILABLE':
      return 'Automaattista harjoitusta ei muodosteta ilmoitetun terveysrajoitteen tai selvittämättömän oireen perusteella. Noudata terveydenhuollon ammattilaisen yksilöllisiä ohjeita.'
    case 'SAFETY_INFORMATION_INCOMPLETE':
      return 'Voimaharjoitusta ei muodosteta ennen kuin ikä, päivän kuntotarkistus ja mahdolliset vanhat rajoitetiedot on vahvistettu rakenteisina valintoina.'
    case 'YOUTH_ENGINE_NOT_AVAILABLE':
      return 'Tämä voimaharjoittelun beta-versio on tarkoitettu 18–64-vuotiaille. Junioriohjelmointi ei ole vielä käytössä.'
    case 'OLDER_ADULT_ENGINE_NOT_AVAILABLE':
      return 'Tämä voimaharjoittelun beta-versio on tarkoitettu 18–64-vuotiaille. Yli 64-vuotiaiden yksilöllinen ohjelmointi ei ole vielä käytössä.'
    case 'READINESS_RED_STOP':
      return 'Päivän kuntotarkistus pysäyttää harjoittelun. Noudata kuntotarkistuksen toimintaohjetta.'
    case 'READINESS_RECOVERY_ONLY':
      return 'Päivän kuntotarkistus sallii vain levon tai kevyen palauttavan harjoituksen, joten voimaharjoitusta ei muodosteta.'
  }
}
