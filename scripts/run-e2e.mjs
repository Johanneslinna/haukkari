import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { runPlaywrightWithPreview } from './run-playwright-with-preview.mjs'

const environment = { ...process.env }

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
const status = await runPlaywrightWithPreview({
  environment,
  config: 'playwright.config.ts',
  arguments_: process.argv.slice(2),
})
process.exit(status)
