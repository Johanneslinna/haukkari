# Haukkari – aikuisten voimaharjoittelun P1/31-sulkemisraportti

Päiväys: 2026-08-28

Tarkastettu baseline: `733ce90609207d2c6e1d937406e14e15377bdc48`

Työpaketti: voimakkaan DOMS:n lisäkevennys, alkuperäisen hyväksyntämatriisin tapaus 31

## Rajaus ja tulkinta

Tässä työpaketissa `soreness = HIGH` tarkoittaa käyttöliittymässä vaihtoehtoa
“Voimakas ja haittaa liikkumista”. Se ei tarkoita lievää tai tavallista
harjoitusarkuutta. Lievän DOMS:n 2/10-syöte on edelleen avoin P2-tapaus 30 eikä
sitä merkitä tässä raportissa läpäistyksi.

Politiikka `adult-strength-severe-doms-1.0.0` on konservatiivinen,
versionoitu `INTERNAL_BETA`-tuoteoletus. Se ei ole väite lääketieteellisesti
todistetusta yksittäisestä raja-arvosta. Politiikkaa muutetaan vain uutena
versiona toteutuneen datan tai erillisen asiantuntija-arvion perusteella.

## Tuotantokorjaus

Voimaharjoituksen ja voimakkaan, liikkumista haittaavan lihasarkuuden yhdistelmä
tuottaa nyt:

- `YELLOW`-valmiustilan;
- volyymikertoimen `0.5`;
- reason coden `SEVERE_DOMS_STRENGTH_DELOAD`;
- kiellon maksimiyrityksille;
- työsarjojen kokonaismäärän puolittamisen;
- tavoite-RPE:n rajauksen enintään kuuteen ja yhden lisä-RIR:n;
- alkuperäisten sarjapalautusten säilyttämisen.

Työsarjat jaetaan deterministisesti niin, että jokaiselle suunnitellulle
liikkeelle jää vähintään yksi sarja ja avainliikkeet saavat lisäsarjat ensin.
Puolitus käyttää sääntöä
`CEILING_HALF_WITH_MINIMUM_ONE_SET_PER_PRESCRIBED_STRENGTH_EXERCISE`: sarjojen
kokonaismäärä on `ceil(alkuperäinen × 0,5)`, kuitenkin vähintään yksi sarja
jokaiselle prescriptionissa säilyvälle voimaliikkeelle. Yhden liikkeen
rajatapaukset ovat siten `1 → 1`, `2 → 1`, `3 → 2`, `4 → 2` ja `5 → 3`.
Tuetussa normaalissa 14 sarjan käyttäjäpolussa annos muuttui seitsemään sarjaan.
Jos näin pientä kokonaisannosta ei voi puolittaa poistamatta liikkeen ainoaa
sarjaa, yhden sarjan turvallinen vähimmäisannos ohittaa matemaattisen tavoitteen.

Kolmen tai useamman samanaikaisen palautumistekijän nykyinen palauttava
`ORANGE_RECOVERY`-sääntö säilyy ensisijaisena. Muiden harjoitustyyppien ja muiden
keltaisten valmiustilojen annostus ei muutu tässä työssä.

`RED_STOP`, `ORANGE_RECOVERY`, terveysesto, vakava kipu, neurologinen oire sekä
toispuoleisen nopeasti lisääntyvän pohjeturvotuksen ja levossa tuntuvan kivun
yhdistelmä käsitellään ennen DOMS-politiikkaa. DOMS-reason code ei voi muuttaa
niitä RPE 6 -voimaharjoitukseksi. Jos voimaharjoituksen vähimmäisannosta ei jää
tai se ei mahdu turvalliseen aikabudjettiin, tulos on
`NO_SAFE_STRENGTH_DOSE_AVAILABLE`, ei tyhjä `SUPPORTED`-harjoitus.

## Progression jäädytys

DOMS-kevennetty harjoitus on toteutunut harjoitus ja sen todelliset sarjat
lasketaan seitsemän vuorokauden volyymiin. Sitä ei kuitenkaan hyväksytä:

- toisto-, kuorma- tai sarjaprogression näyttöharjoitukseksi;
- capability-arvion kalibrointiharjoitukseksi;
- RETURNING-paluuharjoitusten hyväksyttyyn laskuriin;
- käyttäjän aiemmin vahvistaman `VerifiedNextLoad`-nousun valtuuttavaksi
  harjoitukseksi.

Päätös käyttää reason codeja `SEVERE_DOMS_STRENGTH_DELOAD`,
`SEVERE_DOMS_STRENGTH_PROGRESSION_FROZEN` ja RETURNING-polussa
`RETURN_SESSION_REJECTED_SEVERE_DOMS_DELOAD`. Käyttäjälle näytetään kuorman ja
toistojen säilyttäminen, ei moottorin sisäistä nostopäätöstä.

## Tuotantopolku ja jäljitettävyys

Kuntotarkistus tallentaa päätöksen reason codet synkronoitavaan
`daily_checkins.answers.recommendation`-snapshotiin. Harjoitusnäkymän varsinainen
`adaptWorkoutPrescriptionForCurrentAthlete()`-reitti välittää nykyisen käyttäjän
profiilin, terveysseulonnan, readinessin ja reason codet keskitetylle
`adaptPrescription()`-rajalle.

Pelkkä vanha `YELLOW`-snapshot ei saa voimakkaan DOMS:n valtuutta. Jos uusi
reason code puuttuu, käytetään ennestään tunnettua tavallista keltaisen päivän
kevennystä. Jos käyttäjä tekee voimakkaan DOMS:n kuntotarkistuksen jo tallennetun
tai käynnistetyn täyden harjoituksen jälkeen, snapshot uudelleenvaltuutetaan
nykyisellä päätöksellä ja kevennetään ennen jatkamista. Jo kevennettyä snapshotia
ei puoliteta uudelleen. Käynnissä olevassa harjoituksessa jo kirjatut sarjat
säilyvät muuttumattomina. Uusi tavoite on vähintään jo tehtyjen sarjojen määrä,
joten vain jäljellä oleva työ vähenee. Jos tehtyjä sarjoja on jo uuden tavoitteen
verran tai enemmän, historia säilyy eikä sovellus vaadi lisäsarjoja.

Harjoitusnäkymä kertoo käyttäjälle suoraan, että voimakas
lihasarkuus puolitti työsarjojen määrän ja rajasi tehon hallituksi. Päätösloki
sisältää säännön `READINESS-SEVERE-DOMS-001`, politiikkaversion
`adult-strength-severe-doms-1.0.0`, alkuperäisen ja mukautetun työsarjamäärän,
jo tehdyn ja jäljellä olevan sarjamäärän, RPE 6 -rajan sekä pyöristyssäännön.
Samat tiedot tallennetaan `workouts.prescription`- ja
`workout_logs.decision_trace`-snapshotteihin ja ne säilyvät offline-synkronoinnin
sekä kahden laitteen latauksen läpi. Kanoninen aika-arvio ja
`strengthWeek.plannedVolumeAfter` lasketaan mukautetuista sarjoista.

## Regressiot

- Readiness-domain: voimakas DOMS + voimaharjoitus tuottaa `0.5`, oikean reason
  coden ja käyttäjälle näkyvän 50 prosentin toimintaohjeen.
- Negatiivinen kontrolli: voimakas lihasarkuus muussa harjoitustyypissä säilyttää
  nykyisen yhden palautumislipun säännön.
- Prescription-domain: sarjat puolittuvat, palautukset säilyvät ja RPE on
  enintään kuusi.
- Rajataulukko: lähtömäärät 1–5 noudattavat dokumentoitua ylöspäin pyöristystä,
  eikä tyhjää `SUPPORTED`-harjoitusta synny.
- P0-negatiiviset kontrollit: `RED_STOP`, `ORANGE_RECOVERY`, terveysesto, vakava
  kipu, neurologinen oire ja pohjeturvotus säilyttävät STOP-/RECOVERY-tuloksensa.
- Progressio: DOMS-kevennetty toteuma katkaisee onnistumisjakson eikä avaa
  toisto-, kuorma-, sarja- tai `VerifiedNextLoad`-nousua.
- Kalibrointi ja RETURNING: DOMS-kevennetty toteuma ei kasvata capability- eikä
  paluuharjoituslaskuria.
- Negatiivinen kontrolli: tavallinen `YELLOW` ilman DOMS-reason codea ei saa
  `READINESS-SEVERE-DOMS-001`-sääntöä.
- Tallennusreitti: reason code säilyy daily check-in -snapshotissa.
- Käyttöliittymän tuotantoadapteri: tallennettu reason code valtuuttaa saman
  puolitetun annoksen.
- Jatkamispolku: aiemmin tallennettu täysi snapshot kevennetään nykyisen
  kuntotarkistuksen perusteella, jo tehdyt sarjat säilyvät, vain jäljellä oleva
  työ vähenee ja jo kevennetty snapshot ei kevene toista kertaa.
- Jäljitettävyys: politiikkaversio, reason codet, sarjamäärät ja RPE-raja
  säilyvät workout- ja logisnapshotissa sekä kahden selaimen synkronointitestissä.
- Selain-E2E: todellinen onboarding → viikkoesikatselu → tarkka kuntotarkistus →
  voimakas DOMS → harjoitus -polku läpäisi Android/Chromium-, iPhone/WebKit- ja
  desktop/Chromium-projekteissa. Annos oli 14 → 7 sarjaa ja säilyi
  uudelleenlatauksessa.

## Lopullinen varmennus

- `npm run check`: PASS; 342 yksikkötestiä ja 9 integraatiotestiä.
- `audit:p0`: 50 000 tapausta, 21 879 sallittua prescriptionia,
  `unexpectedBlockedCount = 0`, `unexpectedAdaptationBlockedCount = 0` ja nolla
  aika- tai turvallisuusrikettä.
- `audit:p1-strength`: 14/14 tapausta.
- `audit:p1-return`: 432/432 tuettua tapausta, nolla rikettä.
- `audit:p1-week`: 50 000 tapausta, nolla rikettä.
- Yleinen selain-E2E: 6/6.
- Sovellus-E2E: 41 läpäistyä ja 10 ennestään hyväksyttyä projektikohtaista
  ohitusta. Uusi DOMS-polku läpäisi kaikki kolme projektia ilman ohitusta.
- Kahden selaimen paikallinen synkronointi-E2E: 1/1; DOMS-päätösloki säilyi
  uudelleenlatauksessa ja siirtyi toiselle laitteelle muuttumattomana.
- `git diff --check`: PASS.

## Alkuperäinen 40 tapauksen matriisi

Alkuperäinen `scripts/audits/engine-audit.mjs` ajettiin muuttamatta sen
hyväksymisehtoja. Tapaus 31 muuttui tulokseen `PASS`: `YELLOW`, kerroin `0.5`.
Raakatulos oli 20 `PASS`, 14 `NOT_IMPLEMENTED` ja 6 `FAIL`.

Skripti sisältää edelleen ennen myöhempiä P0/P1-sulkemisia kovakoodattuja vanhoja
tilamerkintöjä ja auditointikohteen metatietoja. Siksi raakayhteenveto ei yksin
ole nykyisen koko moottorin konsolidoitu hyväksyntätulos. Tässä työssä sitä ei
kirjoitettu uudelleen eikä muiden tapausten tuloksia nostettu hiljaisesti
`PASS`-tilaan. Erityisesti tapaus 30 pysyy `NOT_IMPLEMENTED`/P2-tilassa ja vaatii
erillisen päätöksen.

## Testikuvien siivous

Yksitoista seurattua PNG-referenssikuvaa palautettiin baselineen.
`today-visual.spec.ts` kirjoittaa automaattiset ajokuvat jatkossa Playwrightin
ohitettuun testiartefaktihakemistoon eikä muuta versionoituja referenssikuvia.
Yleistä `*.png`-gitignore-sääntöä ei lisätty.

Alkuperäistä hyväksyntäraporttia tai sisältöjulkaisua
`adult-resistance-v1.0.0` ei muutettu.
