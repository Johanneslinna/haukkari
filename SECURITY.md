# Tietoturva

Haukkari käsittelee terveys- ja elämäntapatietoja. Älä ilmoita
haavoittuvuuksia julkisessa issuessa. Toimita ilmoitus repositoryn omistajalle
yksityisesti ja liitä mukaan toistovaiheet ilman oikeiden käyttäjien tietoja.

## Salaisuudet

- Frontendissä sallitaan vain `VITE_SUPABASE_URL` ja julkinen
  `VITE_SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` kuuluu vain Edge Functionin secret-varastoon.
- `.env*`-tiedostot ohitetaan Gitissä lukuun ottamatta `.env.example`-mallia.
- Terveys-, tavoite- tai ravintotietoja ei kirjoiteta analytiikkaan tai
  asiakaspuolen lokeihin.

Jos salaisuus päätyy historiaan, se mitätöidään palvelussa ennen historian
siivousta. Pelkkä tiedoston poistaminen Gitistä ei riitä.
