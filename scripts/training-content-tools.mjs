import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { packageSchema } from './training-content-schema.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const contentDirectory = resolve(root, 'training-content/v1')
const fileNames = {
  release: 'release.json',
  sources: 'evidence-sources.json',
  claims: 'evidence-claims.json',
  rules: 'prescription-rules.json',
  exercises: 'exercises.json',
  substitutions: 'substitutions.json',
}

async function json(name) {
  return JSON.parse(await readFile(resolve(contentDirectory, fileNames[name]), 'utf8'))
}

export async function readTrainingContent() {
  return packageSchema.parse({
    release: await json('release'),
    sources: await json('sources'),
    claims: await json('claims'),
    rules: await json('rules'),
    exercises: await json('exercises'),
    substitutions: await json('substitutions'),
  })
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function calculateContentDigest(content) {
  const release = { ...content.release, contentDigest: '' }
  return createHash('sha256')
    .update(canonical({ ...content, release }))
    .digest('hex')
}

function duplicateIds(items) {
  const seen = new Set()
  return items
    .map((item) => item.id)
    .filter((id) => (seen.has(id) ? true : !seen.add(id)))
}

function isOperationalClaim(claim) {
  return claim.status === 'PUBLISHED_INTERNAL' || claim.status === 'PUBLISHED_REVIEWED'
}

export function validateReferences(content, options = {}) {
  const errors = []
  const sourceIds = new Set(content.sources.map((source) => source.id))
  const claimIds = new Set(content.claims.map((claim) => claim.id))
  const exerciseCodes = new Set(content.exercises.map((exercise) => exercise.code))

  for (const [label, items] of [
    ['lähde', content.sources],
    ['väite', content.claims],
    ['sääntö', content.rules],
    ['harjoite', content.exercises],
  ]) {
    for (const id of duplicateIds(items)) errors.push(`Päällekkäinen ${label}: ${id}`)
  }
  for (const claim of content.claims) {
    for (const id of claim.sourceIds) {
      if (!sourceIds.has(id)) errors.push(`${claim.id}: tuntematon evidence source ${id}`)
    }
    if (claim.status === 'PUBLISHED_INTERNAL') {
      if (claim.technicalValidation !== 'PASSED') {
        errors.push(`${claim.id}: sisäisen beta-väitteen tekninen validointi puuttuu`)
      }
      if (
        claim.scientificReview !== 'PENDING_HUMAN_REVIEW' ||
        claim.reviewedBy.length > 0 ||
        claim.reviewedAt !== undefined
      ) {
        errors.push(
          `${claim.id}: sisäistä beta-väitettä ei saa esittää ihmisen arvioimana`,
        )
      }
    }
    if (claim.status === 'PUBLISHED_REVIEWED') {
      if (
        claim.scientificReview !== 'HUMAN_REVIEWED' ||
        claim.reviewedBy.length === 0 ||
        !claim.reviewedAt
      ) {
        errors.push(`${claim.id}: ihmisen arvioiman väitteen arviointitiedot puuttuvat`)
      }
    }
  }
  for (const rule of content.rules) {
    for (const id of rule.claimIds) {
      if (!claimIds.has(id)) errors.push(`${rule.id}: tuntematon evidence claim ${id}`)
      const claim = content.claims.find((candidate) => candidate.id === id)
      if (rule.status === 'PUBLISHED' && claim && !isOperationalClaim(claim)) {
        errors.push(
          `${rule.id}: julkaistu sääntö viittaa julkaisemattomaan väitteeseen ${id}`,
        )
      }
    }
  }
  for (const exercise of content.exercises) {
    for (const id of exercise.evidenceClaimIds) {
      if (!claimIds.has(id))
        errors.push(`${exercise.code}: tuntematon evidence claim ${id}`)
      const claim = content.claims.find((candidate) => candidate.id === id)
      if (exercise.status === 'PUBLISHED' && claim && !isOperationalClaim(claim)) {
        errors.push(
          `${exercise.code}: julkaistu harjoite viittaa julkaisemattomaan väitteeseen ${id}`,
        )
      }
    }
    for (const code of [
      ...exercise.regressionCodes,
      ...exercise.progressionCodes,
      ...exercise.substitutionCodes,
    ]) {
      if (!exerciseCodes.has(code))
        errors.push(`${exercise.code}: tuntematon harjoitekoodi ${code}`)
    }
  }
  for (const mapping of content.substitutions) {
    if (!exerciseCodes.has(mapping.fromCode)) {
      errors.push(`Korvaavuus alkaa tuntemattomasta harjoitteesta ${mapping.fromCode}`)
    }
    for (const code of mapping.toCodes) {
      if (!exerciseCodes.has(code))
        errors.push(`${mapping.fromCode}: tuntematon korvaava ${code}`)
    }
  }
  if (
    (content.release.status === 'INTERNAL_BETA' || content.release.status === 'PUBLIC') &&
    !content.release.immutable
  ) {
    errors.push('Käytössä olevan sisältöversion on oltava immutable.')
  }
  if (!options.ignoreDigest) {
    const expected = calculateContentDigest(content)
    if (content.release.contentDigest !== expected) {
      errors.push(`Sisältötiiviste ei täsmää: odotettu ${expected}`)
    }
  }
  return errors
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function pgArray(values) {
  return `array[${values.map(sqlLiteral).join(', ')}]::text[]`
}

export async function generateArtifacts(content) {
  const runtimeTarget = resolve(root, 'src/domain/coaching/content/generatedContentV1.ts')
  const sqlTarget = resolve(root, 'supabase/seed.sql')
  const prettierConfig = (await resolveConfig(runtimeTarget)) ?? {}
  const runtime = await format(
    `/* Automaattisesti generoitu tiedostosta training-content/v1. Älä muokkaa käsin. */\nexport const trainingContentV1 = ${JSON.stringify(content, null, 2)} as const\n`,
    { ...prettierConfig, parser: 'typescript' },
  )
  const rows = content.exercises
    .filter((exercise) => exercise.status === 'PUBLISHED')
    .map((exercise) => {
      const category = exercise.movementPatterns[0] ?? exercise.method
      const instructions = exercise.instructionsFi.join(' ')
      return `  (${[
        sqlLiteral(exercise.code),
        sqlLiteral(exercise.nameFi),
        sqlLiteral(category),
        pgArray(exercise.equipment),
        sqlLiteral(instructions),
        sqlLiteral(content.release.releaseId),
        sqlLiteral(exercise.version),
        `${sqlLiteral(JSON.stringify(exercise))}::jsonb`,
      ].join(', ')})`
    })
    .join(',\n')
  const definitionRows = content.exercises
    .filter((exercise) => exercise.status === 'PUBLISHED')
    .map(
      (exercise) =>
        `  (${[
          sqlLiteral(content.release.releaseId),
          sqlLiteral(exercise.code),
          sqlLiteral(exercise.version),
          sqlLiteral(exercise.nameFi),
          `${sqlLiteral(JSON.stringify(exercise))}::jsonb`,
        ].join(', ')})`,
    )
    .join(',\n')
  const releaseVerification = `do $verify_release$\nbegin\n  if not exists (\n    select 1 from public.training_content_releases\n    where release_id = ${sqlLiteral(content.release.releaseId)}\n      and content_digest = ${sqlLiteral(content.release.contentDigest)}\n      and semantic_version = ${sqlLiteral(content.release.version)}\n  ) then\n    raise exception 'training content release identity does not match immutable digest';\n  end if;\nend;\n$verify_release$;`
  const sql = `-- Automaattisesti generoitu tiedostosta training-content/v1. Älä muokkaa käsin.\ninsert into public.training_content_releases (release_id, semantic_version, status, content_digest, published_at, immutable)\nvalues (${[
    sqlLiteral(content.release.releaseId),
    sqlLiteral(content.release.version),
    sqlLiteral(content.release.status),
    sqlLiteral(content.release.contentDigest),
    sqlLiteral(content.release.publishedAt),
    'true',
  ].join(
    ', ',
  )})\non conflict (release_id) do nothing;\n\n${releaseVerification}\n\ninsert into public.exercise_definitions (content_release_id, exercise_code, definition_version, name_fi, definition)\nvalues\n${definitionRows}\non conflict (content_release_id, exercise_code, definition_version) do nothing;\n\ninsert into public.exercises (code, name_fi, category, equipment, instructions_fi, content_release_id, content_version, definition)\nvalues\n${rows}\non conflict (code) do update set\n  name_fi = excluded.name_fi,\n  category = excluded.category,\n  equipment = excluded.equipment,\n  instructions_fi = excluded.instructions_fi,\n  content_release_id = excluded.content_release_id,\n  content_version = excluded.content_version,\n  definition = excluded.definition,\n  is_active = true;\n`
  await writeFile(runtimeTarget, runtime)
  await writeFile(sqlTarget, sql)
}
