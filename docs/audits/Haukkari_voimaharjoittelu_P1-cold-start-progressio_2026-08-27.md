# Haukkari – aikuisten voimaharjoittelun P1 cold start ja progressio 2026-08-27

## 1. Rajaus ja baseline

Tämä raportti dokumentoi rajatun aikuisten voimaharjoittelun työpaketin:
harjoituskerran identiteetin, turvallisen cold start -annostelun ja
kaksinkertaisen progression. Tarkastettu baseline on
`1d9359fe4f75f9f281e5622eb528978d3d3adc0c` haarassa
`codex/training-engine-v2`.

Normatiivista hyväksyntäraporttia tai sisältöjulkaisua
`adult-resistance-v1.0.0` ei muutettu. Kanoninen
`adult-strength-time-1.0.0`-aikamalli säilyy ainoana voimaharjoituksen
aikabudjettipolitiikkana.

Käyttäjän vahvistaman seuraavan kuorman integraatiokorjaus tarkastettiin
myöhemmin baselinea `59086658eeea59982e609205042c15f6ab6e1e07` vasten samalla
haaralla. Tämä lisäys erottaa moottorin kyvyn käyttää valmista vahvistusta ja
käyttäjän todellisen tavan muodostaa vahvistus käyttöliittymässä.

## 2. Juurisyy

Baseline-versiossa `AdultResistanceSetHistory` kuvasi sarjoja, mutta ei
kertonut yksiselitteisesti, mihin tallennettuun harjoituskertaan sarja kuului.
Capability- ja progressiologiikka laski tukimäärää sarjoista. Saman harjoituksen
kaksi sarjaa saattoivat siksi näyttää kahdelta erilliseltä altistukselta.
`completedAt` ei ratkaise ongelmaa, koska saman harjoituksen sarjoilla voi olla
sama aikaleima ja eri harjoituksilla teknisesti sama tai pyöristetty aikaleima.

Lisäksi käyttöliittymän yleinen `WorkoutFeedbackEngine` osasi ehdottaa
`PROGRESS_LOAD`-toimintoa erillään liikekohtaisesta voimaharjoittelumoottorista.
Tämä loi kaksi rinnakkaista progressiopolkua. Baseline-version
`MAX_STRENGTH`-annostelu käytti kaikille kokemustasoille 4–6 toistoa, vaikka
luotettavaa liikeversiokohtaista historiaa ei ollut.

## 3. Harjoituskerran ja kuormakontekstin tietomalli

`AdultResistanceSetHistory` sisältää nyt seuraavat progression kannalta
olennaiset kentät:

- `sessionId`: tallennetun `WorkoutRecord`-rivin tunniste;
- `exerciseCode` ja `exerciseVersion`;
- `loadType`, `loadKg` ja versionoitu `loadContextId`;
- toteutuneet toistot ja RIR;
- kipu ja tekniikan hyväksyntä;
- koko harjoituksen `completionStatus`;
- `doseCompleted`, joka kertoo toteutuiko kyseisen liikkeen määrätty annos.

Vanhan historian mahdollinen `loadIncrementKg` säilyy luettavana
legacy-kenttänä, mutta se ei enää valtuuta uutta kilogrammaprogressiota.
Kuorman mukaan muuttuvia välineportaita ei mallinneta yhdeksi pysyväksi
increment-arvoksi.

Uusi `VerifiedNextLoad` tallentaa käyttäjän vahvistaman todellisen seuraavan
kuorman seuraavalla versionoidulla avaimella:

- `exerciseCode` ja `exerciseVersion`;
- `loadContextId`;
- `currentLoadKg` ja `nextAvailableLoadKg`;
- `confirmedAt`;
- `policyVersion` (`verified-next-load-1.0.0`).

Vahvistus koskee vain täsmälleen samaa liikeversiota, kuormakontekstia ja
nykyistä kuormaa. Kun nykyinen kuorma muuttuu, seuraava porras vahvistetaan
tarvittaessa uudelleen. Näin esimerkiksi käsipainosarjan epätasaiset portaat
säilyvät todellisina eikä moottori keksi väliin kilogrammoja.

Vain nykyinen `verified-next-load-1.0.0`-politiikkaversio voi valtuuttaa
kuormannoston. `confirmedAt` sitoo vahvistuksen sen avanneeseen
harjoitusnäyttöön: aikaleiman on oltava uusimman päätöstä tukevan
harjoituskerran jälkeen ja viimeistään uuden prescriptionin päätöshetkellä.
Tämä estää vanhan harjoitusjakson vahvistuksen aktivoitumisen uudelleen ilman
mielivaltaista kalenteriaikaan perustuvaa vanhenemisoletusta.

`WorkoutPage.strengthHistoryFromLogs()` ottaa `sessionId`:n workout-logissa
olevasta todellisesta `workout_id`-viitteestä. Se ei käytä workout-login omaa
rivitunnistetta eikä päättele identiteettiä aikaleimasta. Saman harjoituksen
kaikille sarjoille tulee siksi sama tunniste.

Kilogrammakontekstin versio on
`adult-resistance-load-context-1.0.0`. Ulkoisen painon ja yhden käsipainon
kilogrammat erotetaan toisistaan. Laitteen kilogrammoille ei muodosteta
oletuskontekstia, koska saman nimisen liikkeen eri laitteiden asteikot eivät ole
automaattisesti vertailukelpoisia. Koneen tarkka kilogramma-arvio vaatii
myöhemmin käyttäjän vahvistaman laitetunnisteen. Kehonpainolle ja
vastuskuminauhalle ei muodosteta kilogramma-arviota tai -progressiota.

## 4. Legacy-käyttäytyminen

Vanha historia säilyy luettavana. Puuttuvaa `exerciseVersion`-, `sessionId`- tai
`loadContextId`-kenttää ei täytetä jälkikäteen nykyisen harjoitekirjaston
arvolla, koska se tekisi vanhasta snapshotista näennäisen vertailukelpoisen.

Legacy-riviä voidaan edelleen käyttää turvallisena yleisenä
liikeperhekontekstina ja viikkovolyymin laskennassa. Se ei avaa tarkkaa
kilogrammasuositusta. Uusi prescription muodostuu kalibroivana eikä koko
harjoitusta estetä, jos turvallinen kuormaton tai käyttäjän itse kalibroima
annos on mahdollinen.

## 5. Cold start -annostelu

`MAX_STRENGTH` ei enää yksin valitse matalaa toistoaluetta:

| Käyttäjä ja historia                                       | Toistoalue |
| ---------------------------------------------------------- | ---------: |
| `BEGINNER` tai ei luotettavaa saman liikeversion historiaa |       6–10 |
| `INTERMEDIATE` ja vähintään kaksi luotettavaa harjoitusta  |        5–8 |
| `ADVANCED` ja vähintään kaksi luotettavaa harjoitusta      |        4–6 |
| Hypertrofian cold start                                    |       8–12 |

Luotettava historia tarkoittaa eri `WorkoutRecord`-tunnisteita, samaa
liikeversiota ja kuormakontekstia, valmistunutta annosta, hyväksyttyä
tekniikkaa, estävän kivun puuttumista sekä kirjattua RIR-arvoa. Ilman tätä
historiaa kuormaa kalibroidaan eikä näytetä keksittyä tarkkaa kilogrammaa.
Kalibrointisarja, tavoite-RIR, sarjapalautukset ja aikamallin marginaalit
säilyvät.

Työpaketti ei lisää erillistä `RETURNING`-profiilia tai kaikkia taukosääntöjä.
Fail-closed-raja kuitenkin estää alle kuuden toiston cold start -annoksen aina,
kun luotettava historia puuttuu.

## 6. Double progression -tilakone

Liikekohtainen päätös on yksi seuraavista:

1. `RECALIBRATE_LOAD`: identiteetti, versio tai vertailukelpoinen
   kuormakonteksti puuttuu;
2. `KEEP_LOAD`: dataa on liian vähän, onnistumisjakso katkesi, todellista
   kuormaporrasta ei ole vahvistettu tai porras ylittää 10 prosenttia;
3. `INCREASE_REPETITIONS`: yksi onnistunut eri harjoituskerta on kirjattu ja
   toistot ovat alueen ylärajan alapuolella;
4. `INCREASE_LOAD`: kaksi eri, enintään 56 päivän ikäistä onnistunutta
   harjoituskertaa on tehty samalla liikeversiolla, kuormakontekstilla ja
   kuormalla toistoalueen ylärajalla, ja vahvistettu seuraava porras on enintään
   10 prosenttia.

Kipu, `techniqueOk=false`, keskeytys tai vajaa annos katkaisee viimeisimmän
onnistumisjakson. Päätös käyttää harjoituksia aikajärjestyksessä eikä suodata
epäonnistunutta välistä pois. Yksi harjoituskerta voi sisältää useita sarjoja,
mutta sen tunniste esiintyy progression tukena vain kerran.

Keskeiset reason codet ovat:

- `SESSION_IDENTITY_REQUIRED`;
- `EVALUATION_TIME_REQUIRED`;
- `COMPARABLE_LOAD_CONTEXT_REQUIRED`;
- `NO_COMPARABLE_SESSION_HISTORY`;
- `ONE_SUCCESSFUL_DISTINCT_SESSION`;
- `BELOW_REPETITION_MAXIMUM`;
- `FEWER_THAN_TWO_SUCCESSFUL_DISTINCT_SESSIONS_AT_REPETITION_MAXIMUM`;
- `TWO_SUCCESSFUL_DISTINCT_SESSIONS_AT_REPETITION_MAXIMUM`;
- `NEXT_AVAILABLE_LOAD_NOT_CONFIRMED`;
- `USER_CONFIRMED_NEXT_AVAILABLE_LOAD`;
- `VERIFIED_NEXT_LOAD_EXCEEDS_TEN_PERCENT`;
- `SUCCESS_STREAK_BROKEN`;
- `NON_KILOGRAM_LOAD_HAS_NO_AUTOMATIC_KG_PROGRESSION`.

Pienintä kuormaporrasta ei arvioida prosenttikaavalla. Sen pitää olla
välinekontekstista vahvistettu todellinen porras. Esimerkiksi 5 → 6 kg on 20
prosenttia ja estetään; järjestelmä säilyttää 5 kg eikä keksi väliin painoa.

## 7. Tuotantoreitti ja käyttöliittymä

`prescribeAdultResistanceSession()` muodostaa jokaiselle liikkeelle kanonisen
`progressionDecision`-snapshotin. Sama päätös kulkee julkisen
`resolvePrescription()`-reitin sekä `PlanGenerator`-reitin läpi. Päätöslokin
`adaptations`-osaan tallennetaan reason codet ja päätöksessä käytetyt eri
`sessionId`-tunnisteet. Tunnisteet ovat pseudonyymejä WorkoutRecord-tunnisteita;
lokiin ei lisätä nimeä, sähköpostia tai muuta henkilötietoa.

Harjoitusnäkymä käyttää liikekohtaista päätöstä seuraavan kerran kenttien ja
kuormaohjeen muodostamiseen. Käyttäjälle näytetään yksi neljästä ohjeesta:
lisää yksi toisto, säilytä kuorma, nosta kuorma vahvistettuun portaaseen tai
kalibroi kuorma uudelleen. Yleinen harjoituspalautepäätös voi edelleen keventää
annosta turvallisuussyistä, mutta se ei tee rinnakkaista liikekohtaista
kuormannostoa.

### 7.1 Moottorin kyky käyttää vahvistusta

Moottori hyväksyy `INCREASE_LOAD`-päätöksen vain, kun kaksi eri onnistunutta
`WorkoutRecord`-harjoitusta ovat toistoalueen ylärajalla samalla kuormalla ja
profiilista löytyy täsmälleen saman liikeversion, kuormakontekstin sekä nykyisen
kuorman `VerifiedNextLoad`. Puuttuva tai eri liikkeeseen, versioon,
kuormakontekstiin tai nykykuormaan kuuluva vahvistus tuottaa `KEEP_LOAD`-
päätöksen. Enintään 10 prosentin raja tarkistetaan vahvistetusta nykyisen ja
seuraavan kuorman erotuksesta.

### 7.2 Käyttäjän todellinen vahvistuspolku

Käyttöliittymä kysyy kuormaa vasta, kun kaksi onnistunutta eri harjoituskertaa
on jo täyttänyt etenemisehdot mutta seuraavaa kuormaa ei tunneta. Käyttäjälle
näytetään nykyinen kuorma ja kysymys ”Mikä on pienin seuraava käytettävissä
oleva kuorma?”. Hyväksytty vastaus tallennetaan nykyisen profiilin
synkronoitavaan `app_settings`-JSONiin. Päivitys yhdistää uuden vahvistuksen
olemassa oleviin asetuksiin eikä poista esimerkiksi väline-, aika- tai
muistutusasetuksia. Profiilirivit ladataan ja kirjoitetaan nykyisen käyttäjän
tunnisteella, joten vahvistus ei siirry käyttäjältä toiselle. Onboardingia ei
muutettu eikä oletusporrasta lisätty.

Käyttöliittymä estää ei-numeerisen, nykyistä pienemmän tai yhtä suuren sekä yli
10 prosentin vastauksen ennen tallennusta. `BODYWEIGHT`- ja `BAND`-liikkeille
kilogrammakysymystä ei näytetä. `MACHINE_KG` vaatii ensin käyttäjän tunnistaman
laitekontekstin; ilman sitä vahvistusta ei kysytä eikä kuormaa nosteta.

Jatketun harjoituksen sarjarivit muodostetaan tallennetun prescriptionin lisäksi
samasta aiemmasta liikehistoriasta kuin ensimmäisellä avauskerralla. Siksi
päätösteksti, esitäytetty toistomäärä ja kuorma säilyvät samoina myös sivun
uudelleenlatauksessa. Tuotantopolun E2E-tarkastus havaitsi ennen korjausta, että
päätösteksti säilyi mutta esitäytetyt kentät tyhjenivät; korjaus välittää
`previousResults`-tiedot myös jatketun harjoituksen `createSetRows()`-kutsuun.

Korvaava liike nollaa vanhan liikkeen kuormakontekstin ja progression sekä
vaatii uuden kalibroinnin. Prescriptionin sarjamäärä tai palautus ei muutu
progressiopäätöksen vuoksi, joten kaikki versiot kulkevat edelleen kanonisen
`TimeBudgetPolicy`-sovittimen läpi.

## 8. Ennen ja jälkeen

| Tapaus                                    | Baseline                                   | Uusi tulos                                |
| ----------------------------------------- | ------------------------------------------ | ----------------------------------------- |
| 2 sarjaa yhdessä harjoituksessa           | saattoi näyttää 2 exposurelta              | 1 exposure, kuorma säilyy                 |
| 2 eri harjoitusta samalla 40 kg kuormalla | sarja- ja sessiokäsitteet sekoittuivat     | ilman vahvistusta 40 kg säilyy            |
| Käyttäjä vahvistaa 40 → 42,5 kg           | käyttöliittymässä ei ollut vahvistuspolkua | täsmällinen vahvistus voi avata nousun    |
| 1 onnistuminen, 7/8 toistoa               | odotti kahta onnistumista                  | 8 toistoa samalla 40 kg kuormalla         |
| 5 kg, todellinen seuraava porras 1 kg     | erillinen apufunktio esti osan reiteistä   | 5 kg säilyy, 6 kg estetään                |
| Aloittelija + `MAX_STRENGTH`              | 4–6                                        | 6–10 ja kalibrointi                       |
| Legacy ilman workout-tunnistetta          | saattoi osallistua tarkkaan arvioon        | ei tarkkaa kg:ta, turvallinen kalibrointi |

## 9. Testit ja auditoinnit

Lisätyt regressiot todistavat vähintään seuraavat invariantit:

- saman workout-tunnisteen kaksi sarjaa on yksi exposure;
- kaksi eri workout-tunnistetta on kaksi exposurea;
- legacy-identiteetti ja puuttuva konekonteksti toimivat fail closed;
- cold start -alueet ovat 6–10, 5–8 ja 4–6 määritellyillä ehdoilla;
- yksi onnistuminen lisää toiston;
- kaksi onnistumista voi nostaa vain vahvistetun, enintään 10 prosentin
  kuormaportaan;
- kipu, tekniikkavirhe ja keskeytys katkaisevat jakson;
- kehonpainolle ja nauhalle ei synny kilogrammaprogressiota;
- 20 → 21 kg vahvistus ei valtuuta myöhempää 21 → 22 kg siirtymää;
- poistettu, vanhentunut tai väärän politiikkaversion vahvistus säilyttää
  kuorman mutta ei estä harjoittelua;
- `app_settings`-tallennus säilyttää muut asetukset ja vahvistus pysyy
  käyttäjäkohtaisessa profiilissa;
- `resolvePrescription`, `PlanGenerator`, päätösloki ja WorkoutPage käyttävät
  samaa sessioidentiteettiin perustuvaa päätöstä.

Playwright-tuotantopolun E2E-testi ei syötä `loadIncrementKg`- tai
`nextAvailableLoadKg`-arvoa IndexedDB:hen. Se tekee oikeassa käyttöliittymässä
neljä valmista harjoitusta ja tallentaa siten erilliset `WorkoutRecord`-rivit.
Kaksi 5 kg harjoitusta avaavat kuormakysymyksen, mutta käyttäjän 6 kg vastaus
estetään 20 prosentin nousuna. Kaksi myöhempää 20 kg harjoitusta avaavat uuden,
nykykuormaan sidotun kysymyksen. Käyttäjä vahvistaa käyttöliittymässä 21 kg,
jonka jälkeen seuraava tuotantoreitin prescription ja esitäytetyt sarjakentät
käyttävät 21 kg kuormaa. Sama päätös ja kenttäarvo säilyvät sivun
uudelleenlatauksessa.

Deterministinen `audit:p1-strength` sisältää 14 tapausta. Tulos:

- hyväksytty 14;
- hylätty 0;
- jakauma: `KEEP_LOAD` 6, `INCREASE_LOAD` 2, `RECALIBRATE_LOAD` 1,
  `INCREASE_REPETITIONS` 2 ja cold start -annokset 3.

Nykyinen `audit:p0` säilyi ei-tyhjänä:

- generoituja tapauksia 50 000;
- tuettuja prescriptioneja 21 839;
- odottamattomia estoja 0;
- tuettuja adaptaatioita 21 995;
- odottamattomia adaptaatioestoja 0;
- aikabudjettirikkeitä 0;
- näkyvän keston ristiriitoja 0;
- tyhjiä tuettuja prescriptioneja 0.

Lopulliset paikalliset portit:

- `git diff --check`: hyväksytty;
- `npm run check`: hyväksytty (203 yksikkötestiä ja 8 integraatiotestiä sekä
  sisältö-, skip-, lint-, formatointi-, tyyppi-, aika-, P0-, tietosuoja-, build-
  ja PWA-portit);
- `npm run audit:p1-strength`: 62 kohdennettua testiä ja 14/14 auditointitapausta
  hyväksytty;
- `npm run e2e`: 6/6 hyväksytty;
- `npm run e2e:app`: 11 hyväksytty, 10 projektin ennalta sallittua
  selain-/visuaaliskippiä ja 0 epäonnistumista.

Selainajoissa näkyi vain testiympäristön `NO_COLOR`/`FORCE_COLOR`-varoitus. Se
ei muuttanut testitulosta. Skip-auditointi vahvisti viisi sallittua ehdollista
skip-määrittelyä eikä löytänyt `fixme`- tai `only`-merkintöjä.

## 10. Yhteys hyväksyntätapauksiin 4 ja 18

Hyväksyntätapaus 4 sulkeutuu cold start -rajalla: aloittelijan
`MAX_STRENGTH`-tavoite ei enää tuota 4–6 toistoa ilman luotettavaa historiaa,
vaan 6–10 toistoa ja kalibroinnin.

Hyväksyntätapaus 18 sulkeutuu oikealla double progression -järjestyksellä:
yksi onnistunut erillinen harjoitus sallii yhden lisätoiston ylärajaan asti;
kuormannosto vaatii kaksi eri onnistunutta harjoitusta ylärajalla.

## 11. Avoimet rajat ja oletukset

- Käyttöliittymä ei vielä tarjoa erillistä laitekohtaisen konekontekstin
  tunnistusta. Sen puuttuessa tarkka konekuorma, kuormakysymys ja automaattinen
  kilogrammanosto estetään tarkoituksella.
- `RETURNING`-luokka ja kaikki tauon pituuteen perustuvat P1-säännöt kuuluvat
  myöhempään työpakettiin.
- Käyttäjän toteutuneita progression onnistumis-, hyväksyttävyys- ja
  sitoutumismittareita ei ole vielä kerätty vaihe 0:n datalla.
- RIR on käyttäjän subjektiivinen arvio. Politiikkaa pitää verrata myöhemmin
  toteutuneisiin harjoituksiin ja valmennusasiantuntijan arvioon uutena
  versiona, jos data sitä edellyttää.
