import {
  calculateContentDigest,
  generateArtifacts,
  readTrainingContent,
  validateReferences,
} from './training-content-tools.mjs'

const content = await readTrainingContent()
if (process.argv.includes('--print-digest')) {
  process.stdout.write(calculateContentDigest(content))
  process.exit(0)
}
const errors = validateReferences(content)
if (errors.length) {
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}
if (process.argv.includes('--generate')) await generateArtifacts(content)
console.log(
  `Sisältöjulkaisu ${content.release.releaseId}: ${content.exercises.length} harjoitetta, ${content.claims.length} väitettä ja ${content.rules.length} sääntöä.`,
)
