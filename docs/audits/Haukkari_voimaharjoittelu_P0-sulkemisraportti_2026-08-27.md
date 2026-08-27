# Haukkari – voimaharjoittelun P0-sulkemisraportti 2026-08-27

## 1. Rajaus ja auditointiperusta

Tämä raportti dokumentoi seitsemän P0-esteen tuotantokorjaukset haarassa
`codex/training-engine-v2`. Toteutuksen baseline on
`31204a7ef2e2685712a5396b7f1a67cc197d3e9c`.

Normatiivinen lähtöaineisto säilyy muuttamattomana tiedostossa
`docs/audits/Haukkari_voimaharjoittelu_hyvaksyntaraportti_2026-08-27.md`.
Alkuperäisen `scripts/audits/engine-audit.mjs`-skriptin hyväksymisehtoja ei ole
muutettu. Sen ainoat lähteeseen verrattavat muutokset ovat repositoryn uuteen
sijaintiin tarvittavat import-polut ja Windows-yhteensopiva repository-polun
muodostus.

Lähtöauditoinnin jakauma oli:

- `PASS 15`, `FAIL 10`, `NOT_IMPLEMENTED 14`, `PARTIAL 1`;
- avoimet P0-tapaukset: 9, 17, 23, 32, 33, 39 ja 40;
- 50 000 tapauksen ominaisuusajossa kohderajaus-, readiness-, aikabudjetti- ja
  hard constraint -rikkeitä.

P0-korjausten pysyvä suoritettava portti on `npm run audit:p0`. Se ajaa samat
julkiset tuotantoreitit, joita `PlanGenerator`, `coachingActions` ja aktiivinen
harjoitus käyttävät. Keskeneräistä P1/P2-hyväksyntäsarjaa ei ole muutettu
vihreäksi eikä lisätty rikkovaksi CI-portiksi.

## 2. P0-tapausten sulkeminen

### Tapaus 9 — 65+ käyttäjä sai voimaharjoituksen

- **Alkuperäinen tulos:** `FAIL`, P0. 65-vuotiaalle syntyi tämän betan
  prescription.
- **Juurisyy:** ikä- ja readiness-raja ei ollut yhteinen ja ohittamaton kaikissa
  prescriptionin muodostavissa kutsureiteissä.
- **Tuotantokorjaus:** `StrengthSafetyGate` vaatii voimaharjoittelussa iän,
  päivän readinessin ja valmiit turvallisuustiedot. Vain 18–64-vuotias voi saada
  tämän sisältöversion. RED estää kaiken automaattiharjoittelun, ORANGE estää
  voimaharjoituksen ja `healthBlocked` toimii fail-closed-periaatteella. Porttia
  käyttävät `resolvePrescription`, `prescribeSession`, suora aikuisten
  voimamoottori ja `PlanGenerator`.
- **Regressiotesti:** `P0-1: keskitetty fail-closed beta- ja
turvallisuusportti`; lisäksi testi
  `käyttää samaa porttia julkisessa prescription-API:ssa ja PlanGeneratorissa`.
- **Negatiivinen kontrolli:** vanha pelkkä `age >= 18` -ehto hyväksyy iän 65,
  mutta uusi portti palauttaa `OLDER_ADULT_ENGINE_NOT_AVAILABLE`.
- **Ominaisuuskattavuus:** iät 17, 18–64 ja 65; GREEN, YELLOW,
  ORANGE_RECOVERY ja RED_STOP; `healthBlocked` sekä legacy-tiedon puuttuminen.
- **Tulkintapäätös:** ikäraja koskee nimenomaan tätä voimasisältöjulkaisua, ei
  koko Haukkaria tai muita harjoitusmuotoja.

### Tapaus 17 — 5 kg → 6 kg ylitti 10 prosentin rajan

- **Alkuperäinen tulos:** `FAIL`, P0. Todellinen yhden kilogramman porras olisi
  nostanut kuormaa 20 prosenttia.
- **Juurisyy:** progressio käsitteli välineporrasta ehdotuksena ilman ehdotonta
  suhteellista ylärajaa ja käyttöliittymä saattoi olettaa välineelle kuvitteellisen
  pienemmän portaan.
- **Tuotantokorjaus:** `MAX_AUTOMATIC_LOAD_INCREASE_RATIO = 0.1` tarkistetaan
  saman liikkeen ja sisältöversion kahdesta vertailukelpoisesta suorituksesta.
  Kuormaa nostetaan vain vahvistetulla todellisella välineportaalla. Nauha- ja
  kehonpainoliikkeille ei synny kilogrammasuositusta ilman todellista kuormadataa.
- **Regressiotesti:** `P0-3: enintään 10 prosentin kuormaprogressio`, tapaukset
  `estää 5 -> 6 kg eikä keksi väliportaita` ja
  `ei hyväksy toisen version historiaa`.
- **Negatiivinen kontrolli:** testissä todetaan eksplisiittisesti, että
  `6 / 5 > 1.1`; mutatoitu vanha tulos rikkoisi portin.
- **Ominaisuuskattavuus:** 50 000 ajossa jokainen prescription tarkistetaan
  kohde-, aika-, väline- ja versionäkökulmasta; erillinen regressio tarkistaa
  kuormaportaan rajan.
- **Tulkintapäätös:** jos pienin todellinen välineporras ylittää 10 prosenttia,
  oikea tulos on kuorman pitäminen ennallaan tai yhden toiston progressio
  sallitun toistoalueen sisällä. Oikea tulos ei ole kuvitteellinen
  kilogrammaporras. Alkuperäisen auditointiskriptin tapaus 17 vaatii aina
  määritellyn `nextLoadKg`-arvon ja on tältä osin ristiriidassa tämän
  turvallisuusvaatimuksen kanssa; alkuperäistä ehtoa ei ole muutettu.

### Tapaus 23 — lihaskohtainen 16 sarjan viikkokatto puuttui

- **Alkuperäinen tulos:** `FAIL`, P0.
- **Juurisyy:** historiaa verrattiin harjoitteisiin, mutta seitsemän päivän
  lihaskohtaista kertymää ei laskettu samalla mallilla generoinnissa ja
  vaihtoehdoissa.
- **Tuotantokorjaus:** versionoitu `strength-volume-policy-1.0.0` laskee
  ensisijaisen lihaksen painolla 1,0 ja toissijaisen painolla 0,5. Kova katto on
  16 laskennallista sarjaa seitsemässä päivässä. Generaattori leikkaa tai jättää
  annoksen pois ennen prescriptionia. Jos yhtään turvallista annosta ei jää,
  julkinen API palauttaa `NO_SAFE_STRENGTH_DOSE_AVAILABLE`, ei tyhjää
  `SUPPORTED`-prescriptionia.
- **Regressiotesti:** `P0-4: versionoitu lihaskohtainen viikkovolyymikatto`.
- **Negatiivinen kontrolli:** testi osoittaa, että 15 toteutunutta + 3
  suunniteltua sarjaa ylittäisi katon ilman leikkausta.
- **Ominaisuuskattavuus:** satunnaistettu historia 0–16 sarjaa, kaikki julkaistut
  vastusharjoitteet, viiden välineprofiilin annokset ja sekä rolling- että
  session-primary-katto.
- **Tulkintapäätös:** turvallinen volyymiraja saa estää uuden voimaharjoitusannoksen;
  estoa ei saa naamioida onnistuneeksi tyhjäksi harjoitukseksi.

### Tapaus 32 — sarjan kipu ja tekniikka eivät kulkeneet tuotantopäätökseen

- **Alkuperäinen tulos:** `FAIL`, P0. UI välitti aina `pain=NONE` ja
  `techniqueOk=true`, ja vaihtoehto estyi ensimmäisen kirjatun sarjan jälkeen.
- **Juurisyy:** sarjaloki ei vaatinut todellisia turvallisuussyötteitä eikä
  jäljellä olevien sarjojen korvaamiselle ollut eheää tallennuspolkua.
- **Tuotantokorjaus:** ennen sarjan valmistumista käyttäjä valitsee kivun ja
  tekniikan onnistumisen. Paheneva, terävä tai toimintaa muuttava kipu sekä
  heikentynyt tekniikka pysäyttävät kyseisen liikkeen. Tehdyt sarjat säilyvät ja
  vain jäljellä oleva annos korvataan turvallisella vaihtoehdolla.
- **Regressiotesti:** `P0-2: sarjan todellinen kipu ja tekniikka`; lisäksi
  aktiivisen harjoituksen coachingActions-tallennustesti.
- **Negatiivinen kontrolli:** sama sarja tuottaa `MAINTAIN`-päätöksen vain
  todellisilla `NONE` + `techniqueOk=true` -syötteillä; kipu- ja
  tekniikkamutaatiot tuottavat `STOP_EXERCISE`.
- **Ominaisuuskattavuus:** sarjakohtaiset reason codet, kipu ja tekniikka
  tallennetaan JSON-snapshotteihin; selain-E2E käy aktiivisen harjoituksen läpi.
- **Tulkintapäätös:** `NONE` ja onnistunut tekniikka ovat käyttäjän vastauksia,
  eivät turvallisuuslogiikan oletuksia.

### Tapaus 33 — vakavan oireen STOP ei lukinnut harjoitusta

- **Alkuperäinen tulos:** `FAIL`, P0.
- **Juurisyy:** domain pystyi palauttamaan `REFER_SAFETY`, mutta aktiivinen
  harjoitus ei tallentanut lukkoa yhteisellä tuotantotoiminnolla eikä
  palautumisreitti tarkistanut päätöslokin STOP-tilaa.
- **Tuotantokorjaus:** vakava kipu sekä sydän-, hengitys-, huimaus- ja
  neurologiset oireet asettavat `safetyOutcome: STOP`. `saveWorkoutAdaptation`
  tallentaa prescriptionin ja päätöslokin sekä workout- että aktiiviseen
  workout-log-snapshotiin. Uudelleen avattu STOP-harjoitus menee suoraan
  palautteeseen eikä tavallista Jatka-painiketta näytetä. Valmis STOP-toteuma
  tallentuu `STOPPED`/`CANCELLED`-tiloihin.
- **Regressiotesti:** `P0-7: vakava oire lukitsee STOP-tilan`, erityisesti
  `tallentaa sarjapalautteen ja lukitun STOP-päätöksen coachingActions-reitillä`;
  lisäksi selain-E2E:n vakavan kivun polku.
- **Negatiivinen kontrolli:** lukoton harjoitus voidaan avata, mutta
  `SEVERE_PAIN_REPORTED`-lukkoa ei voi avata tavallisella reitillä.
- **Ominaisuuskattavuus:** tallennettu kipu, tekniikka, adaptation reason code,
  workout-status, workout-log-status ja päätöslokin safety outcome tarkistetaan.
- **Tulkintapäätös:** harjoituksen jatkaminen STOP-tilasta vaatisi tulevaisuudessa
  uuden, erikseen hyväksytyn turvallisuuspäätöksen; tavallista resume-toimintoa
  ei ole.

### Tapaus 39 — toispuoleisen pohjeturvotuksen polku puuttui

- **Alkuperäinen tulos:** `NOT_IMPLEMENTED`, P0.
- **Juurisyy:** daily check-inissä ei ollut kahta tarvittavaa rakenteista
  verisuonioireen syötettä.
- **Tuotantokorjaus:** nopeasti lisääntyvä toispuoleinen pohjeturvotus yhdessä
  lepokivun kanssa tuottaa RED_STOP-päätöksen ja vakaan reason coden
  `UNILATERAL_CALF_SWELLING_WITH_REST_PAIN`. Käyttäjä ohjataan arvioon.
  112-ohje annetaan vain, jos mukana on erillinen henkeä uhkaava oire.
- **Regressiotesti:** `P0-6: toispuoleinen pohjeturvotus ja lepokipu`.
- **Negatiivinen kontrolli:** pelkkä turvotus ilman lepokipua ei laukaise tätä
  yhdistelmäsääntöä.
- **Ominaisuuskattavuus:** yhdistelmä, yksittäiset ehdot ja erillisten
  hätäoireiden prioriteetti.
- **Tulkintapäätös:** päätöslogiikka ja myöhemmin asiantuntijatarkastettava
  käyttäjäteksti pidetään erillään.

### Tapaus 40 — hard constraint riippui vapaatekstin tulkinnasta

- **Alkuperäinen tulos:** `FAIL`, P0.
- **Juurisyy:** moottori etsi vapaatekstistä muutamia avainsanoja. Tuntematon tai
  eri tavalla kirjoitettu rajoite saattoi jäädä huomiotta.
- **Tuotantokorjaus:** hard constraint käyttää vain sallittuja
  `ConfirmedLimitationTag`-tunnisteita. Onboarding tarjoaa rakenteiset valinnat.
  Jos legacy-käyttäjällä on merkityksellinen vanha rajoiteteksti mutta ei
  vahvistettuja tunnisteita, prescription estetään
  `SAFETY_INFORMATION_INCOMPLETE`-koodilla, kunnes tiedot vahvistetaan.
  Vapaatekstistä ei tehdä automaattista lääketieteellistä päätöstä.
- **Regressiotesti:** `P0-5: vain vahvistetut rajoitetunnisteet ovat hard
constraint`; legacy-testi ajaa `completeOnboarding` → `PlanGenerator` →
  `resolvePrescription` -ketjun. Vanha, versio- ja lihasmetatiedot ohittava
  harjoitushistoria ladataan edelleen onnistuneesti.
- **Negatiivinen kontrolli:** sama pystyliike on kelvollinen ilman vahvistettua
  tunnistetta ja estyy `OVERHEAD_RESTRICTION`-tunnisteella.
- **Ominaisuuskattavuus:** vahvistetut polvi-, selkä-, olkapää- ja
  overhead-tunnisteet sekä vahvistamaton legacy-teksti.
- **Tulkintapäätös:** alkuperäinen auditointiskripti odottaa vapaatekstin
  automaattista tulkintaa. Se on ristiriidassa hyväksytyn vaatimuksen kanssa,
  jonka mukaan moottori käyttää vain käyttäjän vahvistamia tunnisteita.
  Alkuperäistä ehtoa ei ole muutettu.

## 3. Julkisten tuotantoreittien testaus

P0-portti ei testaa ainoastaan uusia apufunktioita:

1. `resolvePrescription` testataan keskitettynä julkisena prescription-API:na.
2. `generatePlan` testataan varsinaisen `PlanGenerator`-viikkoreitin kautta sekä
   estetylle että sallitulle voimaharjoitukselle.
3. `completeOnboarding` testataan `coachingActions`-reittinä legacy-rajoitteen
   kanssa.
4. `startWorkout`, `saveWorkoutAdaptation` ja `completeWorkout` testataan
   aktiivisen harjoituksen prescription-, decision trace-, sarjapalaute- ja
   STOP-tallennuksessa.
5. Selain-E2E varmistaa vakavan kivun käyttäjäpolun selaimessa.

## 4. Deterministinen 50 000 tapauksen P0-auditointi

- **Siemen:** `0x7a4f2c19`
- **Tapauksia:** 50 000
- **Oikeita sallittuja prescriptioneja:** 21 839
- **Odottamattomia estoja:** 0
- **Tyhjiä SUPPORTED-prescriptioneja:** 0
- **P0-, turvallisuus-, kohderajaus-, aika-, väline-, hard constraint-,
  nauha-kg-, volyymi- tai determinismirikkeitä:** 0

Odotetut ja toteutuneet estot täsmäsivät reason codeittain:

| Reason code                        | Odotettu | Toteutunut |
| ---------------------------------- | -------: | ---------: |
| `READINESS_RED_STOP`               |   11 505 |     11 505 |
| `READINESS_RECOVERY_ONLY`          |   10 849 |     10 849 |
| `HEALTH_ENGINE_NOT_AVAILABLE`      |    3 945 |      3 945 |
| `YOUTH_ENGINE_NOT_AVAILABLE`       |      667 |        667 |
| `OLDER_ADULT_ENGINE_NOT_AVAILABLE` |      699 |        699 |
| `SAFETY_INFORMATION_INCOMPLETE`    |      340 |        340 |
| `NO_SAFE_STRENGTH_DOSE_AVAILABLE`  |      156 |        156 |

Sallittujen prescriptionien kattavuus:

- **Ikä:** jokainen ikä 18–64 tuotti harjoituksia; pienin määrä oli 408 ja
  suurin 539 prescriptionia ikää kohden.
- **Tavoitteet:** BODY_RECOMPOSITION 2 422; FAT_LOSS 2 501; MUSCLE_GAIN 2 399;
  MAX_STRENGTH 2 355; ENDURANCE 2 453; SPEED_POWER 2 387; GENERAL_FITNESS
  2 421; POSTURE_MOBILITY 2 451; SPORT_PERFORMANCE 2 450.
- **Kokemus:** BEGINNER 7 204; INTERMEDIATE 7 427; ADVANCED 7 208.
- **Readiness:** GREEN 10 966; YELLOW 10 873.
- **Välineprofiilit:** BODYWEIGHT 4 405; BANDS 4 327; DUMBBELLS 4 298;
  MACHINES 4 405; FULL_GYM 4 404.

Näin nollatulos ei voi syntyä kaiken estämisestä, tyhjistä harjoituksista tai
tuettujen syötteiden suodattamisesta pois.

## 5. Alkuperäisen auditoinnin tulkinta

Alkuperäisen 40 tapauksen skriptin tuloksia ei ole kirjoitettu uudelleen. Se
raportoi korjatusta tuotantokoodista edelleen viisi kirjaimellisesti
`FAIL`/`NOT_IMPLEMENTED`-tilaan kovakoodattua P0-tapausta (23, 32, 33, 39 ja 40) sekä tapausta 17 koskevan ristiriitaisen `nextLoadKg`-odotuksen. Tämä
sulkemisraportti ja `audit:p0` ovat lisänäyttö nykyisten hyväksyttyjen P0-ehtojen
suoritettavasta toteutumisesta, eivät alkuperäisen raportin historian muutos.

## 6. Rajattu johtopäätös

Seitsemän P0-estettä on suljettu P0-työpaketin teknisessä portissa. Tämä ei ole
lupa aloittaa ihmisillä tehtävää vaihe 0:aa. Alkuperäisen hyväksyntäraportin
mukaan vaihe 0 edellyttää lisäksi kaikkien P1-kohtien sulkemista, 40/40
hyväksyntätapausta, selain- ja staging-portteja sekä ulkopuolista ihmisarviointia.
P1/P2-toteutusta ei sisällytetty tähän työpakettiin.
