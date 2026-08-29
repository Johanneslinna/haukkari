import assert from 'node:assert/strict'
import { access, readFile, readdir } from 'node:fs/promises'

const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'))
assert.equal(manifest.name, 'Haukkari')
assert.equal(manifest.lang, 'fi-FI')
assert.equal(manifest.start_url, '/')
assert.equal(manifest.scope, '/')
assert.ok(['standalone', 'fullscreen'].includes(manifest.display))
assert.equal(manifest.orientation, 'any')

const pngIcons = manifest.icons.filter((icon) => icon.type === 'image/png')
assert.ok(pngIcons.some((icon) => icon.sizes === '192x192' && icon.purpose === 'any'))
assert.ok(pngIcons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'any'))
assert.ok(
  pngIcons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable'),
)

for (const icon of pngIcons) {
  await access(`dist/${icon.src.replace(/^\//u, '')}`)
}
await access('dist/apple-touch-icon.png')
await access('dist/sw.js')
const distFiles = await readdir('dist')
assert.ok(distFiles.some((file) => /^workbox-.*\.js$/u.test(file)))

const index = await readFile('dist/index.html', 'utf8')
assert.match(index, /rel="manifest"/u)
assert.match(index, /rel="apple-touch-icon"/u)
assert.match(index, /name="robots" content="noindex, nofollow, noarchive"/u)

const vercelConfig = JSON.parse(await readFile('vercel.json', 'utf8'))
assert.ok(
  vercelConfig.rewrites.some(
    (rewrite) => rewrite.source === '/(.*)' && rewrite.destination === '/index.html',
  ),
)
const robotsHeader = vercelConfig.headers
  .flatMap((rule) => rule.headers)
  .find((header) => header.key.toLowerCase() === 'x-robots-tag')
assert.equal(robotsHeader?.value, 'noindex, nofollow, noarchive')

const serviceWorker = await readFile('dist/sw.js', 'utf8')
assert.match(serviceWorker, /push-handler\.js/u)
assert.match(serviceWorker, /index\.html/u)

const updateNotice = await readFile('src/app/UpdateNotice.tsx', 'utf8')
assert.match(updateNotice, /needRefresh/u)
assert.match(updateNotice, /updateServiceWorker\(true\)/u)

const builtSources = [index, serviceWorker]
for (const file of await readdir('dist/assets')) {
  builtSources.push(await readFile(`dist/assets/${file}`, 'utf8'))
}
const productionBundle = builtSources.join('\n')
assert.doesNotMatch(productionBundle, /visualTodayHarness/u)
assert.doesNotMatch(productionBundle, /today-state=/u)
assert.match(productionBundle, /INTERNAL BETA/u)
assert.doesNotMatch(
  productionBundle,
  /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ACCESS_TOKEN|DATABASE_URL|VERCEL_TOKEN|GITHUB_TOKEN|SMTP_PASSWORD/u,
)

process.stdout.write(
  'PWA-buildin manifesti-, kuvake-, offline- ja päivitysportti: PASS\n',
)
