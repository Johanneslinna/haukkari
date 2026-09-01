import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'

const root = resolve('.')
const roots = [resolve('e2e'), resolve('tests/e2e-app'), resolve('tests/e2e-local')]
const expectedReasons = new Map([
  ['Offline-polku ajetaan Chromium-mobiililla.', 'tests/e2e-app/app.spec.ts'],
  [
    'Koko aktiivisen harjoituksen polku ajetaan kerran Chromium-mobiililla.',
    'tests/e2e-app/app.spec.ts',
  ],
  ['Oirepolku ajetaan kerran Chromium-mobiililla.', 'tests/e2e-app/app.spec.ts'],
  [
    'Tietosuojan latauspolku ajetaan kerran Chromium-mobiililla.',
    'tests/e2e-app/app.spec.ts',
  ],
  [
    'Visuaaliset kuvat tuotetaan kerran Chromiumilla.',
    'tests/e2e-app/today-visual.spec.ts',
  ],
])

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)))
    else if (['.ts', '.tsx', '.js', '.mjs'].includes(extname(entry.name)))
      files.push(path)
  }
  return files
}

const findings = []
for (const directory of roots) {
  for (const file of await sourceFiles(directory)) {
    const source = await readFile(file, 'utf8')
    const relativeFile = relative(root, file).replaceAll('\\', '/')
    for (const match of source.matchAll(
      /\b(?:test|describe|it)\.(?:skip|fixme)\s*\(/gu,
    )) {
      findings.push({ file: relativeFile, kind: match[0] })
    }
    if (/\b(?:test|describe|it)\.only\s*\(/u.test(source)) {
      throw new Error(`${relativeFile}: E2E-testissä on kielletty .only`)
    }
    for (const [reason, expectedFile] of expectedReasons) {
      if (relativeFile === expectedFile && source.includes(reason)) {
        const count = source.split(reason).length - 1
        if (count !== 1)
          throw new Error(`${relativeFile}: skip-syy esiintyy ${count} kertaa`)
      }
    }
  }
}

if (findings.length !== expectedReasons.size) {
  throw new Error(
    `E2E-skip-auditointi odotti ${expectedReasons.size} deklaratiivista skippiä, löytyi ${findings.length}: ${JSON.stringify(findings)}`,
  )
}

for (const [reason, expectedFile] of expectedReasons) {
  const source = await readFile(resolve(expectedFile), 'utf8')
  if (!source.includes(reason)) {
    throw new Error(`${expectedFile}: hyväksytty skip-syy puuttuu: ${reason}`)
  }
}

console.log(
  `E2E-skip-auditointi läpäisty: ${findings.length} hyväksyttyä ehdollista skippiä, ei fixme/only-löydöksiä.`,
)
