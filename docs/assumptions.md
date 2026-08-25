# Avoimet oletukset

| Oletus                         | Nykyinen ratkaisu                                                                     | Varmennushetki              |
| ------------------------------ | ------------------------------------------------------------------------------------- | --------------------------- |
| Supabase-alue                  | Uusi hosted-projekti valitaan EU-alueelta                                             | Ennen pilvikäyttöönottoa    |
| Sähköpostipalvelu              | Supabasen Auth-sähköpostit, tuotannossa oma SMTP                                      | Ennen julkaisemista         |
| Ikäraja ja huoltajan suostumus | Ensimmäinen versio on täysi-ikäisille                                                 | Tuotepäätös ennen julkaisua |
| Tietojen säilytysaika          | Käyttäjädata säilyy tiliin sidottuna; tombstonejen siivousaika määritellään myöhemmin | Vaihe 5                     |
| Kuvat                          | Pois käytöstä oletuksena, yksityinen bucket erillisellä suostumuksella                | Vaihe 5                     |
| Web Push                       | Pois käytöstä feature flagilla ilman VAPID-tunnuksia                                  | Vaihe 5                     |
| Analytiikka                    | Ei analytiikkaa ensimmäisessä versiossa                                               | Erillinen tietosuojapäätös  |
| Esimerkkiprofiili              | Seedissä oleva, täysin muokattava kehitysesimerkki; ei domain-logiikkaan kovakoodattu | Aloituskartoituksen UI      |
| Brändi ja domain               | Haukkari, kanoninen osoite `https://haukkari.fi/`                                     | Käyttäjä vahvisti 24.8.2026 |
| Frontend-hosting               | Palveluntarjoajaa ei ole valittu                                                      | Ennen DNS-muutosta          |
| Palautustavoitteet             | RPO/RTO ja varmistusten säilytysaika hyväksytetään palvelun omistajalla               | Ennen tuotantojulkaisua     |
| Rekisterinpitäjä               | Yhteystiedot, oikeusperusteet, vastaanottajat ja säilytysajat puuttuvat               | Ennen tuotantojulkaisua     |

Ikäraja, frontend-hosting, varmistusten palvelutaso ja tietosuojakuvauksen
rekisterinpitäjätiedot vaativat päätöksen ennen tuotantojulkaisua. Ne eivät estä
paikallista teknistä varmennusta.
