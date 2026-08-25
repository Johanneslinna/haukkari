# Supabase-kehitys ja käyttöönotto

## Paikallinen ympäristö

Supabasen paikallinen pino vaatii käynnissä olevan Docker-yhteensopivan
container-runtimen. Supabase CLI on lukittu projektin dev-riippuvuudeksi, joten
komennot toimivat npm-skriptien kautta.

```sh
npm install
npm run db:start
npm run db:reset
npm run db:test
npm run db:test-api
npm run db:test-sync
npm run db:test-sync-e2e
npm run db:types
```

`db:reset` on tuhoava vain paikalliselle kehitystietokannalle: se luo kannan
uudelleen, ajaa migraatiot ja lopuksi `supabase/seed.sql`-tiedoston. Paikallista
pinoa ei saa avata internetiin; siinä ei ole tuotannon TLS- tai rajoitussuojia.

Kopioi `supabase start` -tulosteesta API URL ja anon key tiedostoon
`.env.local`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local anon key>
```

Käynnistä tämän jälkeen frontend komennolla `npm run dev`. Paikallinen
sähköpostivahvistus avataan Supabasen paikallisesta sähköpostikäyttöliittymästä,
jonka osoitteen CLI näyttää käynnistyksen yhteydessä.

## Mitä testataan oikeassa tietokannassa

`npm run db:test` ajaa `supabase/tests/database`-hakemiston pgTAP-testit.
Testi luo transaktion sisään käyttäjät A ja B ja varmistaa, että:

- kaikissa 25 käyttäjätaulussa on pakotettu RLS ja neljä politiikkaa
- A näkee vain oman profiilinsa
- A ei voi luoda, päivittää tai poistaa B:n tietoja
- `user_id`:tä ei voi vaihtaa
- A:n rivi ei voi viitata B:n omistamaan tietueeseen
- kehityskuvien bucket on yksityinen ja käyttäjäpolkuun sidottu.

Testi tekee lopuksi rollbackin eikä jätä testikäyttäjiä kantaan.

`npm run db:test-api` luo paikallisen Auth-palvelun kautta kaksi vahvistettua
testikäyttäjää ja käyttää kummankin oikeaa JWT-istuntoa REST- ja Storage-API:n
kutsuihin. Testi varmistaa luku-, lisäys-, päivitys-, poisto- ja
omistajuusrajat sekä yksityisen kuvan lataus- ja allekirjoitusrajat. Testi
poistaa lopuksi kuvan ja molemmat käyttäjät.

## Hosted-projekti

1. Luo Supabase-projekti täsmälliseen EU-alueeseen, esimerkiksi Frankfurtiin
   (`eu-central-1`) tai Tukholmaan (`eu-north-1`). Älä valitse yleistä Europe-
   aluetta, jos tietojen on varmasti pysyttävä EU:ssa, sillä yleinen alue voi
   valita myös Lontoon tai Zürichin.
2. Aseta Authin Site URL täsmälleen osoitteeksi `https://haukkari.fi` ja lisää
   sallitut redirect-osoitteet `https://haukkari.fi/auth/callback` ja
   `https://haukkari.fi/salasana/uusi`.
3. Ota sähköposti + salasana ja sähköpostivahvistus käyttöön. Kytke ennen
   julkaisua oma tuotantokelpoinen SMTP-palvelu.
4. Linkitä projekti ja tarkista migraatiot ennen ajoa:

```sh
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run
npx supabase db push
npx supabase functions deploy delete-account
npx supabase functions deploy send-reminders
```

Älä aja `db reset --linked` -komentoa tuotantoon. Älä käytä `--include-seed`-
valintaa tuotantotietokantaan.

5. Lisää hosting-ympäristöön frontendin julkinen projektiosoite ja anon-avain.
   Edge Function saa `SUPABASE_URL`, `SUPABASE_ANON_KEY` ja
   `SUPABASE_SERVICE_ROLE_KEY` -arvot Supabasen omasta secret-ympäristöstä;
   service rolea ei kopioida frontend- tai hosting-muuttujiin.
   Aseta Edge Function -secret `APP_PUBLIC_URL=https://haukkari.fi`.
6. Luo kaksi erillistä testikäyttäjää staging-projektiin ja toista RLS-testin
   API-skenaariot niiden oikeilla JWT-istunnoilla ennen tuotantojulkaisua.

Web Pushin VAPID-, Vault-, cron- ja feature flag -asetukset kuvataan erikseen
tiedostossa [`docs/web-push.md`](./web-push.md). Yksityinen VAPID-avain ei saa
olla frontendin ympäristössä.

Viralliset viitteet:

- [Paikallinen kehitystyönkulku](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Edge Functionien julkaisu](https://supabase.com/docs/guides/functions/deploy)
- [Edge Function -salaisuudet](https://supabase.com/docs/guides/functions/secrets)
- [Supabasen alueet](https://supabase.com/docs/guides/platform/regions)

Julkaisun koko järjestys, staging-portti ja DNS/HTTPS-vaatimukset ovat
tiedostossa [`docs/release.md`](./release.md). Tietokannan ja Storage-objektien
erillinen varmistus on tiedostossa
[`docs/backup-and-restore.md`](./backup-and-restore.md).
