# Haukkari – aikuisten voimaharjoittelun P1 RETURNING- ja taukosäännöt 2026-08-27

## 1. Rajaus ja baseline

Työpaketti toteuttaa vain aikuisten voimaharjoittelun tauolta paluun. Tarkastettu
baseline on haara `codex/training-engine-v2`, commit
`a7aee5b821ba2fbe709b2fc2f1d1c0c98a347a2b`.

Politiikkaversio on `adult-strength-return-1.0.0`. `ExperienceLevel` säilyy
ennallaan (`BEGINNER`, `INTERMEDIATE`, `ADVANCED`); tauolta paluu on siitä
erillinen väliaikainen `StrengthReturnState`. Sisältöjulkaisua
`adult-resistance-v1.0.0` ja alkuperäistä hyväksyntäraporttia ei muutettu.

Tämä raportti on jälkikäteinen sulkemisraportti tapauksille 3 ja 25–28. Se ei
kirjoita uudelleen alkuperäisen hyväksyntäraportin havaintoja tai hyväksymisehtoja.

## 2. Tietolähde ja tauon laskenta

Domain saa `generatedAt`-ajan eksplisiittisesti. Se ei käytä sisäistä nykyhetken
oletusta. Historia ryhmitellään `WorkoutRecord`-tunnisteella (`sessionId`), joten
saman harjoituksen useat sarjat muodostavat yhden harjoituskerran.

Tauko lasketaan viimeisen todellisen voimaharjoituksen aikaleimasta seuraavaan
harjoitukseen tai eksplisiittiseen `generatedAt`-hetkeen. Virheelliset ja
tulevaisuudessa olevat aikaleimat sekä ilman `sessionId`-tunnistetta olevat
legacy-rivit jätetään pois taukolaskennasta. Vanhalle riville ei keksitä
harjoituskertaa.

Tietolähteiden luotettavuusjärjestys on:

1. `APP_HISTORY`: vähintään kahdeksan laadukkaasti valmistunutta, eri
   WorkoutRecordiin tallennettua voimaharjoitusta vähintään 84 kokonaisen
   24 tunnin vuorokauden aikajänteellä;
2. `USER_CONFIRMED`: käyttäjä vahvistaa vähintään 12 viikon aiemman säännöllisen
   harjoittelun ja viimeisen voimaharjoituksen päivän; mukana tallennetaan
   vahvistusaika ja politiikkaversio;
3. `NONE`: puuttuva, tulevaisuuteen sijoittuva, ristiriitainen tai väärän
   politiikkaversion tieto johtaa `NOVICE_COLD_START`-kalibrointiin, ei
   harjoittelun estoon eikä `RETURNING`-oletukseen.

Rakenteinen käyttäjävahvistus tallennetaan profiilin nykyiseen
`app_settings`-JSON-snapshotiin. SQL-migraatiota tai vanhan historian
uudelleenkirjoitusta ei tarvita. Profiilin JSON kulkee nykyisen käyttäjäkohtaisen
offline- ja synkronointireitin läpi.

Kahdeksan harjoitusta ja vähintään 84 kokonaisen vuorokauden aikajänne ovat
versionoidun `INTERNAL_BETA`-tuotepolitiikan konservatiivisia oletuksia. Ne eivät
ole lääketieteellisesti todistettuja yksilöllisiä rajoja.

## 3. Päivärajat ja paluuepisodin säilyminen

| Tauko               | Päätös                       | Säilyminen                                                        |
| ------------------- | ---------------------------- | ----------------------------------------------------------------- |
| 0–7 päivää          | `ACTIVE`                     | ei taukosovitusta                                                 |
| 8–14 päivää         | `BREAK_8_TO_14_DAYS`         | seitsemän päivää ensimmäisestä valmistuneesta paluuharjoituksesta |
| 15–27 päivää        | `BREAK_15_TO_27_DAYS`        | seitsemän päivää ensimmäisestä valmistuneesta paluuharjoituksesta |
| 28–55 päivää        | `RETURN_BLOCK_28_TO_55_DAYS` | 14 päivää ensimmäisestä valmistuneesta paluuharjoituksesta        |
| vähintään 56 päivää | `RETURNING_56_PLUS_DAYS`     | hyväksyttyjen paluuharjoitusten määrään asti                      |

Tarkat 7/8/14/15/27/28/55/56 päivän rajat ja 70 päivän eli 10 viikon tapaus on
lukittu regressiotesteihin. Paluublokin aloitus johdetaan ensimmäisestä
`COMPLETED`-paluuharjoituksesta, ei suunnitelman luontiajasta. Päätös säilyy
sivun uudelleenlatauksessa, koska se johdetaan samoista synkronoitavista
WorkoutRecord- ja profiilisnapshoteista.

## 4. Annostus ja pyöristys

Normaali prescription sovitetaan ensin kanoniseen aikabudjettiin. Taukosovitus
lasketaan tästä toteuttamiskelpoisesta perusannoksesta ja sovitetaan sen jälkeen
uudelleen samalla `TimeBudgetPolicy`-versiolla.

Paluusovituksen alkuperäisen absoluuttisen aikapuskurin säilytys muuttaa
laskentasemantiikkaa hyväksytysti. Siksi uudet prescriptionit käyttävät versiota
`adult-strength-time-1.1.0`. Työ- ja kalibrointisarjojen ajat, palautukset,
liikesiirtymät, välinevalmistelut, lämmittely, loppuverryttely, 30 sekunnin / 10
prosentin normaalipuskuri, sarjojen poistamisjärjestys ja näkyvän keston pyöristys
ovat samat kuin versiossa `1.0.0`. Toteutunutta `1.0.0`-snapshotia tai sen
käyttäjälle aiemmin näytettyä kestoa ei kirjoiteta uudelleen.

- 8–14 päivää: `floor(perusannoksen työsarjat × 0,75)`;
- 15–27 päivää: `floor(perusannoksen työsarjat × 0,65)` ja tavoite-RIR kasvaa
  yhdellä, kuitenkin enintään arvoon 4;
- 28–55 ja 56+ päivää: 1–2 työsarjaa liikettä kohden, RIR 3–4 ja toistoalueen
  alaraja vähintään kuusi.

Sarjoja poistetaan deterministisesti ensin apuliikkeistä ja vasta sen jälkeen
pääliikkeiden ylimääräisistä sarjoista. Jokaiselle säilyvälle pääliikkeelle jää
vähintään yksi työsarja. Lepoaikoja, lämmittelyä tai alkuperäisen kanonisen
aikamallin puskuria ei lyhennetä. 16 sarjan lihaskohtainen viikkokatto suoritetaan
ennen taukosovitusta; taukosovitus voi vain vähentää jo katettua määrää.

### Ennen/jälkeen-esimerkki

Jos kanoniseen 45 minuutin aikabudjettiin sovitettu normaali harjoitus sisältää
13 työsarjaa:

- 8–14 päivän tauon jälkeen tavoite on `floor(13 × 0,75) = 9` sarjaa;
- 15–27 päivän tauon jälkeen tavoite on `floor(13 × 0,65) = 8` sarjaa;
- 28+ päivän paluublokissa jokainen säilyvä liike rajataan 1–2 sarjaan.

## 5. Kuormien fail-closed-käyttäytyminen

8–14 päivän jaksolla sekä toisto- että kuormaprogressio jäädytetään. Vahvistettu
`VerifiedNextLoad` ei valtuuta nousua paluujakson aikana.

15 päivän tauosta alkaen ennen taukoa tallennettu kuorma ei ole tämän päivän
automaattinen suositus. Käyttöliittymän sanamuoto on:

> Aiempi kuorma – ei tämän harjoituksen automaattinen suositus.

Jos todellista alempaa välineporrasta ei tunneta, kilogrammamäärää ei vähennetä
laskennallisella prosentilla. Käyttäjää ohjataan kalibroimaan kuorma tavoite-RIR:n
avulla, eikä vanhaa kuormaa esitäytetä aktiivisen harjoituksen kenttään.

56+ päivän tauossa `historyAuthorityCutoffAt` katkaisee vanhan capability- ja
kuormahistorian auktoriteetin. Sama liikeversio ja kuormakonteksti tarvitsee kaksi
uutta hyväksyttyä, eri WorkoutRecordiin perustuvaa kalibrointia. Kahden uuden
kalibroinnin jälkeen liikekohtainen capability voidaan muodostaa uudelleen, mutta
kokonaispaluujakson progressio pysyy jäädytettynä. Paluun jälkeinen kuormannosto
vaatii lisäksi uuden, uuden näyttöjakson jälkeen vahvistetun `VerifiedNextLoad`-
tiedon; vanha vahvistus ei valtuuta nousua.

Katkaisuraja säilyy myös sen jälkeen, kun vaaditut neljä tai kuusi hyväksyttyä
paluuharjoitusta palauttavat tilan arvoon `ACTIVE`. Vanha historia säilyy
näytettävänä, mutta capability- ja progressiolaskenta käyttää vain katkaisurajan
jälkeistä hyväksyttyä historiaa. Tarkka kuormaprogressio edellyttää kahta uutta
liikekohtaista kalibrointiharjoitusta ja paluun jälkeen vahvistettua
`VerifiedNextLoad`-tietoa.

## 6. RETURNING-tilaan tulo ja siitä poistuminen

56+ päivän `RETURNING` aktivoituu vain, kun 12 viikon aiempi säännöllinen
harjoittelu on osoitettavissa luotettavasta sovellushistoriasta tai käyttäjä on
vahvistanut sen rakenteisesti. Yksittäinen vanha harjoitus ei riitä.

Hyväksytty paluuharjoitus edellyttää yhtä eri WorkoutRecord-tunnistetta,
`COMPLETED`-tilaa, koko määrätyn annoksen valmistumista, kivutonta suoritusta,
hyväksyttyä tekniikkaa, ei STOP-tilaa, toteutunutta määrättyä RIR-aluetta sekä ei
vakavaa palautumisongelmaa. Vakavaksi palautumisongelmaksi tulkitaan tässä
versionoidussa `INTERNAL_BETA`-tuotepolitiikassa `difficulty=TOO_HARD`,
`felt=WORSE` tai `sessionRpe>=9`. Nämä ovat konservatiivisia tuoteoletuksia,
eivät lääketieteellisesti todistettuja rajoja.

- Luotettava `APP_HISTORY`: poistuminen neljän hyväksytyn paluuharjoituksen jälkeen.
- Vain `USER_CONFIRMED`: poistuminen kuuden hyväksytyn paluuharjoituksen jälkeen.

Kipu, tekniikkavirhe, vajaa annos, väärä RIR, vakava palautumisongelma tai
keskeytys eivät kasvata laskuria. Ajan kuluminen yksin ei poista 56+ päivän
`RETURNING`-tilaa. Poistuminen ei muuta käyttäjän `ExperienceLevel`-arvoa eikä
ylennä käyttäjää automaattisesti.

## 7. Tuotantopolku ja päätösloki

Toteutettu kutsuketju on:

`WorkoutHistory → ReturnToStrengthPolicy → coachingActions → PlanGenerator → resolvePrescription → AdultResistanceEngine → TimeBudgetPolicy → WorkoutPage → tallennettu decision trace`

`WorkoutHistory` muodostaa historian tallennetuista palautteista, RIR-tavoitteista
ja WorkoutRecord-tunnisteista. `coachingActions` välittää historian myös
uudelleensuunnitteluun; aktiivinen `WorkoutPage` käyttää samaa keskitettyä
`resolvePrescription`-reittiä. Lopullinen `strengthReturn`-snapshot, reason codet,
alkuperäinen/muutettu annos ja aikamalli tallennetaan workoutiin sekä workout-login
decision traceen.

Käyttöliittymä näyttää tauon pituuden, jakson arvioidun keston, kevennyksen syyn,
hyväksyttyjen paluuharjoitusten laskurin ja kuormaprogression palautumisehdon.
Tekstit ovat informatiivisia eivätkä muuta nykyistä visuaalista rakennetta.

## 8. Reason codet

- `BREAK_8_TO_14_DAYS`
- `FIRST_RETURN_WEEK`
- `WORKING_SETS_REDUCED_25_PERCENT`
- `BREAK_15_TO_27_DAYS`
- `WORKING_SETS_REDUCED_35_PERCENT`
- `TARGET_RIR_INCREASED`
- `PREVIOUS_LOAD_REFERENCE_ONLY`
- `LOAD_RECALIBRATION_REQUIRED`
- `PROGRESSION_SUPPRESSED_DURING_REENTRY`
- `RETURN_BLOCK_28_TO_55_DAYS`
- `TWO_WEEK_REENTRY_BLOCK`
- `SETS_CAPPED_AT_TWO`
- `RIR_CONSERVATIVE`
- `HEAVY_REPETITION_RANGE_WITHHELD`
- `OLD_LOAD_REFERENCE_ONLY`
- `RETURNING_56_PLUS_DAYS`
- `BREAK_REENTRY`
- `OLD_LOAD_HISTORY_DISPLAY_ONLY`
- `TWO_POST_BREAK_CALIBRATIONS_REQUIRED`
- `PRE_BREAK_LOAD_AUTHORITY_REVOKED`
- `STRENGTH_CONTINUITY_NOT_CONFIRMED`
- `NOVICE_COLD_START`
- `RETURN_REENTRY_COMPLETED`
- `APP_HISTORY_CONTINUITY_CONFIRMED`
- `APP_HISTORY_EIGHT_SESSIONS_CONFIRMED`
- `APP_HISTORY_EIGHTY_FOUR_DAY_SPAN_CONFIRMED`
- `PRIOR_TRAINING_SOURCE_APP_HISTORY`
- `PRIOR_TRAINING_SOURCE_USER_CONFIRMED`
- `RETURN_SESSION_ACCEPTED`
- `RETURN_SESSION_REJECTED_PAIN`
- `RETURN_SESSION_REJECTED_STOP`
- `RETURN_SESSION_REJECTED_INCOMPLETE_DOSE`
- `RETURN_SESSION_REJECTED_RIR_OUTSIDE_TARGET`
- `RETURN_SESSION_REJECTED_TECHNIQUE`
- `RETURN_SESSION_REJECTED_DIFFICULTY_TOO_HARD`
- `RETURN_SESSION_REJECTED_FELT_WORSE`
- `RETURN_SESSION_REJECTED_RPE_NINE_OR_MORE`
- `RETURN_SESSION_REJECTED_SEVERE_RECOVERY_PROBLEM` (legacy-yhteensopivuus)

## 9. Testit ja auditointijakauma

Uusi `npm run audit:p1-return` ajaa kolme kohdennettua testitiedostoa ja
deterministisen ominaisuusauditin. Kohdennettu ajo sisältää 44 testiä.

Ominaisuusauditin 432 tapausta jakautuvat näin:

| Tila                         | Tuettuja prescriptioneja |
| ---------------------------- | -----------------------: |
| `BREAK_8_TO_14_DAYS`         |                      108 |
| `BREAK_15_TO_27_DAYS`        |                      108 |
| `RETURN_BLOCK_28_TO_55_DAYS` |                      108 |
| `RETURNING_56_PLUS_DAYS`     |                      108 |

Matriisi kattaa kolme kokemustasoa, kolme tavoitetta, kehonpaino-, koti- ja
kuntosalivälineprofiilit, 20/30/45/60 minuutin aikabudjetit sekä 8/15/28/70 päivän
tauot. Tulos: 432/432 tuettua prescriptionia, 0 aikabudjettirikettä, 0
progressiorikettä, 0 konservatiivisen annoksen rikettä ja 0 auditointivirhettä.

Negatiiviset kontrollit osoittavat, etteivät puuttuva historia, tunnisteeton
legacy-rivi tai tulevaisuuden aikaleima tuota perusteetonta `RETURNING`-tilaa.
Integraatiotesti osoittaa versionoidun taustatiedon säilyvän kahden laitteen
synkronoinnissa. Sovellus-E2E kulkee onboardingista coachingActions- ja
PlanGenerator-reitin kautta päivän voimaharjoitukseen ja tarkistaa päätöksen
säilymisen sivun uudelleenlatauksessa.

## 10. Yhteys alkuperäisiin hyväksyntätapauksiin

| Tapaus | Sulkeva regressio                                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 3      | 70 päivän/10 viikon tauko, säännöllisen taustan vaatimus, 1–2 sarjaa, RIR 3–4, kuusi käyttäjävahvistukseen perustuvaa hyväksyttyä paluuta  |
| 25     | 8/14 päivän rajat, 25 % sarjavähennys ja progression jäädytys                                                                              |
| 26     | 15/27 päivän rajat, 35 % sarjavähennys, RIR +1 ja kuorman uudelleenkalibrointi                                                             |
| 27     | 28/55 päivän rajat, kahden viikon paluublokki, 1–2 sarjaa ja vähintään kuuden toiston alue                                                 |
| 28     | 56 päivän raja, vanhan kuorma-auktoriteetin katkaisu, kaksi uutta liikekohtaista kalibrointia ja 4/6 hyväksytyn harjoituksen poistumisehto |

## 11. Avoimet P1/P2-kohdat ja riskit

Tämä työ ei sulje muita alkuperäisen auditin kohtia. Avoimiksi jäävät muun muassa
viikkopäivien hypertrofiajako ja liikejärjestys (2), kolmen päivän pääliikekierto
(5), neljän päivän ylä-/alavartalojako (6), 10 minuutin A/B-kierto (10), lyhyiden
harjoitusten viikkovolyymin jako (11), kehonpainoprofiilin kattavuus (12),
beta-frekvenssikatto (14), lihaskohtainen +1 sarja/vko -progressio (22), voimakkaan
DOMS:n tarkempi kevennys (31) sekä P2-tason DOMS-syötteen tarkkuus (30).

Tuotepolitiikan 84 päivän ja kahdeksan harjoituskerran sovellushistoriakynnys sekä
vakavan palautumisongelman määritelmä ovat konservatiivisia, versionoituja
tuoteoletuksia. Niitä ei esitetä tutkimuksesta suoraan johdettuina yksilöllisinä
totuuksina. Ne on arvioitava uudelleen asiantuntijakatselmuksessa ja myöhemmässä
valvotussa vaiheessa 0 ennen laajempaa beta-käyttöä. Vaihetta 0 ei aloitettu tässä
työssä.

## 12. Lopulliset paikalliset portit

- `git diff --check`: PASS;
- `npm run check`: PASS, sisältäen 251 yksikkötestiä, 9 integraatiotestiä,
  sisältö-, lint-, Prettier-, TypeScript-, aika-, P0-, P1-return-, tietosuoja-,
  build- ja PWA-portit;
- `npm run audit:p0`: PASS, 50 000 tapausta, 21 839 sallittua prescriptionia,
  0 odottamatonta estoa ja 0 rikettä;
- `npm run audit:p1-strength`: PASS, 14/14 auditointitapausta;
- `npm run audit:p1-return`: PASS, 432/432 tuettua ominaisuustapausta ja 0
  rikettä;
- `npm run e2e`: PASS, 6/6;
- `npm run e2e:app`: PASS, 14/14 ajettua tapausta ja 10 ennestään dokumentoitua
  projektimatriisin ohitusta. RETURNING-käyttäjäpolku läpäisi `android-small`-,
  `iphone-small`- ja `desktop-keyboard`-projektit ilman ohituksia.
