import { describe, expect, it } from 'vitest'
import {
  exerciseAllowedForExperience,
  exerciseConflictsWithLimitations,
  exerciseLibrary,
  verifiedTechniqueUrl,
} from './ExerciseLibrary'

describe('ExerciseLibrary v2', () => {
  it('sisältää vähintään 40 yksilöityä liikettä ja kaikki vaaditut liikeperheet', () => {
    expect(exerciseLibrary.length).toBeGreaterThanOrEqual(40)
    expect(new Set(exerciseLibrary.map((item) => item.code)).size).toBe(
      exerciseLibrary.length,
    )
    expect(new Set(exerciseLibrary.map((item) => item.nameFi)).size).toBe(
      exerciseLibrary.length,
    )
    expect(new Set(exerciseLibrary.map((item) => item.category))).toEqual(
      expect.objectContaining({
        size: expect.any(Number),
      }),
    )
    for (const category of [
      'Kyykky',
      'Lannesarana',
      'Yhden jalan voima',
      'Työntö',
      'Veto',
      'Kantaminen',
      'Keskivartalo',
      'Sprintti',
      'Hypyt',
      'Liikkuvuus',
    ]) {
      expect(exerciseLibrary.some((item) => item.category === category)).toBe(true)
    }
  })

  it('sisältää päätöksenteon metatiedot ja vain eksplisiittisiä videolinkkejä', () => {
    const names = new Set(exerciseLibrary.map((item) => item.nameFi))
    for (const item of exerciseLibrary) {
      expect(item.equipment.length).toBeGreaterThan(0)
      expect(item.trainingEffects.length).toBeGreaterThan(0)
      expect(item.instructionsFi.length).toBeGreaterThan(20)
      expect(item.stopCondition.length).toBeGreaterThan(20)
      expect(item.substitutions.length).toBeGreaterThan(0)
      expect(item.substitutions.every((name) => names.has(name))).toBe(true)
      expect(item.techniqueVideoUrl ?? '').not.toContain('results?search_query=')
      if (item.techniqueReviewStatus === 'VERIFIED') {
        expect(verifiedTechniqueUrl(item)).toMatch(/^https:\/\//u)
      } else {
        expect(verifiedTechniqueUrl(item)).toBeUndefined()
      }
    }
  })

  it('rajaa liian vaativan tai ilmoitetun vasta-aiheen kanssa ristiriitaisen liikkeen', () => {
    const frontSquat = exerciseLibrary.find((item) => item.code === 'FRONT_SQUAT')!
    const rdl = exerciseLibrary.find((item) => item.code === 'ROMANIAN_DEADLIFT')!
    expect(exerciseAllowedForExperience(frontSquat, 'BEGINNER')).toBe(false)
    expect(exerciseAllowedForExperience(frontSquat, 'ADVANCED')).toBe(true)
    expect(exerciseConflictsWithLimitations(rdl, 'Minulla on akuutti selkäkipu')).toBe(
      true,
    )
  })
})
