# Versionoitu harjoitussisältö

Ensimmäinen muuttumaton julkaisu on `training-content/v1` ja sen tunnus on
`adult-resistance-v1.0.0`.

## Julkaisun tiedostot

- `release.json`: julkaisutunnus, versio, ikäraja, tuetut ja tukemattomat polut,
  skeemaversiot ja SHA-256-tiiviste;
- `evidence-sources.json`: lähderekisteri;
- `evidence-claims.json`: väitteet, kohderyhmä, annoskehys, varmuus ja arviointi;
- `prescription-rules.json`: näyttöön tai tuotepolitiikkaan sidotut säännöt;
- `exercises.json`: harjoitemäärittelyt, kuormatyypit, väsymys, rajat ja viitteet;
- `substitutions.json`: eksplisiittiset korvaavuudet.

Kaikki tiedostot validoidaan Zod-skeemoilla. Validointi tarkistaa lisäksi
uniikit tunnukset, lähde-, claim-, harjoite- ja korvaavuusviitteet, käytössä
olevien sääntöjen sisäiseen betaan hyväksytyt claimit, ihmistarkastuksen tilan
sekä sisältötiivisteen.

## Yksi totuus

```text
training-content/v1
  -> src/domain/coaching/content/generatedContentV1.ts
  -> supabase/seed.sql
```

Runtime-katalogia tai seediä ei ylläpidetä käsin. `npm run content:validate`
validoi paketin, ajaa rikotun viitteen ja muuttumattomuuden regressiot ja generoi
molemmat artefaktit. `npm run content:seed` generoi samat artefaktit erillisenä
komentona.

Supabasen `exercises`-taulu on nykyisen version projektio. Sen rinnalla
`training_content_releases` säilyttää julkaisut ja SHA-256-tiivisteet sekä
`exercise_definitions` jokaisen `(content_release_id, exercise_code,
definition_version)`-määrittelyn omana rivinään. Julkaisuja ja määrittelyjä
suojaavat tietokantatriggerit päivitykseltä ja poistamiselta. Sama vakaa
harjoitekoodi voi siten esiintyä useassa sisältöjulkaisussa ilman vanhan version
ylikirjoittamista. Prescription-snapshot tallentaa lisäksi käytetyn release- ja
harjoiteversion sekä käyttäjälle näytetyn ohjeen.

## Julkaisupolitiikka

Sisältöä ei muokata paikallaan. Muutos tehdään uuteen hakemistoon/semanttiseen
versioon, uudella tiivisteellä. Ensimmäisen julkaisun tila on `INTERNAL_BETA`.
Sen kuusi aikuisten claimia ovat `PUBLISHED_INTERNAL`-tilassa,
`technicalValidation: PASSED`, `scientificReview: PENDING_HUMAN_REVIEW` ja
`reviewedBy: []`. Ne ovat teknisesti validoituja sisäisen testauksen syötteitä,
eivät asiantuntijoiden lopullisesti hyväksymiä tutkimusväitteitä. Tila voidaan
nostaa `PUBLISHED_REVIEWED`-tasolle vain nimetyn ihmisen ja arviointiajan kanssa.
Draft-juniori- ja lajiclaimit eivät ole sallittuja käytössä olevan
prescription-säännön viitteiksi.
