# Web Pushin käyttöönotto

Web Push on lähdekoodissa valmiina, mutta oletuksena pois päältä. Hosted-
ympäristöön ei ole tehty muutoksia tässä toteutusvaiheessa.

## Turvallisuusrajat

- Selain saa vain julkisen `VITE_VAPID_PUBLIC_KEY`-avaimen.
- `VAPID_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ja `PUSH_CRON_SECRET`
  kuuluvat vain Edge Functionin secret-ympäristöön.
- Ilmoituslupa kysytään vasta Muistutukset-näkymän erillisestä painikkeesta.
- Tilaus tallennetaan laitekohtaisesti. Vanhentunut tai push-palvelun 404/410-
  vastauksen saanut tilaus poistetaan.
- Service worker ja Edge Function käyttävät aina kiinteää näkyvää tekstiä:
  “Päivän treenitarkistus odottaa.” Käyttäjän muistutusotsikkoa tai terveystietoa
  ei lähetetä push-kuormassa.

iOS/iPadOS tukee Web Pushia Koti-valikkoon lisätyssä web-sovelluksessa ja
käyttöluvan pyynnön pitää seurata käyttäjän toimintoa. Muissa ympäristöissäkin
Push API vaatii suojatun kontekstin ja VAPIDin julkisen avaimen.

## Hosted-asennus

1. Generoi VAPID-avainpari hallitussa ympäristössä. Älä tallenna yksityistä
   avainta repositoryyn tai `VITE_`-muuttujaan.
2. Aseta frontendin hosting-ympäristöön:

```dotenv
VITE_ENABLE_WEB_PUSH=true
VITE_VAPID_PUBLIC_KEY=<julkinen-avain>
```

3. Aseta palvelinsalaisuudet Supabaseen:

```sh
npx supabase secrets set \
  VAPID_PUBLIC_KEY=<julkinen-avain> \
  VAPID_PRIVATE_KEY=<yksityinen-avain> \
  VAPID_SUBJECT=mailto:<ylläpitäjän-sähköposti> \
  PUSH_CRON_SECRET=<pitkä-satunnainen-arvo> \
  APP_PUBLIC_URL=https://<sovelluksen-osoite>
```

4. Tallenna sama projektiosoite ja cron-salaisuus Supabase Vaultiin SQL-
   editorissa. Nimet ovat migraation odottamat `project_url` ja
   `push_cron_secret`:

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<pitkä-satunnainen-arvo>', 'push_cron_secret');
```

5. Tarkista migraatio dry-runilla, aja se ja julkaise ajastettu toiminto:

```sh
npx supabase db push --dry-run
npx supabase db push
npx supabase functions deploy send-reminders
```

Migraatio luo minuutin välein ajettavan `pg_cron`-työn. Työ kutsuu Edge
Functionia `pg_net`:llä vain, kun molemmat Vault-arvot ovat saatavilla.
Toimituskuitti estää saman laitekohtaisen muistutuksen lähettämisen kahdesti
samassa paikallisessa aikaminuutissa.

Viralliset viitteet:

- [Supabase: Edge Functionin ajastus](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase: Edge Functionin riippuvuudet](https://supabase.com/docs/guides/functions/dependencies)
- [MDN: PushManager.subscribe](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe)
- [WebKit: Web Push iOS/iPadOS-kotisovelluksissa](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
