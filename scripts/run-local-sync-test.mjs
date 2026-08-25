import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

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

const vitest = path.resolve('node_modules/vitest/vitest.mjs')
const test = spawnSync(
  process.execPath,
  [
    vitest,
    'run',
    'tests/local-sync/SupabaseSyncGateway.local-sync.test.ts',
    '--environment',
    'node',
  ],
  {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      LOCAL_SUPABASE_API_URL: localEnvironment.API_URL,
      LOCAL_SUPABASE_ANON_KEY:
        localEnvironment.ANON_KEY ?? localEnvironment.PUBLISHABLE_KEY,
      LOCAL_SUPABASE_ADMIN_KEY:
        localEnvironment.SERVICE_ROLE_KEY ?? localEnvironment.SECRET_KEY,
    },
  },
)

process.exit(test.status ?? 1)
