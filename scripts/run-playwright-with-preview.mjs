import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import path from 'node:path'
import process from 'node:process'

const previewUrl = 'http://127.0.0.1:4173'

async function waitForPreview(preview) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (preview.exitCode !== null)
      throw new Error('Viten preview-palvelin pysähtyi ennen testejä.')
    try {
      const response = await fetch(previewUrl)
      if (response.ok) return
    } catch {
      // Palvelin on vielä käynnistymässä.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Viten preview-palvelin ei käynnistynyt ajoissa.')
}

export async function runPlaywrightWithPreview({ environment, config, arguments_ = [] }) {
  const preview = spawn(
    process.execPath,
    [path.resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1'],
    { cwd: process.cwd(), stdio: 'inherit', env: environment },
  )
  let status = 1
  try {
    await waitForPreview(preview)
    const result = spawnSync(
      process.execPath,
      [
        path.resolve('node_modules/@playwright/test/cli.js'),
        'test',
        '--config',
        config,
        ...arguments_,
      ],
      { cwd: process.cwd(), stdio: 'inherit', env: environment },
    )
    status = result.status ?? 1
  } finally {
    if (preview.exitCode === null) {
      preview.kill()
      const timeout = new Promise((resolve) => {
        const timer = setTimeout(resolve, 3_000)
        timer.unref()
      })
      await Promise.race([once(preview, 'exit'), timeout])
    }
  }
  return status
}
