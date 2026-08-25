import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const outputs = [
  { source: 'public/favicon.svg', output: 'public/apple-touch-icon.png', size: 180 },
  { source: 'public/favicon.svg', output: 'public/icon-192.png', size: 192 },
  { source: 'public/favicon.svg', output: 'public/icon-512.png', size: 512 },
  {
    source: 'public/icon-maskable.svg',
    output: 'public/icon-maskable-512.png',
    size: 512,
  },
]

const browser = await chromium.launch()
try {
  for (const icon of outputs) {
    const svg = await readFile(icon.source, 'utf8')
    const page = await browser.newPage({
      viewport: { width: icon.size, height: icon.size },
      deviceScaleFactor: 1,
    })
    await page.setContent(`
      <style>
        html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #f8f3e8; }
        svg { display: block; width: 100%; height: 100%; }
      </style>
      ${svg}
    `)
    await page.screenshot({ path: icon.output })
    await page.close()
  }
} finally {
  await browser.close()
}

process.stdout.write(`Luotiin ${outputs.length} Haukkari-asennuskuvaketta.\n`)
