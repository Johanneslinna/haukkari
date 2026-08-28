# Haukkarin aikuisten voimaharjoittelun P1-viikkosuunnitteluraportti

**Päiväys:** 28.8.2026

**Tarkastettu baseline:** `12333412454735ddf37a0100e61da325b60800b0`

**Haara:** `codex/training-engine-v2`

**Viikkopolitiikka:** `adult-strength-week-1.0.0`

**Aikapolitiikka:** `adult-strength-time-1.1.0`

**Sisältöjulkaisu:** `adult-resistance-v1.0.0` (muuttamaton)

## Rajaus ja tulkinta

Työ sulkee hyväksyntätapauksissa 1, 2, 5, 6, 10, 11, 12, 14 ja 22 kuvatut viikkosuunnittelun puutteet. Kanoninen viikkopolitiikka ohjaa frekvenssiä, harjoitusten keskinäistä rakennetta, liikemallien kattavuutta, toteutunutta ja suunniteltua volyymia, sarjaprogressiota sekä väliin jääneen harjoituksen käsittelyä.

Volyymi-, frekvenssi- ja progressiorajat ovat versionoituja, konservatiivisia `INTERNAL_BETA`-tuoteoletuksia. Ne eivät ole lääketieteellisesti todistettuja yksilörajoja. Turvallisuus-, aika- ja välinerajat ohittavat aina tavoitevolyymin.

## Kanoninen tuotantopolku

Tuotantopolku on:

`WorkoutHistory` → `StrengthVolumePolicy` → `StrengthWeekPolicy` → `PlanGenerator` → `resolvePrescription` → `AdultResistanceEngine` → `TimeBudgetPolicy` → tallennettu `TrainingPlan`/prescription/decision trace → `WeekPage` / `WeekSessionPreviewPage` / `WorkoutPage`.

`StrengthVolumePolicy` säilyy ainoana laskennallisen lihasvolyymin lähteenä. Päälihaksen paino on 1,0 ja sekundaarilihaksen 0,5. Viikkopolitiikka käyttää samoja `calculatePlannedMuscleVolume`, `calculateRollingMuscleVolume`, `maximumAdditionalSets` ja `addPlannedSets` -reittejä; rinnakkaista volyymilaskuria ei lisätty.

`PlanGenerator` materialisoi voimaharjoitukset aikajärjestyksessä. Jokaisen harjoituksen kanonisen aikamallin jälkeen säilyneet todelliset sarjat lisätään suunniteltuun tilaan ennen seuraavan päivän ratkaisua. Tunnetun ulkopuolisen voimaharjoituksen prescription lasketaan samaan suunniteltuun volyymiin. Tuntematon ulkopuolinen voimaharjoitus lasketaan frekvenssiin, mutta sen volyymia ei arvata ja sarjaprogressio pidätetään koodilla `EXTERNAL_STRENGTH_VOLUME_UNKNOWN`.

## Frekvenssi ja viikkorakenteet

| Tilanne                                        | Rakenne ja katto                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| yksi käytettävissä oleva päivä                 | `FULL_BODY`, tila `PARTIAL`, `ONE_DAY_FULL_BODY_PARTIAL_COVERAGE`  |
| kaksi päivää                                   | `FULL_BODY_A` / `FULL_BODY_B`                                      |
| kolme päivää                                   | `FULL_BODY_A` / `FULL_BODY_B` / `FULL_BODY_C`                      |
| neljä päivää, aktiivinen intermediate/advanced | `UPPER_A` / `LOWER_A` / `UPPER_B` / `LOWER_B`                      |
| beginner tai aktiivinen paluublokki            | enintään kolme voimaharjoitusta                                    |
| active intermediate/advanced                   | enintään neljä voimaharjoitusta                                    |
| viisi tai useampi valittu päivä                | ylimääräisiä päiviä ei täytetä keinotekoisesti voimaharjoittelulla |

Cold startissa perusvoima- ja lihasmassapolku alkaa kahdesta voimaharjoituksesta. Vahvistetun jatkuvuuden jälkeen tavoite voi nousta käytettävissä olevien päivien ja käyttäjäluokan sallimissa rajoissa. Lyhyiden harjoitusten 10 minuutin kierto on A: polvidominantti + veto ja B: lonkkadominantti + työntö. Kierto jatkuu viikon blueprintin mukaisesti eikä aloita joka kerta A:sta.

Väliin jäänyttä harjoitusta ei siirretä, sen volyymia ei lisätä seuraavaan harjoitukseen eikä historiaa kirjoiteta uudelleen. Seuraava rooli säilyy kierron seuraavana roolina ja päätösloki sisältää `MISSED_SESSION_NOT_DOUBLED`.

## Tavoite- ja toteumavolyymi

`TrainingPlan.strengthWeek` erottaa:

- `completedVolume`;
- `plannedVolume`;
- `remainingTargetVolume`;
- `hardCapRemaining`;
- `movementPatternCoverage` ja `missingMovementPatterns`;
- `sessionExposureCount`.

Cold startissa yleisen lihaskunnon, perusvoiman ja lihasmassan konservatiivinen tavoitealue on 4–8 laskennallista sarjaa päälihasta kohti. Vahvistetun jatkuvuuden jälkeen lihasmassan tavoitealue on 8–12 ja perusvoiman 6–10. Ehdoton vierivän seitsemän vuorokauden katto on 16 laskennallista sarjaa lihasta kohti. Yhdessä harjoituksessa sama päälihas saa enintään kuusi päälihassarjaa.

Tavoite ei ole lupaus täyttää sarjamäärää. Jos aika tai tuettu sisältö ei riitä, suunnitelma kertoo vajauksen koodeilla `WEEKLY_VOLUME_BELOW_TARGET_TIME_LIMITED` tai `WEEKLY_VOLUME_BELOW_TARGET_EQUIPMENT_LIMITED`.

## Sarjaprogressio

Sarjaprogressio on kolmas etenemisvaihe toistojen ja käyttäjän vahvistaman kuorman jälkeen. Sarja voidaan lisätä vain, kun:

- tavoite tarvitsee lisää viikkovolyymia;
- kahdessa eri täydellisessä seitsemän vuorokauden ikkunassa on saman liikkeen laadukas hyväksytty harjoitus;
- toteuma osui toisto- ja tavoite-RIR-alueeseen;
- kipua, STOP-tilaa, vajaita annoksia, tekniikkavirhettä, RETURNING-tilaa tai vakavaa palautumisongelmaa ei ole;
- toisto- tai kuormaprogressio ei ole samalle altistukselle etusijalla;
- lisäys mahtuu aika-, 16 sarjan vierivään ja kuuden päälihassarjan päiväkattoon lepoja tai aikapuskuria lyhentämättä.

Alle 10 laskennallisessa viikkosarjassa lisätään enintään yksi sarja päälihasta kohti. Vähintään 10 sarjassa yläraja on pienempi arvoista kaksi sarjaa tai 20 prosenttia nykyisestä volyymista. Päätös käyttää `SET_PROGRESSION_ALLOWED`- tai `SET_PROGRESSION_WITHHELD`-koodia ja muuttaa vain `SETS`-muuttujaa.

## Vierivä seitsemän vuorokauden ikkuna

Viikkorakenne ankkuroituu eksplisiittiseen `weekAnchorDate`-arvoon. Domain ei hae nykyhetkeä `new Date()`- tai `Date.now()`-oletuksella. Kova 16 sarjan katto lasketaan erikseen toteutuneiden harjoitusten vierivästä seitsemän vuorokauden historiasta ja lisätään viikon jo materialisoituun suunniteltuun volyymiin. Sama historiarivi ja sama suunniteltu harjoitus lasketaan kumpikin vain kerran.

Sama täydellinen syöte, ankkuripäivä, moottori-, sisältö- ja politiikkaversio tuottavat tavutasolla saman päätösobjektin.

## Välineprofiilit ja sisältöraja

Nykyinen sisältöjulkaisu auditoidaan BODYWEIGHT_ONLY-, BANDS-, DUMBBELLS-, MACHINES- ja FULL_GYM-profiileilla. Tuettu viikko pyrkii kattamaan polvidominantin, lonkkadominantin, vaakatyönnön, vaakavedon ja keskivartalon hallinnan. Puuttuvaa liikemallia ei korvata kielletyllä tai keksityllä liikkeellä.

`BODYWEIGHT_ONLY`-profiilissa julkaisu ei sisällä turvallista hyväksyttyä vetoliikettä. Tulos on siksi eksplisiittisesti `UNSUPPORTED` ja sisältää `PULL_PATTERN_EQUIPMENT_REQUIRED`-koodin sekä ohjeen:

> Täysi kotivoimaohjelma tarvitsee vetoliikettä varten vähintään pitkän vastuskuminauhan tai muun Haukkarin tukeman välineen.

Tämä on väline- ja sisältöraja, ei terveydellinen STOP. BANDS-, DUMBBELLS-, MACHINES- ja FULL_GYM-profiilit joko kattavat vaakavedon tai palauttavat näkyvän täsmällisen puutteen. Erillinen luonnos rajasta on tiedostossa `Haukkari_voimaharjoittelu_beta-tukisopimus_2026-08-28.md`; se vaatii nimetyn ihmisasiantuntijan hyväksynnän.

## Käyttöliittymä, snapshot ja legacy

Viikkonäkymä näyttää politiikkaversion, toteutuneen ja suunnitellun volyymin, altistusten määrän, liikemallien kattavuuden sekä puuttuvat mallit. Harjoituksen ennakkonäkymä ja suoritus käyttävät saman tallennetun `PlannedSession.prescriptionDetail`-blueprintin. Päivän kuntotarkistus saa turvallisesti keventää, lyhentää tai estää blueprintin, mutta käyttöliittymä näyttää silloin muutoksen syyn.

Harjoituksen valmistuminen päivittää saman viikon aktiivisen `training_plan`-snapshotin todellisesta historiasta muuttamatta viikon versionoitua identiteettiä. Valmis saman viikon prescription poistuu tulevista suunnitelluista harjoituksista, toteutunut volyymi lisätään kerran ja myöhemmän blueprintin annos säilyy. Viikkoankkurin vaihtuessa `TodayPage` valtuuttaa uuden viikon suunnitelman nykyisestä profiilista ja historiasta; mennyttä `plan_versions`-snapshotia tai workout-historiaa ei muuteta. Harjoitussivu virkistää blueprintin progression nykyisestä historiasta vasta päiväkohtaisen adaptaation jälkeen, joten esikatselu, käynnistetty harjoitus ja uudelleenlataus käyttävät samaa rakenteista päätöstä.

Uusi viikko saa uuden deterministisen `planVersionId`- ja `trainingPlanId`-tunnisteen käyttäjän, tavoitejakson, paikallisen maanantaipäivän sekä kalenteri- ja viikkopolitiikkaversioiden perusteella. Uusi `plan_versions`-rivi viittaa edelliseen, käyttää maanantaita `effective_from`-arvona ja syytä `WEEKLY_MATERIALIZATION`. Kahden laitteen sama viikko tuottaa samat UUIDv5-tunnisteet ja saman versionoidun idempotenssiavaimen.

Migraatio `20260828000100_weekly_plan_materialization.sql` tarkistaa ennen indeksien luontia vanhan datan duplikaattiavaimet ja käyttäjäkohtaiset useat aktiiviset suunnitelmat. Ristiriita keskeyttää migraation koodeilla `WEEKLY_MATERIALIZATION_PRECONDITION_DUPLICATE_IDEMPOTENCY_KEY` tai `WEEKLY_MATERIALIZATION_PRECONDITION_MULTIPLE_ACTIVE_PLANS`. Konfliktiryhmien määrä raportoidaan ilman käyttäjätunnisteita, eikä migraatio poista, yhdistä tai arkistoi rivejä automaattisesti.

Palvelimen `materialize_weekly_training_plan`-RPC lukitsee käyttäjän, palauttaa ensimmäisen saman viikon kanonisen payloadin koodilla `EXISTING_CANONICAL_WEEK_RETURNED` ja kirjoittaa `plan_versions`- sekä `training_plans`-rivit yhdessä transaktiossa. Uudempi viikko arkistoi vanhan aktiivisen suunnitelman. Myöhemmin saapuva vanhempi viikko tallentuu arkistoituna eikä syrjäytä uudempaa. Tietokannan osittaiset uniikki-indeksit takaavat yhden ei-tyhjän idempotenssiavaimen ja enintään yhden aktiivisen suunnitelman käyttäjää kohti. Kesken transaktion epäonnistuva uusi viikko säilyttää vanhan aktiivisen suunnitelman. Legacy-plan ilman uusia kenttiä latautuu edelleen eikä vanhaa historiaa kirjoiteta uudelleen.

## Paikallinen kalenteripolitiikka

`local-calendar-1.0.0` on viikonvaihdon ainoa kalenteriauktoriteetti. Profiilin `app_settings` tallentaa aikavyöhykkeen ja politiikkaversion; suomalaisen betan legacy-oletus on `Europe/Helsinki`. `generatedAt`, `calendarTimeZone`, `localDate` ja `weekAnchorDate` välitetään domainille eksplisiittisesti ja ristiriitainen konteksti estetään. Helsingin sunnuntai 30.8.2026 klo 23.30 kuuluu 24.8. alkavaan viikkoon, mutta maanantai 31.8. klo 00.30 aloittaa 31.8. viikon. DST-rajat, virheellinen aikavyöhyke, reload-idempotenssi ja kahden laitteen sama viikko on testattu.

## Ennen ja jälkeen

| Tilanne                  | Ennen                                                | Jälkeen                                                                                            |
| ------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| kaksi voimapäivää        | kaksi samasta historialähtötilasta ratkaistua päivää | aidosti erilainen `FULL_BODY_A/B`, toinen päivä huomioi ensimmäisen suunnitellut sarjat            |
| 10 minuuttia             | irrallinen yksi lyhyt harjoitus                      | viikon A/B-kierto, lämmittely, palautukset ja puskuri säilyvät                                     |
| neljä 20 minuutin päivää | ei yhteistä viikkovolyymin tilaa                     | sequential materialisointi jakaa työn neljälle päivälle ja portittaa jokaisen ajan sekä 16/6-katot |
| pelkkä kehonpaino        | vajaa kokonaisuus saattoi näyttää täydeltä           | `UNSUPPORTED`, tarkka vetopuute, toimintaohje ja linkki välineasetuksiin                           |
| väliin jäänyt A          | irrallisen päivän uudelleenratkaisu                  | jatketaan B:stä, volyymia ei makseta takaisin                                                      |
| laadukas pitkä historia  | ei lihaskohtaista sarjaprogressiota                  | korkeintaan politiikan sallima yksi muuttuja ja näkyvä päätöskoodi                                 |

## Hyväksyntätapausten jäljitettävyys

| Tapaus | Aiempi puute                                                    | Toteutettu sulkeminen                                                                            |
| -----: | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
|      1 | 20 min cold start oli kahden liikkeen näennäinen annos          | `RESOLVED_BY_EXPLICIT_PRODUCT_RESTRICTION`: BODYWEIGHT_ONLY on eksplisiittisesti tukematon       |
|      2 | viikkopäivien järjestys ja lihasmassavolyymin ramppi puuttuivat | versionoitu blueprint, sequential volume ja tavoite-/jäännösvolyymi                              |
|      5 | kolmen päivän pääliikekierto puuttui                            | `FULL_BODY_A/B/C` ja kiertävät liikemallipainotukset                                             |
|      6 | neljän päivän ylä-/alajako puuttui                              | `UPPER_A/LOWER_A/UPPER_B/LOWER_B`, vain active intermediate/advanced                             |
|     10 | 10 min A/B-kierto puuttui                                       | `RESOLVED_BY_EXPLICIT_PRODUCT_RESTRICTION`: BODYWEIGHT_ONLY on eksplisiittisesti tukematon       |
|     11 | 8–12 sarjan tavoitetta ei jaettu neljälle 20 min päivälle       | päivittäinen aikaportitus ja edellisten päivien suunnitellun volyymin syöttäminen seuraavalle    |
|     12 | 30 min kehonpainoprofiili naamioi kattavuuspuutteen             | `RESOLVED_BY_EXPLICIT_PRODUCT_RESTRICTION`: BODYWEIGHT_ONLY palauttaa `UNSUPPORTED`-vetopuutteen |
|     14 | 3/4 päivän beta-katto puuttui                                   | beginner/RETURNING ≤3, active intermediate/advanced ≤4                                           |
|     22 | lihaskohtainen +1 sarja/vko puuttui                             | laatuehdot, kaksi vertailuikkunaa, +1 tai min(2, 20 %) ja yhden muuttujan sääntö                 |

## Deterministinen 50 000 tapauksen auditointi

`npm run audit:p1-week` yhdistää tavoitteet, kokemustasot, ACTIVE/RETURNING-tilat, iät 17/18/64/65, GREEN/YELLOW/ORANGE_RECOVERY/RED_STOP-readinessit, healthBlocked- ja turvallisuustietotilat, 1–5 päivää, 10/20/30/45/60/90 minuutin budjetit, viisi välineprofiilia, neljä historiatilaa sekä progression sallivia ja estäviä palautumistiloja. Auditointi käyttää varsinaista `generatePlan`-tuotantoreittiä ja portittaa jokaisen syntyneen harjoituksen sen jälkeen julkisella `adaptPrescription`-reitillä nykyiseen turvallisuuskontekstiin.

| Tulos                |  Määrä |
| -------------------- | -----: |
| arvioituja tapauksia | 50 000 |
| `SUPPORTED`          | 19 031 |
| `PARTIAL`            | 16 074 |
| `UNSUPPORTED`        | 14 895 |
| invarianttirikkeitä  |      0 |

`NO_SAFE_STRENGTH_DOSE_AVAILABLE` esiintyi 15 076 lapsiharjoituksessa ja 6 513 tapauksessa. `PULL_PATTERN_EQUIPMENT_REQUIRED` muodosti kaikki 10 005 BODYWEIGHT_ONLY-tapausta tukemattomiksi. Tavallisen beta-kohderyhmän erillisessä otoksessa oli 300 tapausta: 300 `SUPPORTED`, 0 `PARTIAL` ja 0 `UNSUPPORTED`.

Auditointi sovitti 70 734 syntynyttä prescriptionia todelliseen turvallisuuskontekstiin. Sallittuja voimaharjoitusprescriptioneja oli 4 901 ja odottamattomia estotuloksia 0. Odotetut estot jakaantuivat: health 35 369, RED_STOP 8 822, puutteelliset turvallisuustiedot 13 313, alle 18 vuotta 2 792, vähintään 65 vuotta 3 069 ja ORANGE_RECOVERY 2 468 palauttavaan reittiin. Jokaisesta tuetusta iästä, tavoitteesta, kokemustasosta, GREEN/YELLOW-readinessista ja välineluokasta syntyi vähintään yksi oikea voimaharjoitusprescription. Auditointi ei siten voi läpäistä estämällä tai suodattamalla kaikki tapaukset.

Invariantit kattavat päiväbudjetin, 16/6-sarjakatot, frekvenssin, tyhjän supported-viikon eston, unsupported-lapsen estämisen supported-viikossa, näkyvän liikemallipuutteen, TIME_LIMITED-evidenssin, planned/completed-kaksoislaskennan, väliin jääneen volyymin, yhden progressiomuuttujan, paikallisen viikkoankkurin, viikon deterministiset tunnisteet ja päätöksen determinismin. Tapausten 2, 5, 6, 11, 14 ja 22 tulos on PASS. Tapausten 1, 10 ja 12 tulos on `RESOLVED_BY_EXPLICIT_PRODUCT_RESTRICTION`, ei PASS.

Selain-E2E ajaa 10 minuutin A/B-viikon, kolmen päivän A/B/C-kierron, neljän päivän upper/lower-viikon, BODYWEIGHT_ONLY-välinerajan sekä blueprintin ja toteuman jatkuvuuden Android/Chromium-, iPhone/WebKit- ja desktop/Chromium-projekteissa ilman uusia matriisiohituksia. Lisäksi oikea käyttöliittymäpolku tallentaa kaksi eri harjoitusta, pyytää seuraavan käytettävissä olevan kuorman, vahvistaa 20 → 21 kg:n portaan ja osoittaa seuraavan viikon aktiivisessa liikkeessä sekä uudelleenlatauksessa 21 kg:n esitäytön.

## Avoimet kohdat

- BODYWEIGHT_ONLY tarvitsee myöhempään sisältöjulkaisuun erikseen arvioidun turvallisen vetoliikkeen. Nykyiseen `adult-resistance-v1.0.0`-julkaisuun ei lisätty liikkeitä.
- Joissakin MACHINE-profiilin neljännen päivän yhdistelmissä kanoninen aika- ja volyymiportti ei löydä turvallista annosta. Sovellus näyttää tällöin täsmällisen `NO_SAFE_STRENGTH_DOSE_AVAILABLE`-rajan sen sijaan, että palauttaisi vajaan tai katot ylittävän ohjelman.
- Ulkopuolisen voimaharjoituksen lihas- ja sarjadata tarvitsee myöhemmin rakenteisen syötön, jotta se voidaan laskea volyymiin; siihen asti sarjaprogressio pidätetään.
- Hyväksyntäraportin DOMS-kohta 30 säilyy P2-tasolla: nykyinen `soreness`-malli ei ilmaise lievää DOMS-arvoa 2/10 tarkkuudella.
- Hyväksyntäraportin voimakasta DOMSia koskeva kohta 31 säilyy avoimena P1:nä: tämän työpaketin ulkopuolella on edelleen toteutettava toimintakyvyn selvään heikentymiseen perustuva 40–50 prosentin kevennys tai palauttava vaihtoehto. Tässä työssä ei aloitettu DOMS-toteutusta.
- Viikkotavoitteita ja progressiorajoja verrataan myöhemmin vaihe 0:n toteutuneisiin sarjoihin, kestoihin, RIR-arvioihin ja palautteeseen. Politiikkaa muutetaan silloin uutena versiona, ei kirjoittamalla vanhoja snapshotteja uudelleen.

Alkuperäistä hyväksyntäraporttia tai sen hyväksymisehtoja ei muutettu. Tässä työssä ei aloitettu vaihetta 0 eikä muutettu sisältöjulkaisua.
