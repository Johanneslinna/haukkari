# Haukkarin julkaisuohje

Tämä ohje tekee projektista julkaistavan, mutta ei anna lupaa muuttaa DNS:ää,
hosted Supabasea tai tuotantohostingia. Tuotannon kanoninen osoite on
`https://haukkari.fi/` ja `www.haukkari.fi` ohjataan pysyvästi siihen, jos
`www` otetaan käyttöön.

## 1. Paikallinen käynnistys

Vaatimukset ovat Node.js 24+, Docker Desktop ja Git. PowerShellissä:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run db:start
npx supabase status
npm run db:reset
npm run dev -- --host 127.0.0.1
```

Kopioi `supabase status` -tulosteen paikallinen API URL ja anon-avain
`.env.local`-tiedostoon. Älä kopioi service role -avainta `VITE_`-muuttujaan.

## 2. Paikallinen julkaisuportti

Aja puhtaasta checkoutista:

```powershell
npm ci
npm run check
npm run e2e
npm run e2e:app
npm run db:reset
npm run db:test
npm run db:test-api
npm run db:test-sync
npm run db:test-sync-e2e
npm run build
```

Tilinpoiston ja muistutusfunktion testit vaativat lisäksi paikallisesti palvelevat
Edge Functionit ja vain testiä varten luodun, versionhallinnan ulkopuolisen
secret-tiedoston. Käynnistä `npx supabase functions serve --env-file
.env.functions.local` omassa terminaalissaan ja aja sen jälkeen:

```powershell
npm run db:test-delete-account
npm run db:test-reminders
```

Poista `.env.functions.local` heti testin jälkeen. Testejä ei saa suunnata
hosted- tai tuotantoprojektiin.

## 3. Hosted Supabase

1. Luo erilliset EU-alueen staging- ja tuotantoprojektit. Älä käytä tuotantoa
   ensimmäisenä migraatio- tai synkronointikohteena.
2. Aseta stagingiin kaksi testikäyttäjää ja varmista kahdella erillisellä
   selainkontekstilla synkronointi, konflikti, tombstone, kuvien yksityisyys ja
   tilin poisto.
3. Aseta tuotannon Auth Site URL arvoksi `https://haukkari.fi` ja sallitut
   uudelleenohjaukset arvoiksi `https://haukkari.fi/auth/callback` ja
   `https://haukkari.fi/salasana/uusi`.
4. Linkitä ensin staging ja tarkista migraatiot:

```powershell
npx supabase login
npx supabase link --project-ref <staging-project-ref>
npx supabase db push --dry-run
npx supabase db push
npx supabase functions deploy delete-account
npx supabase functions deploy send-reminders
```

5. Lisää Edge Function -salaisuudet Supabasen secret-varastoon. Vähimmäislista
   on `APP_PUBLIC_URL=https://haukkari.fi`, `PUSH_CRON_SECRET`, `VAPID_SUBJECT`,
   `VAPID_PUBLIC_KEY` ja `VAPID_PRIVATE_KEY`. Supabase toimittaa funktioille omat
   URL-, anon- ja service role -muuttujansa. Älä tallenna salaisuuksia
   repositoryyn tai keskusteluun.
6. Kun staging-portti on vihreä, toista `link`, `db push --dry-run`, hyväksyntä
   ja `db push` tuotannon projektiviitteellä. Älä koskaan aja `db reset
--linked` -komentoa.

## 4. Frontend-hosting ja haukkari.fi

Tuotantobuild tarvitsee vain julkiset muuttujat:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-or-anon-key>
VITE_ENABLE_WEB_PUSH=false
VITE_VAPID_PUBLIC_KEY=
VITE_TRAINING_ENGINE_V2=false
VITE_HOCKEY_BETA=false
```

Web Push otetaan käyttöön vasta erillisen laitetestauksen jälkeen asettamalla
feature flag ja julkinen VAPID-avain. Hosting-palvelun build-komento on `npm ci
&& npm run build`, julkaistava hakemisto `dist` ja Node-versio 24.

Harjoittelumoottori v2:n uudet beta-moduulit avataan ensin sisäisessä betassa
asettamalla `VITE_TRAINING_ENGINE_V2=true`. Jääkiekon aikuisten
amatöörikenttäpelaajan profiili vaatii lisäksi `VITE_HOCKEY_BETA=true`.
Turvallisuus- ja aikabudjettikorjaukset sekä vanhojen harjoitusten lukeminen ovat
aina käytössä. Älä avaa lippuja tuotannossa ennen tavallisen kuntoilun, juoksun,
voiman ja jääkiekon erillistä hyväksymistestausta.

Hostingissa tarvitaan:

- SPA fallback tuntemattomista sovellusreiteistä `/index.html`-tiedostoon
- HTTPS-pakotus ja kanoninen apex-osoite `https://haukkari.fi/`
- lyhyt tai `no-cache`-välimuisti `index.html`- ja service worker -tiedostoille
- pitkä immutable-välimuisti vain sisältötiivisteellisille `assets/`-tiedostoille
- DNS-palvelun vaatimat A/AAAA-, ALIAS/ANAME- tai CNAME-tietueet vasta, kun
  hosting-kohde on valittu ja näkyy palvelun omassa hallintanäkymässä.

DNS:ää ei muuteta ennen kuin sama build on läpäissyt staging-savukokeen. Varmista
sertifikaatin valmistuttua sekä `https://haukkari.fi/manifest.webmanifest` että
suora suojattu reitti, esimerkiksi `https://haukkari.fi/asetukset`.

## 5. Savukoe ja palautus

Tee vähintään rekisteröityminen ja vahvistus, kirjautuminen, onboarding,
offline-tallennus ja uudelleenlataus, kahden laitteen synkronointi, JSON/CSV/ICS-
lataukset, yksityisen kuvan lataus/poisto sekä tilin poisto. Tarkista, ettei
selaimen konsolissa tai Network-vastauksissa näy service role- tai
VAPID-yksityisavainta.

Pidä edellinen frontend-artifacti ja Edge Function -versio palautusta varten.
Frontend voidaan palauttaa julkaisemalla edellinen artifacti. Tietokantaan ei
tehdä resettiä tai taaksepäin ajettavaa migraatiota: tee tarvittaessa uusi
korjaava migraatio. Tietokannan tai Storage-objektien palautus tehdään
[varmuuskopio-ohjeen](./backup-and-restore.md) mukaisesti huoltokatkon aikana.

Harjoittelumoottori v2:n lähdekoodipalautuspiste on annotoitu Git-tagi
`restore/pre-training-engine-v2-2026-08-25` (commit `2644e22`). Palautus tehdään
luomalla tagista erillinen recovery-haara; työpuuta tai käyttäjädataa ei palauteta
`reset --hard` -komennolla.
