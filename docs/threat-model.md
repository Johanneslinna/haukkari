# Uhkamalli

## Suojattavat tiedot

Terveysseulonta, tavoitteet, harjoitus- ja ravintohistoria, kehomittaukset,
mahdolliset kuvat, Auth-identiteetti sekä poistopyynnöt ovat suojattavia.

| Uhka                       | Esimerkki                                  | Hallinta                                                                | Varmennus                    |
| -------------------------- | ------------------------------------------ | ----------------------------------------------------------------------- | ---------------------------- |
| Identiteetin väärentäminen | Varastettu istunto                         | Supabase Auth, HTTPS, lyhytikäinen JWT, ei service rolea selaimessa     | Auth-integraatiotestit       |
| Tietojen muuttaminen       | `user_id` vaihdetaan API-pyynnössä         | RLS `WITH CHECK`, omistajuustriggeri, versioehto                        | pgTAP kahdella käyttäjällä   |
| Kiistämättömyys            | Sama offline-operaatio lähetetään kahdesti | Operaation UUID ja yksikäsitteinen idempotenssiavain                    | Unit, integraatio ja REST    |
| Tietovuoto                 | Käyttäjä A lukee B:n tiedot                | RLS jokaisessa käyttäjätaulussa, yksityinen Storage                     | RLS- ja Storage-testit       |
| Palvelunesto               | Loputon outbox-uusinta                     | Eksponentiaalinen viive ja enimmäisviive ilman tietojen hylkäystä       | Sync-integraatiotesti        |
| Oikeuksien korotus         | Service role päätyy bundleen               | Vain Edge Function -secret, `VITE_`-kielto, bundle-skannaus             | Build-testi                  |
| Offline-laitteen menetys   | Paikalliset tiedot jäävät selaimeen        | Uloskirjautuminen tyhjentää käyttäjän paikalliset arkaluonteiset tiedot | IndexedDB-yksikkötesti       |
| Tahaton terveystietovuoto  | Push tai loki kertoo diagnoosin            | Geneerinen push-teksti, ei terveystietoja analytiikkaan/lokeihin        | Vaiheen 5 vuotoskannaus      |
| Push-avaimen paljastuminen | VAPIDin yksityinen avain päätyy PWA:han    | Frontendissä vain julkinen avain; yksityinen avain Edge-secretissä      | Bundle- ja salaisuusskannaus |
| Kuvan URL:n jakautuminen   | Pysyvä linkki avaa yksityisen kuvan        | Yksityinen bucket, käyttäjäpolku ja viiden minuutin signed URL          | Storage-API-eristystesti     |

## Jäännösriskit

Selaimen paikallinen tietokanta ei ole päästä päähän salattu. Laitteen oma
lukitus ja käyttöjärjestelmän salaus ovat siksi olennaisia. Hosted Supabasen
alue, varmuuskopiointi ja lokien säilytys varmennetaan vasta oikean projektin
käyttöönotossa.
