import {
  generateArtifacts,
  readTrainingContent,
  validateReferences,
} from './training-content-tools.mjs'

const content = await readTrainingContent()
const errors = validateReferences(content)
if (errors.length) throw new Error(errors.join('\n'))
await generateArtifacts(content)
console.log(
  `Runtime-katalogi ja Supabase-seed luotu julkaisusta ${content.release.releaseId}.`,
)
