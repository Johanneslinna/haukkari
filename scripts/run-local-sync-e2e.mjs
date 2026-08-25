import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { runPlaywrightWithPreview } from './run-playwright-with-preview.mjs'

const cli = path.resolve('node_modules/supabase/dist/supabase.js')
const status = spawnSync(process.execPath, [cli, 'status', '-o', 'env'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  env: process.env,
})
if (status.status !== 0) {
  console.error(status.stderr.trim() || 'Paikallinen Supabase ei ole käynnissä.')
  process.exit(status.status ?? 1)
}
const localEnvironment = Object.fromEntries(
  status.stdout
    .split(/\r?\n/u)
    .map((line) => line.match(/^([A-Z0-9_]+)="?(.*?)"?$/u))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
)
const environment = {
  ...process.env,
  VITE_SUPABASE_URL: localEnvironment.API_URL,
  VITE_SUPABASE_ANON_KEY: localEnvironment.ANON_KEY ?? localEnvironment.PUBLISHABLE_KEY,
  VITE_E2E_SYNC_HARNESS: 'true',
  LOCAL_SUPABASE_API_URL: localEnvironment.API_URL,
  LOCAL_SUPABASE_ANON_KEY: localEnvironment.ANON_KEY ?? localEnvironment.PUBLISHABLE_KEY,
  LOCAL_SUPABASE_ADMIN_KEY:
    localEnvironment.SERVICE_ROLE_KEY ?? localEnvironment.SECRET_KEY,
}

function run(entry, arguments_) {
  const result = spawnSync(process.execPath, [path.resolve(entry), ...arguments_], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: environment,
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run('node_modules/typescript/bin/tsc', ['-b'])
run('node_modules/vite/bin/vite.js', ['build'])
const playwrightStatus = await runPlaywrightWithPreview({
  environment,
  config: 'playwright.sync.config.ts',
})
process.exit(playwrightStatus)
