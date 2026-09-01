import { describe, expect, it } from 'vitest'
import {
  VERIFIED_NEXT_LOAD_POLICY_VERSION,
  findVerifiedNextLoad,
  upsertVerifiedNextLoad,
  verifiedNextLoadsFrom,
  verifyNextLoad,
  type VerifiedNextLoad,
  type VerifiedNextLoadIdentity,
} from '.'

const externalContext = 'adult-resistance-load-context-1.0.0:external-kg'
const dumbbellContext = 'adult-resistance-load-context-1.0.0:dumbbell-kg-each'

function identity(
  overrides: Partial<VerifiedNextLoadIdentity> = {},
): VerifiedNextLoadIdentity {
  return {
    exerciseCode: 'TEST_LIFT',
    exerciseVersion: '1.0.0',
    loadType: 'EXTERNAL_KG',
    loadContextId: externalContext,
    currentLoadKg: 20,
    ...overrides,
  }
}

function confirmation(overrides: Partial<VerifiedNextLoad> = {}): VerifiedNextLoad {
  return {
    exerciseCode: 'TEST_LIFT',
    exerciseVersion: '1.0.0',
    loadContextId: externalContext,
    currentLoadKg: 20,
    nextAvailableLoadKg: 21,
    confirmedAt: '2026-08-27T10:00:00.000Z',
    policyVersion: VERIFIED_NEXT_LOAD_POLICY_VERSION,
    ...overrides,
  }
}

const authorization = {
  evaluatedAt: '2026-08-27T11:00:00.000Z',
  supportingEvidenceAt: '2026-08-27T09:00:00.000Z',
}

describe('VerifiedNextLoad', () => {
  it.each([
    [21, 0.05],
    [22, 0.1],
  ])('hyväksyy käyttäjän vahvistaman 20 → %s kg kuorman', (nextAvailableLoadKg) => {
    expect(
      verifyNextLoad({
        identity: identity(),
        nextAvailableLoadKg,
        confirmedAt: '2026-08-27T10:00:00.000Z',
      }),
    ).toMatchObject({
      ok: true,
      confirmation: { currentLoadKg: 20, nextAvailableLoadKg },
    })
  })

  it('estää 5 → 6 kg vahvistuksen, koska automaattinen nousu olisi 20 prosenttia', () => {
    expect(
      verifyNextLoad({
        identity: identity({ currentLoadKg: 5 }),
        nextAvailableLoadKg: 6,
        confirmedAt: '2026-08-27T10:00:00.000Z',
      }),
    ).toMatchObject({ ok: false, reasonCode: 'NEXT_LOAD_EXCEEDS_TEN_PERCENT' })
  })

  it('vaatii nykyistä suuremman numeerisen kuorman', () => {
    expect(
      verifyNextLoad({
        identity: identity(),
        nextAvailableLoadKg: 20,
        confirmedAt: '2026-08-27T10:00:00.000Z',
      }),
    ).toMatchObject({ ok: false, reasonCode: 'NEXT_LOAD_NOT_GREATER' })
    expect(
      verifyNextLoad({
        identity: identity(),
        nextAvailableLoadKg: Number.NaN,
        confirmedAt: '2026-08-27T10:00:00.000Z',
      }),
    ).toMatchObject({ ok: false, reasonCode: 'NEXT_LOAD_INVALID' })
  })

  it.each(['BODYWEIGHT', 'BAND'] as const)(
    'ei vahvista kilogrammaporrasta kuormatyypille %s',
    (loadType) => {
      expect(
        verifyNextLoad({
          identity: identity({ loadType, loadContextId: undefined }),
          nextAvailableLoadKg: 21,
          confirmedAt: '2026-08-27T10:00:00.000Z',
        }),
      ).toMatchObject({ ok: false, reasonCode: 'KILOGRAM_LOAD_REQUIRED' })
    },
  )

  it('vaatii konekuormalle käyttäjän tunnistaman laitteen', () => {
    expect(
      verifyNextLoad({
        identity: identity({ loadType: 'MACHINE_KG', loadContextId: undefined }),
        nextAvailableLoadKg: 21,
        confirmedAt: '2026-08-27T10:00:00.000Z',
      }),
    ).toMatchObject({ ok: false, reasonCode: 'LOAD_CONTEXT_REQUIRED' })
    expect(
      verifyNextLoad({
        identity: identity({
          loadType: 'MACHINE_KG',
          loadContextId: 'adult-resistance-load-context-1.0.0:machine:leg-press-a',
        }),
        nextAvailableLoadKg: 21,
        confirmedAt: '2026-08-27T10:00:00.000Z',
      }),
    ).toMatchObject({ ok: true })
  })

  it('ei peri vahvistusta eri liikeversiolle tai kuormakontekstille', () => {
    const stored = [confirmation()]
    expect(
      findVerifiedNextLoad(stored, identity({ exerciseVersion: '2.0.0' }), authorization),
    ).toBeUndefined()
    expect(
      findVerifiedNextLoad(
        stored,
        identity({ loadType: 'DUMBBELL_KG_EACH', loadContextId: dumbbellContext }),
        authorization,
      ),
    ).toBeUndefined()
  })

  it('ei käytä 20 → 21 kg vahvistusta myöhempään 21 → 22 kg siirtymään', () => {
    expect(
      findVerifiedNextLoad(
        [confirmation()],
        identity({ currentLoadKg: 21 }),
        authorization,
      ),
    ).toBeUndefined()
  })

  it('ei peri konevahvistusta toiselle laitteelle', () => {
    const machineA = confirmation({
      loadContextId: 'adult-resistance-load-context-1.0.0:machine:leg-press-a',
    })
    expect(
      findVerifiedNextLoad(
        [machineA],
        identity({
          loadType: 'MACHINE_KG',
          loadContextId: 'adult-resistance-load-context-1.0.0:machine:leg-press-b',
        }),
        authorization,
      ),
    ).toBeUndefined()
  })

  it('ei valtuuta poistettua, vanhentunutta tai väärän politiikkaversion vahvistusta', () => {
    expect(findVerifiedNextLoad([], identity(), authorization)).toBeUndefined()
    expect(
      findVerifiedNextLoad(
        [confirmation({ confirmedAt: '2026-08-27T08:59:59.000Z' })],
        identity(),
        authorization,
      ),
    ).toBeUndefined()
    expect(
      findVerifiedNextLoad(
        [confirmation({ policyVersion: 'verified-next-load-0.9.0' })],
        identity(),
        authorization,
      ),
    ).toBeUndefined()
  })

  it('säilyttää eri nykykuormien portaat erillisinä ja lukee vain versionoidut tiedot', () => {
    const next = upsertVerifiedNextLoad(
      [confirmation()],
      confirmation({ currentLoadKg: 21, nextAvailableLoadKg: 22 }),
    )
    expect(next).toHaveLength(2)
    expect(verifiedNextLoadsFrom([...next, { unsafe: true }])).toEqual(next)
    expect(
      verifiedNextLoadsFrom([confirmation({ policyVersion: 'unknown-policy-version' })]),
    ).toEqual([])
  })
})
