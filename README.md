# Haukkari

Haukkari on mobiili ensin rakennettava, asennettava harjoittelu- ja
ravintoseurannan PWA. Sovellus käyttää Reactia, TypeScriptiä, Viteä ja
Supabasea. Käyttöliittymän kieli on suomi, mittayksiköt ovat metrisiä ja
päivämäärät esitetään `fi-FI`-muodossa.

## Kehitys

Vaatimus: Node.js 24 tai uudempi.

```sh
npm install
copy .env.example .env.local
npm run dev
```

Supabasen paikalliskehitys vaatii Dockerin ja Supabase CLI:n. Ohje on
[docs/supabase.md](docs/supabase.md)-tiedostossa.

## Tarkistukset

```sh
npm run lint
npm run format-check
npm run typecheck
npm run unit
npm run integration
npm run build
npm run pwa:test
npm run e2e
npm run e2e:app
```

`npm run check` ajaa selain-E2E:tä lukuun ottamatta koko paikallisen
tarkistusketjun. Tietokannan RLS-testit ajetaan erikseen komennoilla
`npm run db:test`, `npm run db:test-api`, `npm run db:test-sync` ja
`npm run db:test-sync-e2e`, koska ne vaativat paikallisen Supabase-pinon.
`npm run e2e:app` rakentaa PWA:n ja testaa onboardingin, responsiivisen
navigaation, näppäimistöpolun sekä aktiivisen harjoituksen offline-reloadin.

## Dokumentaatio

- [Toteutussuunnitelma](docs/implementation-plan.md)
- [Vaiheiden 0–6 valmistumisauditointi](docs/phase-completion-audit.md)
- [Arkkitehtuuri ja hakemistorakenne](docs/architecture.md)
- [Tietomalli](docs/data-model.md)
- [Uhkamalli](docs/threat-model.md)
- [Päätösloki](docs/decisions.md)
- [Avoimet oletukset](docs/assumptions.md)
- [Supabase-käyttöönotto](docs/supabase.md)
- [Offline-first-synkronointi](docs/offline-sync.md)
- [Toteutuksen nykytila](docs/status.md)
- [Julkaisuohje](docs/release.md)
- [Varmuuskopiointi ja palautus](docs/backup-and-restore.md)
- [Asennusohje](docs/installation.md)
- [HealthKit- ja Health Connect -jatkopolku](docs/native-health-roadmap.md)

Tuotannon kanoninen osoite on `https://haukkari.fi/`. Julkaisua ei ole tehty;
DNS-, hosting- ja hosted Supabase -muutokset vaativat erillisen hyväksynnän ja
turvallisesti käytettävissä olevat tunnukset.

## Turvallisuus

Frontendissä käytetään vain Supabasen julkista URL-osoitetta ja anon-avainta.
Service role -avainta ei saa nimetä `VITE_`-alkuiseksi eikä tallentaa
repositoryyn. Katso [SECURITY.md](SECURITY.md).
