# Haukkarin aikuisten voimaharjoittelun beta-tukisopimus

**Päiväys:** 28.8.2026

**Tila:** luonnos ihmisasiantuntijan hyväksyttäväksi

**Viikkopolitiikka:** `adult-strength-week-1.0.0`

**Sisältöjulkaisu:** `adult-resistance-v1.0.0` (muuttamaton)

## Tarkoitus

Tämä luonnos kertoo, milloin Haukkarin nykyinen aikuisten voimaharjoittelun sisäinen beta voi muodostaa tuetun koko kehon voimaviikon. Rajat ovat konservatiivisia, versionoituja `INTERNAL_BETA`-tuoteoletuksia. Ne eivät ole lääketieteellisesti todistettuja yksilörajoja eivätkä korvaa terveydenhuollon tai nimetyn valmennusasiantuntijan arviota.

## Tuettu kohderyhmä

Nykyinen beta on rajattu 18–64-vuotiaille aikuisille, joiden pakolliset turvallisuustiedot ovat täydelliset, terveysseulonta ei estä automaattista ohjelmointia ja päivän readiness sallii voimaharjoittelun. RED_STOP estää harjoittelun. ORANGE_RECOVERY sallii korkeintaan erillisen palauttavan vaihtoehdon, ei voimaharjoituksen jatkamista.

Tuettu viikko edellyttää lisäksi, että käyttäjän ilmoittamiin päiviin, päiväkohtaisiin aikabudjetteihin, välineisiin ja volyymikattoihin mahtuu turvallinen ja tarkoituksenmukainen annos. Osittainen tai tukematon tulos näytetään käyttäjälle syyn ja toimintaohjeen kanssa.

## Välineiden vähimmäisraja

`BODYWEIGHT_ONLY` ei kuulu nykyisen sisältöjulkaisun täyden koko kehon voimaviikon beta-tukeen. `adult-resistance-v1.0.0` ei sisällä pelkällä kehonpainolla tehtävää, julkaistua ja auditoitua turvallista vetoliikettä.

Kotibetan vähimmäisväline on siksi pitkä vastuskuminauha tai muu Haukkarin nykyisen sisältöjulkaisun hyväksymä vetoväline. Pelkän kehonpainon valinta palauttaa:

- viikon tila: `UNSUPPORTED`;
- syy: `PULL_PATTERN_EQUIPMENT_REQUIRED`;
- käyttäjäohje: “Täysi kotivoimaohjelma tarvitsee vetoliikettä varten vähintään pitkän vastuskuminauhan tai muun Haukkarin tukeman välineen.”

Tämä on sisältö- ja tuoteraja. Se ei ole terveydellinen harjoittelukielto eikä väite siitä, ettei kehonpainolla voisi harjoitella turvallisesti. Sovellus ei vain muodosta nykyisellä auditoidulla sisältöjulkaisulla täyttä koko kehon voimaviikkoa ilman tuettua vetovälinettä.

## Hyväksyntätapausten tulkinta

Alkuperäisen hyväksyntäraportin kehonpainoon sidottuja tapauksia 1, 10 ja 12 ei merkitä PASS-tilaan. Niiden toteutustila on korkeintaan `RESOLVED_BY_EXPLICIT_PRODUCT_RESTRICTION`, jos tämä tukisopimus hyväksytään ja tuotantopolku palauttaa edellä kuvatun eksplisiittisen tukemattoman tuloksen.

## Hyväksyntä ja myöhempi laajennus

Rajaus vaatii ennen betakäyttöä nimetyn ihmisasiantuntijan hyväksynnän. BODYWEIGHT_ONLY voidaan lisätä täyden viikon tukeen vasta uutena versionoituna sisältöjulkaisuna, kun turvallinen vetoliike, annostus, vasta-aiheet, korvaavat liikkeet, tekniikkaohje ja testikattavuus on arvioitu. Nykyistä `adult-resistance-v1.0.0`-julkaisua ei muutettu tässä työssä.
