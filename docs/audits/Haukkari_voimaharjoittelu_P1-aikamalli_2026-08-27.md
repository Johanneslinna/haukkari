# Haukkari – aikuisten voimaharjoittelun P1-aikamalli 2026-08-27

## 1. Rajaus ja baseline

Tämä raportti dokumentoi aikuisten voimaharjoittelun sekä siitä johdettujen
`LIGHT`- ja `COMPACT`-versioiden kanonisen aikamallin. Tarkastettu baseline on
`41eb354842d93302b388b6217902984e802d9404` haarassa
`codex/training-engine-v2`.

Normatiivinen hyväksyntäraportti
`docs/audits/Haukkari_voimaharjoittelu_hyvaksyntaraportti_2026-08-27.md` ja sen
hyväksymisehdot säilyvät muuttamattomina. Tämä työ sulkee vain yhteistä
aikamallia koskevan P1-aukon. Se ei sulje muita P1- tai P2-tapauksia eikä muuta
muiden harjoitusmuotojen annostelua.

## 2. Juurisyy ja vanhat rinnakkaiset laskentareitit

Baseline-versiossa aikuisten voimaharjoituksen aika muodostui useassa eri
paikassa:

1. `AdultResistanceEngine` sovitti sisältöä lämpö-, työ-, sarjapalautus- ja
   jäähdyttelyajan perusteella. Siirtymät, välineiden säädöt, liikekohtainen
   kalibrointi ja käytännön puskuri puuttuivat.
2. `PrescriptionContract.prescriptionDurationSeconds()` ja `withV2Blocks()`
   laskivat näkyvän keston erillisellä kaavalla.
3. `TrainingPrescriptionEngine` käytti LIGHT- ja COMPACT-versioille yleistä
   annoksen sekuntisovitusta, joka ei tuntenut voimaharjoituksen kaikkia
   aikaosia.
4. Lopuksi `AdultResistanceEngine` saattoi leikata näkyvän
   `durationMinutes`-arvon `Math.min()`-operaatiolla aikabudjettiin. Sisältöä ei
   samalla sovitettu uudelleen.
5. `PlanGenerator` ja harjoitusnäkymä käsittelivät variantin tavoitekestoa
   näkyvänä kestona ennen kuin varsinainen voimaharjoitus oli materialisoitu.

Seurauksena eri reitit saattoivat olla keskenään sisäisesti johdonmukaisia,
mutta käyttäjälle näytetty aika ei kattanut kaikkea prescriptionissa määrättyä
tekemistä. Aikabudjetti oli ajoittain vain näkyvän kentän yläraja eikä
harjoitussisällön ehdoton rajoite.

## 3. Kanoninen politiikka ja API

Uusi politiikkaversio on `adult-strength-time-1.0.0`. Yksi domain-moduuli
tarjoaa seuraavat julkiset operaatiot:

- `estimatePrescriptionTime(prescription, policy)` muodostaa auditoitavan
  aikaerittelyn;
- `fitStrengthPrescriptionToTimeBudget(...)` sovittaa annoksen
  deterministisesti ehdottomaan budjettiin;
- `refreshStrengthPrescriptionTimeEstimate(...)` päivittää sisältömuutoksen
  jälkeisen snapshotin;
- `auditStrengthPrescriptionTime(...)` tarkistaa sopimus- ja aikainvariantit.

Uuden voimaharjoitus-prescriptionin sopimuksessa ovat:

- `timeBudgetMinutes`;
- `calculatedTotalSeconds`;
- `timePolicyVersion`;
- `timeBreakdown`;
- `timeAdjustmentReasonCodes`.

`timeBreakdown` sisältää yleislämmittelyn, liikekohtaiset
lämmittely-/kalibrointisarjat, työsarjat, sarjapalautukset, liikesiirtymät,
välineiden säädöt, loppuverryttelyn, puskurin ja kokonaisajan sekunteina.
`durationMinutes` on aina `ceil(totalSeconds / 60)` eikä erillinen arvio.

## 4. Politiikan täsmälliset oletukset

| Osa                                                |         `adult-strength-time-1.0.0` |
| -------------------------------------------------- | ----------------------------------: |
| Työsarja                                           |                                60 s |
| Liikekohtainen lämmittely-/kalibrointisarja        |                                45 s |
| Palautuminen kalibrointisarjan jälkeen             |                                45 s |
| Liikkeiden välinen siirtymä                        |                                25 s |
| Aikamallin sallima pienin usean työsarjan palautus |                                60 s |
| Ulkoisen kuorman ensimmäinen säätö                 |                                60 s |
| Käsipainojen ensimmäinen säätö                     |                                45 s |
| Laitteen ensimmäinen säätö                         |                                45 s |
| Vastuskuminauhan ensimmäinen säätö                 |                                30 s |
| Kehonpaino-/taso-liikkeen valmistelu               |                                20 s |
| Ilman välinettä tehtävän liikkeen valmistelu       |                                15 s |
| Käytännön puskuri                                  | `max(30 s, ceil(välisumma × 10 %))` |

Yleislämmittelyn ajat budjeteille 10/20/30/45/60/90 minuuttia ovat
2/3/4/5/6/8 minuuttia. Loppuverryttelyn ajat ovat vastaavasti
1/1/1,5/2/3/4 minuuttia.

Sarjapalautus lasketaan vain saman liikkeen peräkkäisten työsarjojen väliin.
Viimeisen työsarjan jälkeen ei lisätä sarjapalautusta. Seuraavaan liikkeeseen
siirtyminen ja sen välinevalmistelu lasketaan erillisinä, joten samaa aikaa ei
lasketa kahdesti. Prescriptionin alkuperäisiä palautusaikoja ei lyhennetä
aikabudjetin vuoksi.

90 minuutin budjetti on enimmäisaika eikä täyttötavoite. Politiikka ei lisää
sarjoja tai liikkeitä vain ajan kuluttamiseksi.

Sarja-, siirtymä-, väline-, kalibrointi- ja puskuriajat ovat konservatiivisia,
versionoituja tuoteoletuksia. Ne eivät ole väite jokaisen käyttäjän
todellisesta suoritusajasta. Oletuksia verrataan myöhemmin vaihe 0:ssa
toteutuneisiin harjoitusaikoihin. Politiikkaa muutetaan toteutuneen datan tai
asiantuntija-arvion sitä edellyttäessä vain uutena politiikkaversiona, jotta
aiemmat prescription-snapshotit ja päätökset säilyvät jäljitettävinä.

## 5. Deterministinen sovitusjärjestys

Sovitin toimii aina samassa järjestyksessä:

1. säilytä budjettikohtainen yleislämmittely ja loppuverryttely;
2. säilytä valintamoottorin avainliikkeet ja tärkeimmät liikerakenteet;
3. säilytä määrätyt sarjapalautukset, tavoite-RIR ja vähintään 10 prosentin
   puskuri;
4. poista pienimmän prioriteetin apuliike;
5. vähennä pienimmän prioriteetin apuliikkeen sarja;
6. vähennä vasta tämän jälkeen pääliikkeen ylimääräinen sarja;
7. palauta `NO_SAFE_STRENGTH_DOSE_AVAILABLE`, jos vähimmäisannos ei mahdu.

Muutokset tallentuvat koodeilla `TIME_ACCESSORY_REMOVED`,
`TIME_ACCESSORY_SET_REDUCED`, `TIME_MAIN_SET_REDUCED`,
`TIME_COMPACT_VARIANT`, `TIME_LEGACY_REAUTHORIZED` ja
`TIME_MINIMUM_SAFE_DOSE_UNAVAILABLE`.

## 6. Ennen ja jälkeen

Vertailuprofiili on 35-vuotias `INTERMEDIATE`, `GREEN`,
`GENERAL_FITNESS`, koko salin välineprofiili ja normaali arjen fyysinen kuorma.
Baseline-luvut ajettiin suoraan commitin `41eb3548` julkisesta
`resolvePrescription()`-reitistä. “Baseline täydellä mallilla” arvioi saman
vanhan rakenteen uuden politiikan kaikilla aikaosilla ennen sovitusta.

| Budjetti | Baseline näkyvä / vanha laskuri | Baseline täydellä mallilla | Uusi todellinen / näkyvä |          Uusi rakenne |
| -------: | ------------------------------: | -------------------------: | -----------------------: | --------------------: |
|   10 min |                  10:00 / 10 min |                      13:45 |             8:21 / 9 min |  2 liikettä, 2 sarjaa |
|   20 min |                  15:00 / 15 min |                      20:21 |           18:09 / 19 min |  3 liikettä, 5 sarjaa |
|   30 min |                  29:00 / 29 min |                      33:50 |           28:20 / 29 min |  4 liikettä, 8 sarjaa |
|   45 min |                  40:00 / 40 min |                      48:24 |           42:54 / 43 min | 5 liikettä, 13 sarjaa |
|   60 min |                  40:00 / 40 min |                      50:36 |           50:36 / 51 min | 5 liikettä, 15 sarjaa |
|   90 min |                  40:00 / 40 min |                      53:54 |           53:54 / 54 min | 5 liikettä, 15 sarjaa |

Uudessa tuloksessa näkyvä kesto voi olla baselinea pidempi, koska se sisältää
nyt aiemmin puuttuneet siirtymät, säädöt, kalibroinnin ja puskurin. Se ei silti
ylitä budjettia. Lyhyissä harjoituksissa sisältöä vähennetään todellisuudessa;
60 ja 90 minuutin esimerkeissä sisältö mahtuu ilman keinotekoista täyttöä.

## 7. LIGHT-, COMPACT-, suunnittelu- ja suorituspolut

- FULL, LIGHT, COMPACT_10, COMPACT_20 ja COMPACT_30 käyttävät samaa
  `fitStrengthPrescriptionToTimeBudget()`-operaatiota.
- LIGHT vähentää sarjamäärää ja keventää tavoitetta, mutta ei lyhennä lepoja.
- COMPACT säilyttää avainliikkeet ensin ja lisää
  `TIME_COMPACT_VARIANT`-syyn.
- `PlanGenerator` materialisoi voimaharjoituksen ja sen variantit ennen kuin
  tallentaa näkyvät kestot.
- Harjoitusnäkymä näyttää materialisoitujen varianttien todelliset kestot.
- Sarjapalautteen aiheuttama sisältömuutos lasketaan uudelleen kanonisella
  politiikalla.
- Korvaava liike lasketaan uudelleen. Budjetin ylittävä vaihto estetään ilman
  lepojen pakkaamista.

Muiden harjoitusmuotojen nykyiset annos- ja aikareitit säilyvät tämän rajatun
työpaketin ulkopuolella.

## 8. Legacy- ja tietomallivaikutukset

Tietokantamigraatiota ei tarvita. Uudet aikakentät tallentuvat olemassa olevaan
versionoituun prescriptionin JSON-snapshotiin.

Vanhan toteutuneen harjoituksen aiemmin käyttäjälle näytettyä
`durationMinutes`-arvoa ei kirjoiteta uudelleen. `normalizePrescriptionV2()`
säilyttää historian keston eikä liitä legacy-snapshotiin jälkikäteen
näennäisen tarkkaa aikajakaumaa.

Kun legacy-snapshotista tehdään uusi suoritettava mukautus tai sitä jatketaan,
se valtuutetaan ensin nykyisillä ikä-, readiness- ja terveystiedoilla ja
sovitetaan sitten `adult-strength-time-1.0.0`-politiikalla. Puuttuva tai
ei-numeerinen sarja-/palautustieto, väärä annostyyppi tai puuttuva kuormayksikkö
estää suorituksen koodilla `NO_SAFE_STRENGTH_DOSE_AVAILABLE`. Oletusarvolla ei
luoda valheellisen tarkkaa kestoa.

## 9. Dynaaminen regressio- ja ominaisuustestaus

`audit:time` käy deterministisesti läpi 2 700 yhdistelmää:

- kuusi aikabudjettia;
- kolme kokemustasoa;
- kolme tavoitetta;
- GREEN ja YELLOW;
- viisi välineprofiilia;
- viisi varianttia.

Lisäksi aikainvariantit on yhdistetty olemassa olevaan 50 000 tapauksen
`audit:p0`-ajoon, jotta samaa tapausjoukkoa ei generoida kahdesti. Siemen on
`0x7a4f2c19`.

Prescription-reitin jakauma:

| Tulos / reason code                |  Määrä |
| ---------------------------------- | -----: |
| Tuettu                             | 21 839 |
| `READINESS_RED_STOP`               | 11 505 |
| `READINESS_RECOVERY_ONLY`          | 10 849 |
| `HEALTH_ENGINE_NOT_AVAILABLE`      |  3 945 |
| `YOUTH_ENGINE_NOT_AVAILABLE`       |    667 |
| `OLDER_ADULT_ENGINE_NOT_AVAILABLE` |    699 |
| `SAFETY_INFORMATION_INCOMPLETE`    |    340 |
| `NO_SAFE_STRENGTH_DOSE_AVAILABLE`  |    156 |
| Odottamaton esto                   |      0 |

Jokainen FULL-, LIGHT-, COMPACT_10-, COMPACT_20- ja COMPACT_30-variantti sai
21 839 tuettua tulosta.

| Budjetti | Tuettuja | Suurin laskettu aika | Suurin käyttöaste |
| -------: | -------: | -------------------: | ----------------: |
|   10 min |    3 675 |                594 s |           99,00 % |
|   20 min |    3 679 |              1 199 s |           99,92 % |
|   30 min |    3 665 |              1 799 s |           99,94 % |
|   45 min |    3 572 |              2 695 s |           99,81 % |
|   60 min |    3 661 |              3 575 s |           99,31 % |
|   90 min |    3 587 |              4 571 s |           84,65 % |

Rikkomusmäärät:

- `timeBudgetViolationCount`: 0;
- `displayedDurationMismatchCount`: 0;
- `missingTimeBreakdownCount`: 0;
- `shortenedRestCount`: 0;
- `emptySupportedPrescriptionCount`: 0;
- kaikki muut P0-auditin rikkomukset: 0.

Negatiiviset kontrollit todistavat, että testi rikkoutuu, kun:

- liikesiirtymä poistetaan politiikasta;
- välineiden säätöaika poistetaan politiikasta;
- sarjapalautus lyhennetään alle politiikan minimin;
- aikaerittelyä muutetaan päivittämättä snapshotia;
- ylittävän prescriptionin näkyvä kesto leikataan `Math.min()`-tyylisesti;
- vain `durationMinutes` muutetaan ilman sisällön sovittamista.

## 10. Avoimet P1/P2-tapaukset

Tämä työ ei sulje seuraavia hyväksyntäraportin kohtia:

- `RETURNING`-luokka ja taukosäännöt;
- viikkokierto, frekvenssikatot ja koko viikon liikerakennekattavuus;
- hypertrofiavolyymin viikkoprogressio;
- voimakkaan DOMS-tilan laajempi readiness-tulkinta;
- aloittelijan ja puuttuvan kuormahistorian lopullinen toistoalue;
- liikekirjaston kehonpainoveto-, side support-, kanto- ja hengitysohjeaukot;
- tavoiteluokkien lopullinen tuoterajaus;
- kaikkien pakollisten prescription-kenttien sisältökatselmus;
- ulkopuolinen valmennus-, turvallisuus- ja sisältöhyväksyntä;
- alkuperäisen 40 tapauksen kaikkien P1/P2-havaintojen sulkeminen.

Ihmisbetaa tai vaihe 0:aa ei aloiteta tämän aikamallikorjauksen perusteella.
