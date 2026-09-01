import assert from 'node:assert/strict'
import {
  calculateContentDigest,
  readTrainingContent,
  validateReferences,
} from './training-content-tools.mjs'
import { evidenceClaimSchema } from './training-content-schema.mjs'

const content = await readTrainingContent()
assert.deepEqual(validateReferences(content), [])

assert.throws(() =>
  evidenceClaimSchema.parse({
    ...content.claims[0],
    certainty: 'CERTAIN_WITHOUT_LIMITS',
  }),
)

const missingSource = structuredClone(content)
missingSource.claims[0].sourceIds.push('MISSING-SOURCE')
assert.ok(
  validateReferences(missingSource, { ignoreDigest: true }).some((error) =>
    error.includes('tuntematon evidence source'),
  ),
)

const missingClaim = structuredClone(content)
missingClaim.rules[0].claimIds.push('MISSING-CLAIM')
assert.ok(
  validateReferences(missingClaim, { ignoreDigest: true }).some((error) =>
    error.includes('tuntematon evidence claim'),
  ),
)

const missingSubstitution = structuredClone(content)
missingSubstitution.substitutions[0].toCodes.push('MISSING-EXERCISE')
assert.ok(
  validateReferences(missingSubstitution, { ignoreDigest: true }).some((error) =>
    error.includes('tuntematon korvaava'),
  ),
)

const tamperedPublishedRelease = structuredClone(content)
tamperedPublishedRelease.exercises[0].nameFi = 'Paikallaan muutettu julkaisu'
assert.notEqual(
  tamperedPublishedRelease.release.contentDigest,
  calculateContentDigest(tamperedPublishedRelease),
)
assert.ok(
  validateReferences(tamperedPublishedRelease).some((error) =>
    error.includes('Sisältötiiviste ei täsmää'),
  ),
)

const falselyReviewedClaim = structuredClone(content)
falselyReviewedClaim.claims[0].reviewedBy = ['Keksitty asiantuntija']
assert.ok(
  validateReferences(falselyReviewedClaim, { ignoreDigest: true }).some((error) =>
    error.includes('ei saa esittää ihmisen arvioimana'),
  ),
)

const missingHumanReviewer = structuredClone(content)
missingHumanReviewer.claims[0].status = 'PUBLISHED_REVIEWED'
missingHumanReviewer.claims[0].scientificReview = 'HUMAN_REVIEWED'
assert.ok(
  validateReferences(missingHumanReviewer, { ignoreDigest: true }).some((error) =>
    error.includes('arviointitiedot puuttuvat'),
  ),
)

console.log('Sisältöjulkaisun skeema-, ristiviite- ja immutability-testit läpäisty.')
