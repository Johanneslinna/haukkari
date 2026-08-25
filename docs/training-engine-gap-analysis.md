# Harjoittelumoottorin auditointi ja gap analysis

Päiväys: 25.8.2026

## Briefissä pyydetty lähtötilan varmennus

| Havainto                                                                      | Tila auditoinnissa    | Toteutuksen jälkeen                                                                                                                                                                                 |
| ----------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TrainingPrescriptionEnginein kovakoodattu kirjasto ja erillinen Supabase-seed | Vahvistettu           | Aikuisten voimareitti ja seed generoidaan samasta `adult-resistance-v1.0.0`-paketista. Vanha kirjasto säilyy legacy-yhteensopivuutta varten, mutta prescription engine ei käytä sitä voimareitillä. |
| Plannerille tyhjät kalenterisyötteet                                          | Ei enää ajankohtainen | Kiinteät harjoitukset ja kilpailut välittyvät plannerille. Muutos luo uuden tulevaisuuteen vaikuttavan plan-version vakaalla reason codella.                                                        |
| SPEED_POWER geneeriseksi voimaksi                                             | Muuttunut             | Vanha toteutus oli erillinen, mutta sitä ei ollut evidence-julkaistu. Nyt tuotantoreitti palauttaa `SPEED_POWER_ENGINE_NOT_REVIEWED`.                                                               |
| SPORT/MATCH liikkuvuusfallback                                                | Vahvistettu           | Hiljainen fallback poistettu; molemmat palauttavat tyypitetyn `UNSUPPORTED`-tuloksen.                                                                                                               |
| PROGRESS_LOAD ei muuta prescriptionia                                         | Muuttunut osittain    | Käyttöliittymä esitäytti jo seuraavan kuorman/toiston. Nyt progressio vaatii myös hyväksyttävän RIR:n, rajoittuu yhteen muuttujaan ja päätös on testattu.                                           |
| RIR tallennetaan nullina                                                      | Ei enää ajankohtainen | RIR tallentui jo käyttöliittymästä paikallisesti ja tietokantaan. Nyt se on lisäksi synkronointi- ja seuraavan päätöksen regressiotestissä.                                                         |
| Onboarding hyväksyy 16-vuotiaan                                               | Vahvistettu           | Minimi on 18; olemassa oleva alaikäinen saa turvallisen `YOUTH_ENGINE_NOT_AVAILABLE`-eston ilman datan poistamista.                                                                                 |
| Kuukautiskierron oirevaikutus lasketaan kahdesti                              | Ei enää ajankohtainen | Yksi oirevaikutus on yksi readiness-signaali. Nyt yksilölliset reason codet tallentuvat erikseen.                                                                                                   |
| Domain kutsuu päätösjälkeen `new Date()`                                      | Vahvistettu           | Päätösaika injektoidaan; legacy-fallback on sisältöjulkaisun vakioitu julkaisuhetki.                                                                                                                |

## Toteutettu tässä pystyleikkauksessa

- versioitu evidence-, rule-, exercise- ja substitution-sisältö;
- Zod- ja ristiviitevalidointi sekä immutable-digest;
- sisäisen beta-statuksen ja ihmisen tieteellisen arvioinnin erottelu ilman
  tekaistua arvioijaa;
- offline `ExerciseCatalog` ja in-memory-testikatalogi;
- rakenteinen tavoite, hard filter, deterministinen pisteytys;
- RIR:ää hyödyntävä capability, kalibrointi ja annostelu;
- sarjakohtainen rajattu mukautuminen ja oikea inter-session progressio;
- laaja decision trace;
- eksplisiittiset ikä-, terveys- ja tukemattoman tyypin rajat;
- kalenterin vakaat muutoskoodit ja versionointi;
- additiiviset tietokantamigraatiot, muuttumattomat julkaisukohtaiset
  harjoitemäärittelyt ja samasta paketista generoitu nykyversion projektio.

## Avoimet gapit

1. Ulkoinen liikunta-/lääketieteen asiantuntija-arvio ennen julkista beta-julkaisua.
2. Capability-arvioiden oma normalisoitu taulu; v1 käyttää harjoitussnapshotteja ja lokihistoriaa.
3. Laajempi liikevideoiden toimitusprosessi; tarkistamattomia linkkejä ei näytetä.
4. Juoksun ja kestävyyden vastaava versionoitu evidence-sisältöjulkaisu.
5. Hosted Supabase -migraation, RLS:n, viennin, poiston ja palautuksen staging-varmennus.
6. Juniori-, raskaus-, kuntoutus-, nopeus- ja lajimoottorit erillisinä asiantuntijatarkastettuina julkaisuina.
7. Fysiologisen kuorman ja päiväkohtaisen historian syvempi viikkoannoksen hallinta ilman wearables-oletuksia.
