# CODEX-TOTEUTUSPROMPTI: Haukkarin kattava harjoitusohjelmamoottori

Toimi kokeneena tuotesuunnittelijana, liikuntafysiologina,
harjoitusohjelmoinnin asiantuntijana, saavutettavuussuunnittelijana,
tietoturva-arkkitehtina ja senioritason full-stack TypeScript-kehittäjänä.

Työskentelet olemassa olevassa **Haukkari**-repositoryssa. Haukkari on
suomenkielinen, mobiili ensin rakennettu, asennettava offline-first PWA, jonka
tuotanto-osoite tulee olemaan `https://haukkari.fi/`.

## Tehtävän päätavoite

Toteuta Haukkariin oikea, yksilöllinen ja laajennettava harjoitusohjelmamoottori.
Sen pitää muodostaa käyttäjälle konkreettinen harjoitusohjelma ja yksittäiset
harjoitukset liikkeineen, sarjoineen, toistoineen, kuormineen, palautuksineen ja
ohjeineen. Ohjelman pitää perustua käyttäjän kuntokartoitukseen ja muuttua
turvallisesti tavoitteen, palautumisen, toteutuneen harjoittelun, lajikuorman,
käytettävissä olevan ajan, välineiden ja rajoitteiden perusteella.

Älä rakenna satunnaista treenigeneraattoria, staattista esimerkkiohjelmaa tai
kovakoodattua yhden käyttäjän ohjelmaa. Toteuta deterministinen, testattava ja
selitettävissä oleva ohjelmointijärjestelmä.

“Kaikki mahdolliset vaihtoehdot” tarkoittaa tässä:

- kattavaa testattua yhdistelmää tuetuista tavoitteista, kokemustasoista,
  harjoitusympäristöistä, aikarajoista ja terveystilanteista
- selkeää ja turvallista yleistä fallbackia tuntemattomille lajeille tai
  puutteellisille tiedoille
- arkkitehtuuria, johon uusia liikkeitä, lajeja ja ohjelmointistrategioita voi
  lisätä ilman React-komponenttien tai ydinalgoritmin uudelleenkirjoittamista.

Älä väitä tukevasi jokaista maailman lajia tai terveystilannetta. Näytä
käyttäjälle rehellisesti, milloin ohjelma on yleinen lajia tukeva ohjelma ja
milloin ammattilaisen arvio tarvitaan.

## Nykyinen ohjelmisto ja säilytettävät toiminnallisuudet

Tutki nykyinen toteutus ennen muutoksia. Säilytä ja integroi vähintään seuraavat
olemassa olevat kokonaisuudet:

1. **Tunnukset ja tili**
   - sähköposti- ja salasanarekisteröityminen
   - sähköpostivahvistus, kirjautuminen ja istunnon säilytys
   - unohtuneen salasanan palautus ja salasanan vaihto
   - uloskirjautuminen, täydellinen tietojen vienti ja tilin poistaminen.
2. **Aloituskartoitus**
   - ikä, pituus, paino, tavoite ja sivutavoitteet
   - tavoite- tai kilpailupäivä
   - harjoittelukokemus ja nykyinen viikkoharjoittelu
   - kestävyys- ja lajitausta
   - käytettävissä olevat päivät ja minuutit
   - välineet, mieltymykset ja vältettävät harjoitukset
   - työn ja arjen kuormitus sekä unen määrä
   - ruokavaliorajoitteet ja ravinnon seurantatapa
   - sairaudet, lääkärin rajoitteet, lääkitys, kivut, vammat, leikkaukset,
     liikerajoitteet, lantionpohjan oireet ja rasituksen varoitusoireet
   - raskaus-, imetys- tai synnytyksen jälkeinen vaihe
   - häiriintyneen syömisen historia
   - vapaaehtoinen kuukautisoireiden seuranta
   - käyttäjän valitsemat kehitysmittarit ja erillinen terveystietosuostumus.
3. **Tavoitteet ja suunnitelmaversiot**
   - yksi päätavoite ja enintään kaksi sivutavoitetta
   - yhdeksän tavoitestrategiaa
   - tavoitekonfliktit, esikatselu ja käyttäjän vahvistus
   - muuttumattomat suunnitelmaversiot ja vanhan historian säilytys
   - edellisen tavoiteversion palauttaminen uutena versiona.
4. **Valmennusmoottorit**
   - `GoalEngine`, `ConflictEngine`, `SportAdapterRegistry`, `PlanGenerator`,
     `ScheduleOptimizer`, `ReadinessEngine`, `ProgressionEngine`,
     `NutritionPolicyEngine` ja `ProgressEvaluator`.
5. **Lajit ja kalenteri**
   - juoksun, pyöräilyn ja voimanoston täydet adapterit
   - yleinen lajia tukeva fallback muille lajeille
   - kiinteät lajiharjoitukset, valmentajan harjoitukset, ottelut ja A/B/tavalliset
     kilpailut osana kokonaiskuormaa.
6. **Päivittäinen toiminta**
   - Tänään-näkymä
   - päivittäinen kuntotarkistus
   - GREEN-, YELLOW-, ORANGE_RECOVERY- ja RED_STOP-päätökset
   - täysi, kevennetty sekä 10, 20 ja 30 minuutin harjoitusvaihtoehto.
7. **Seuranta**
   - viikkonäkymä, aktiivinen harjoitus, harjoitushistoria
   - ravintokirjaus ja käyttäjän hyväksyntää vaativat energiamuutokset
   - kehomittarit, tavoitejaksojen aikajana ja edistymisen arviointi.
8. **Offline ja synkronointi**
   - Dexie/IndexedDB, atominen paikallinen kirjoitus ja outbox
   - idempotenssi, tombstonet, vakaa kursori ja versioristiriidat
   - kahden laitteen synkronointi ja käyttäjän ratkaistavat konfliktit.
9. **Tietosuoja ja muistutukset**
   - JSON/CSV-viennit ja palautus
   - yksittäisten mittausten ja yksityisten kuvien poisto
   - sovelluksen sisäiset muistutukset ja ICS
   - feature flagin takainen terveystiedoton Web Push.
10. **PWA**
    - asennus Androidille ja iPhonelle
    - standalone, safe area, vaalea/tumma teema ja vähintään 44 px kosketuskohteet
    - service worker, offline-app shell, asennuskuvakkeet ja päivityskehote.

Älä poista tai heikennä näitä toiminnallisuuksia uuden harjoitusohjelman vuoksi.

## Ensin tehtävä repo- ja aukkoanalyysi

1. Tutki `AGENTS.md`, Git-tila, dokumentaatio, migraatiot, domain-moduulit,
   nykyinen liike-seed, harjoitussivut ja testit.
2. Älä ylikirjoita käyttäjän olemassa olevia muutoksia.
3. Vertaa nykyistä toteutusta tämän promptin vaatimuksiin.
4. Kirjaa toteutussuunnitelma ja hyväksyntäportit dokumentaatioon.
5. Pidä sovellus käynnistyvänä ja testattavana jokaisen vaiheen jälkeen.
6. Älä commitoi, pushaa tai julkaise ilman käyttäjän erillistä lupaa.

## 1. Kuntokartoituksen vaikutus ohjelmaan

Kuntokartoitus ei saa olla pelkkä tallennettava lomake. Rakenna tyypitetty
`AssessmentProfile`, jonka kaikki ohjelmointiin vaikuttavat kentät kulkevat
`PlanGenerator`- ja `ScheduleOptimizer`-moottoreille.

Ohjelman on muututtava ainakin seuraavien perusteella:

- päätavoite ja sivutavoitteet
- tavoitepäivä, kilpailupäivä ja kauden vaihe
- aloittelija, jonkin verran kokenut tai edistynyt
- nykyinen harjoitustiheys, voimataso ja kestävyysmäärä
- käytettävissä olevat viikonpäivät ja 10–120 minuutin aikaikkunat
- koti, ulkoilu, kuntosali tai yhdistetty ympäristö
- käyttäjän todelliset välineet
- mieluisat ja epämieluisat liikkeet
- fyysinen työ ja muu arjen kuormitus
- kiinteät lajiharjoitukset, ottelut ja kilpailut
- kipualueet, liikerajoitteet, lääkärin rajoitteet ja muut turvallisuusrajat
- raskaus-, synnytyksen jälkeinen ja lantionpohjan tilanne vain turvallisesti
  rajattuna, ei diagnooseina
- tavallinen uni ja viimeaikainen palautuminen
- toteutunut harjoittelu, keskeytykset ja käyttäjän palaute.

Jokaisen ohjelmointipäätöksen pitää palauttaa:

```ts
type ProgramDecision<T> = {
  decision: T
  reasons: Array<{ code: string; message: string; priority: string }>
  warnings: string[]
  alternatives: string[]
}
```

Käyttäjän pitää nähdä ymmärrettävä vastaus kysymykseen: “Miksi tämä harjoitus on
minulle ja miksi se on tänään tällainen?”

## 2. Laaja liike- ja harjoitekirjasto

Laajenna liikebibliografiaa oikeaksi tietomalliksi. Jokaisella liikkeellä pitää
olla vähintään:

- suomenkielinen nimi ja vaihtoehtoiset hakusanat
- liikemalli: kyykky, lantionojennus, työntö, veto, kantaminen, askellus,
  keskivartalo, rotaatio, hyppy, heitto, juoksu tai muu kestävyys
- ensisijaiset ja toissijaiset lihasryhmät
- tarvittavat välineet ja harjoitusympäristö
- kokemustaso ja tekninen vaikeus
- kuormitustyyppi ja kehon alue
- yksipuolinen/kaksipuolinen tieto
- sarja-, toisto-, aika- tai matkapohjainen suoritusmuoto
- turvalliset toistoalueet ja sopivat RPE/RIR-alueet
- selkeä tekniikkaohje, tärkeimmät vihjeet ja yleiset virheet
- liikkeen helpotukset, vaikeutukset ja korvaavat liikkeet
- rajoite- ja varoitustagit ilman lääketieteellisiä diagnooseja
- tieto siitä, voiko liikkeen tehdä koti-, ulko- tai saliympäristössä.

Toteuta `ExerciseSubstitutionEngine`, joka valitsee korvaavan liikkeen seuraavassa
järjestyksessä:

1. turvallisuus ja käyttäjän ilmoittamat rajoitteet
2. sama liikemalli ja harjoitusvaikutus
3. käytettävissä oleva välineistö
4. tavoite ja kokemustaso
5. käyttäjän mieltymys.

Korvaus ei saa muuttaa harjoituksen tavoitetta huomaamatta. Näytä käyttäjälle,
miksi liike vaihdettiin.

## 3. Konkreettinen harjoitusresepti

Jokaisen voimaharjoituksen pitää sisältää järjestyksessä:

1. harjoituksen tavoite ja tämän päivän perustelu
2. turvallisuusohjeet ja tarvittaessa oireeseen sopiva stop-ohje
3. yleinen lämmittely
4. kohdennettu liikevalmistelu
5. pääliikkeet
6. tukiliikkeet
7. tarvittava keskivartalo-, liikkuvuus- tai lajia tukeva osuus
8. jäähdyttely vain silloin, kun se tuo oikeaa hyötyä
9. harjoituksen jälkeinen palaute.

Jokaiselle harjoiteliikkeelle näytetään vähintään:

- liikkeen nimi ja järjestysnumero
- sarjat ja tavoitetoistot, kesto tai matka
- tavoitekuorma tai kuorman valintaohje
- koettu rasittavuus selitettynä suomeksi
- arvio jäljelle jäävistä hyvistä toistoista tarvittaessa
- palautusaika sarjojen ja liikkeiden välissä
- tempo vain silloin, kun sillä on ohjelmointitarkoitus
- tekniikkaohje ja stop-ehto
- lämmittelysarjat tarvittaessa
- vaihtoehtoinen liike ja vaihdon perustelu
- mahdollisuus kirjata toteutuneet sarjat yksi kerrallaan.

Älä näytä käyttäjälle pelkkää termiä `RPE`. Käytä esimerkiksi:

> Koettu rasittavuus 7/10 – raskas mutta hallittu; noin kolme hyvää toistoa olisi
> vielä onnistunut.

Pidä RPE- ja RIR-suhde loogisena. Älä vaadi aloittelijalta maksimaalista RPE 10
-harjoittelua tai yhden toiston maksimitestejä.

## 4. Harjoitustyypit

Toteuta uudelleenkäytettävät generaattorit vähintään seuraaville:

- kokovartalon, ylävartalon ja alavartalon voimaharjoitukset
- työntävä/vetävä ja liikejakoon perustuva harjoittelu
- hypertrofia, maksimivoima, perusvoima ja lihaskestävyys
- helppo peruskestävyys
- pitkä kestävyysharjoitus
- kynnys-, tempo- ja intervalliharjoitus
- juoksun tekniikka, vedot ja mäkiharjoittelu
- pyöräilyn peruskestävyys, tempo ja intervalli
- nopeus, kiihtyvyys, hyppy ja teho
- liikkuvuus, kehonhallinta ja palauttava harjoitus
- lajia tukeva fysiikkaharjoitus
- kilpailuun valmistava ja kilpailun jälkeinen harjoitus
- 10, 20 ja 30 minuutin kompakti harjoitus.

Kestävyysharjoituksessa näytetään tavoitteen mukaan:

- aika tai matka
- tehoalue puhetestillä, koetulla rasittavuudella ja mahdollisella sykkeellä
- lämmittely, työosuudet, palautukset ja loppuverryttely
- reitti- tai olosuhdeohje vain, jos tieto on käytettävissä
- keskeytys- ja kevennysohje.

Sykettä ei saa käyttää ainoana tehon mittarina, jos käyttäjä on ilmoittanut
sykkeeseen vaikuttavasta lääkityksestä.

## 5. Tavoitekohtainen ohjelmointi

Säilytä kaikki yhdeksän tavoitetta erillisinä strategioina ja tee strategioista
konkreettisia harjoitusreseptejä.

### BODY_RECOMPOSITION

- yleensä 2–3 kokovartalon voimaharjoitusta
- 2–3 taustaan sopivaa kestävyysharjoitusta
- perusliikemallit tasapainoisesti
- progressio toistoilla, kuormalla ja hallitulla sarjamäärällä
- painon ei tarvitse laskea, jotta ohjelma onnistuu.

### FAT_LOSS

- 2–3 voimaharjoitusta lihasmassan ja voimatasojen suojaamiseksi
- 2–4 taustaan sopivaa kestävyysharjoitusta
- arkiaktiivisuus suhteessa käyttäjän omaan perustasoon
- ei rangaistusharjoittelua tai valtavaa aerobista määrää
- matalan energiansaatavuuden merkit pysäyttävät painonpudotusohjauksen.

### MUSCLE_GAIN

- kokemuksen ja ajan mukaan 3–5 voimaharjoitusta
- lihasryhmäkohtainen viikkovolyymi ja sen asteittainen nousu
- aluksi yleensä noin 8–12 haastavaa sarjaa kohdelihakselle viikossa
- pääosin 1–3 hyvää toistoa varastoon
- progressio ensin toistoilla ja kuormalla, sitten tarvittaessa sarjoilla
- palautumisen estämä lisävolyymi jätetään tekemättä.

### MAX_STRENGTH

- yleensä 3–4 voimaharjoitusta
- pääliikkeissä pääosin 2–6 toistoa
- submaksimaalinen harjoittelu ja e1RM-trendi
- tekniikka- ja tukiliikkeet heikkouksien perusteella
- ei aloittelijan yhden toiston maksimitestiä.

### ENDURANCE

- nykyisestä harjoitusmäärästä alkava 3–6 harjoituksen rakenne
- valtaosa helpoksi tunnistettavaa harjoittelua
- taustan mukaan 1–2 laatuharjoitusta
- kaksi lyhyttä voimaharjoitusta mahdollisuuksien mukaan
- määrää ja tehoa ei nosteta samalla viikolla
- kova lajiharjoitus voi korvata intervallin.

### SPEED_POWER

- 2–3 lyhyttä laadukasta nopeus- tai tehoharjoitusta
- pitkät palautukset ja korkea tekninen laatu
- harjoitus tehdään tuoreena ja lopetetaan ennen suorituskyvyn hajoamista
- 2–3 tavoitetta tukevaa voimaharjoitusta.

### GENERAL_FITNESS

- vähintään kaksi voimaharjoitusta
- säännöllinen aerobinen liikunta
- arjen toimintakyky, toteutettavuus ja jatkuvuus ensisijaisina mittareina.

### POSTURE_MOBILITY

- 2–3 kokovartalon voimaharjoitusta
- 5–10 minuutin kohdennettu harjoitus useana päivänä
- ei lupausta yhdestä täydellisestä ryhdistä
- ei valokuviin perustuvia diagnooseja.

### SPORT_PERFORMANCE

- käytä vain toteutettuja ja testattuja täysiä lajiadaptereita
- laske lajiharjoitukset, kilpailut ja ottelut kokonaiskuormaan
- suojaa tärkeät lajiharjoitukset ja A-kilpailut
- näytä tuntemattomalle lajille yleisen fysiikkatuen rajaus.

## 6. Viikko-ohjelman muodostaminen

`ScheduleOptimizer` sijoittaa harjoitukset päätöshierarkian mukaisesti:

1. turvallisuus
2. valmentajan määräämät harjoitukset, kiinteät lajiharjoitukset ja kilpailut
3. käyttäjän käytettävissä oleva aika
4. päätavoitteen tärkeimmät harjoitukset
5. sivutavoitteiden ylläpito
6. palautuminen ja kuormituksen rytmitys
7. mieltymykset ja välineet.

Pakolliset säännöt:

- kaksi suurta jalkakuormaa ei tule peräkkäisille päiville
- nopeusharjoitusta ei sijoiteta valmiiksi väsyneelle päivälle
- väliin jäänyttä harjoitusta ei korvata tuplakuormalla
- kolme kovaa lajiharjoitusta ja ottelu poistavat ylimääräisen intervallin
- A-kilpailun lähelle ei lisätä uutta raskasta ärsykettä
- kaksi samanaikaista A-huippua vaativat käyttäjän priorisoinnin
- sivutavoite saa ylläpitoannoksen, ei päätavoitteen kanssa kilpailevaa
  maksimivolyymia.

Näytä viikkonäkymässä myös, mikä harjoitus on sovelluksen muodostama, mikä
valmentajan määräämä ja mikä lajiharjoitus tai kilpailu.

## 7. Päivittäinen mukautus

Päivittäinen kuntotarkistus muuttaa vain tämän päivän harjoitusversiota, ei
käyttäjän päätavoitetta.

- GREEN: suunniteltu harjoitus
- YELLOW: määrä 25–40 % pienemmäksi, ei maksimiyrityksiä
- ORANGE_RECOVERY: lepo tai kevyt palauttava harjoitus
- RED_STOP: ei harjoitusta ja oireeseen sopiva toimintaohje
- ajanpuute: valitse 10/20/30 minuutin versio ilman väärää palautumisdiagnoosia
- pelkkä motivaation puute: tarjoa lyhyt aloitus, ei ohjelman peruuttamista.

Kompakti harjoitus säilyttää harjoituksen tärkeimmän tavoitteen. Se ei saa olla
vain täyden harjoituksen ensimmäiset sattumanvaraiset liikkeet.

## 8. Harjoituksen suorittaminen ja kirjaaminen

Rakenna aktiivisesta harjoituksesta oikea vaiheittainen suoritusnäkymä:

- aloita, keskeytä, jatka ja lopeta harjoitus
- näytä yksi harjoitusosio tai liike selkeästi kerrallaan
- kirjaa sarjan toteutuneet toistot, kuorma, aika, matka ja rasittavuus
- merkitse sarja tehdyksi tai ohitetuksi
- käynnistä palautusajastin, mutta salli ohitus
- vaihda liike turvalliseen vaihtoehtoon kesken harjoituksen
- kirjaa kipu, epämukavuus, tekniikan hajoaminen tai muu keskeytyssyy
- tallenna jokainen muutos välittömästi IndexedDB:hen
- säilytä aktiivinen harjoitus sivun sulkemisen, offline-tilan ja PWA:n
  uudelleenkäynnistyksen yli
- estä vahinkopainalluksesta tapahtuva tietojen menetys.

Numerokentissä käyttäjän pitää voida tyhjentää arvo kirjoittamisen ajaksi.
Tyhjää merkkijonoa ei saa muuntaa välittömästi nollaksi. Validoi ja muunna arvo
vasta blurissa, sarjan vahvistuksessa tai lomakkeen tallennuksessa.

## 9. Harjoituksen jälkeinen palaute

Harjoituksen lopuksi kysy lyhyesti:

- koko harjoituksen koettu rasittavuus 1–10 selitettynä
- onnistuiko suunniteltu harjoitus kokonaan, osittain vai ei
- kipu tai muu keskeytyssyy
- koettu tekniikan laatu
- vapaa muistiinpano
- haluaako käyttäjä käyttää palautetta tulevan ohjelman mukauttamiseen.

Historiaan tallentuu ja avautuu yksityiskohtainen yhteenveto:

- suunniteltu ja toteutunut harjoitus rinnakkain
- liikkeet, sarjat, toistot, kuormat, ajat ja matkat
- tehdyt, muutetut, ohitetut ja keskeytetyt osiot
- käyttäjän rasittavuus, tuntemukset ja muistiinpanot
- Haukkarin selitettävä palaute
- mahdollinen vaikutus seuraavaan harjoitukseen tai seuraavan viikon ohjelmaan.

Palaute ei saa tehdä diagnoosia. Esimerkkejä hyväksyttävästä palautteesta:

- “Harjoitus toteutui suunnitellusti. Pidä kuorma ensi kerralla samana ja lisää
  yksi toisto, jos tekniikka säilyy.”
- “Kaksi sarjaa jäi tekemättä ja rasittavuus oli tavoitetta korkeampi. Säilytä
  kuorma seuraavalla kerralla.”
- “Kirjasit kävelyä muuttavan kivun. Juoksua ei ehdoteta ennen tilanteen
  selvittämistä.”

## 10. Progressio ja uudelleenarviointi

Progression pitää käyttää usean harjoituksen trendiä, ei yhtä onnistumista tai
epäonnistumista.

Toteuta vähintään:

- toistoalueeseen perustuva kaksoisprogressio
- kuorman progressio, kun kaikki tavoitesarjat täyttyvät hyväksytyllä
  rasittavuudella ja tekniikalla
- sarjamäärän lisäys vain palautumisen ja toteuman salliessa
- kestävyysmäärän asteittainen nousu nykyisestä perustasosta
- intervallien määrän tai keston progressio, ei kaikkien muuttujien yhtäaikainen
  nosto
- nopeusharjoituksen laadun säilyttäminen määrän sijasta
- 25–40 % kevennys kolmen keltaisen tai kahden oranssin päivän jälkeen
- ohjelman yksinkertaistus, jos toteuma jää noin 70 %:n alle
- korkeintaan yhden olennaisen muuttujan muutos viikossa
- tasanteen arviointi vasta kahden vertailukelpoisen jakson ja riittävän datan
  perusteella
- hallittu paluu tauon, sairauden tai vamman jälkeen ilman menetetyn kuorman
  kiinni ottamista.

Jokainen progressiopäätös tallennetaan suunnitelman seuraavaan versioon
perusteluineen. Aikaisempaa harjoitushistoriaa ei ylikirjoiteta.

## 11. Tietomallit ja moduulit

Toteuta tai täydennä vähintään:

- `AssessmentProfile`
- `Exercise`
- `ExerciseProgression`
- `ExerciseSubstitution`
- `ExercisePrescription`
- `ExerciseSetPrescription`
- `WorkoutBlock`
- `WorkoutTemplate`
- `WorkoutVariant`
- `WorkoutInstance`
- `ActiveWorkoutState`
- `ExerciseSetLog`
- `WorkoutFeedback`
- `WorkoutSummary`
- `ProgramGenerationDecision`
- `ExerciseSubstitutionEngine`
- `WorkoutPrescriptionEngine`
- `WorkoutFeedbackEngine`.

Pidä domain-logiikka Reactin ulkopuolella. Käytä Zodia ulkoisissa ja
lomakerajoissa. Säilytä PostgreSQL ensisijaisena pysyvänä lähteenä sekä Dexie
paikallisena työskentelykantana ja outboxina.

Tietokantamuutokset tehdään uusina Supabase-migraatioina. Kaikissa
käyttäjäkohtaisissa tauluissa on RLS, `user_id`, UUID, aikaleimat, versio ja
tombstone. Testaa käyttäjäeristys suorilla API-kutsuilla.

## 12. Käyttöliittymä

Viimeistele seuraavat näkymät:

1. aloituskartoituksen esikatselu: “Näin vastauksesi vaikuttavat ohjelmaan”
2. ohjelman yhteenveto ja viikkorakenne
3. päivän konkreettinen harjoitusresepti
4. aktiivinen harjoitus sarjakohtaisella kirjauksella
5. liikkeen ohje ja korvaavan liikkeen valinta
6. harjoituksen jälkeinen palautelomake
7. historian yksityiskohtainen harjoitusraportti
8. progression ja seuraavan muutoksen perustelu.

Kaikki käyttäjälle näkyvä teksti on suomeksi. Käytä metrijärjestelmää ja
`fi-FI`-muotoa. Termit kuten RPE, RIR, e1RM, tempo ja tehoalue selitetään
käyttäjälle ensimmäisessä käyttökohdassa ja tarvittaessa avattavassa ohjeessa.

## 13. Kerätyt korjauskohteet

Korjaa osana toteutusta nämä käyttäjätestissä havaitut kohdat:

1. Kuntotarkistuksen käytettävissä olevan ajan numerokenttää ei voi tyhjentää,
   koska tyhjä arvo muuttuu heti nollaksi.
2. Harjoitus-näkymässä ei ole vielä oikeaa treeniohjelmaa liikkeineen, sarjoineen,
   toistoineen, kuormineen ja palautuksineen.
3. Kuntokartoituksen kaikkien olennaisten tietojen pitää aidosti vaikuttaa
   harjoitusohjelmaan ja liikevalintoihin.
4. Pelkkä lyhenne RPE ei riitä; näytä “Koettu rasittavuus 1–10” ja ymmärrettävä
   asteikko.
5. Harjoitushistorian merkinnästä pitää avautua suunnitellun ja toteutuneen
   harjoituksen yhteenveto sekä käyttäjän ja Haukkarin palaute.

## 14. Testimatriisi

Toteuta taulukko-ohjatut testit ainakin yhdistelmille:

- kaikki yhdeksän päätavoitetta
- aloittelija, jonkin verran kokenut ja edistynyt
- koti ilman välineitä, rajatut välineet ja täysi kuntosali
- 10, 20, 30, 45, 60 ja 90 minuutin aika
- 2, 3, 4, 5 ja 6 harjoituspäivää
- ei lajia, täysi tuettu laji ja tuntematon laji
- ei rajoitetta, ylävartalon rajoite, alavartalon rajoite, kävelyä muuttava kipu,
  sykkeeseen vaikuttava lääkitys ja korkean tehon estävä turvallisuustieto
- normaali, keltainen, oranssi ja punainen päivä
- verkkoyhteys, offline, uudelleenkäynnistys, retry ja kahden laitteen konflikti.

Testaa vähintään:

1. Jokainen muodostettu harjoitus sisältää konkreettisen reseptin.
2. Liikkeet käyttävät vain käyttäjän välineitä.
3. Estetty tai sopimaton liike korvataan perustellulla vaihtoehdolla.
4. Kompakti versio säilyttää harjoituksen tärkeimmän tavoitteen.
5. Aloittelija ei saa yhden toiston maksimitestiä tai perusteetonta RPE 10 -työtä.
6. Kaksi suurta jalkakuormaa eivät tule peräkkäin.
7. Kiinteä lajikuorma vähentää päällekkäistä harjoittelua.
8. A-kilpailun lähelle ei tule uutta raskasta ärsykettä.
9. Huono palautuminen keventää päivän harjoitusta mutta ei vaihda tavoitetta.
10. Kävelyä muuttava kipu estää juoksun ja raskaan alavartalotyön.
11. Tyhjä numerokenttä pysyy muokkauksen aikana tyhjänä eikä muutu nollaksi.
12. Aktiivinen harjoitus ja sarjalokit säilyvät offline-uudelleenlatauksessa.
13. Saman sarjan tai harjoituksen synkronointi on idempotentti.
14. Historia säilyttää suunnitelman, toteuman, palautteen ja aiemmat versiot.
15. Käyttäjä A ei pääse käyttäjän B harjoitusresepteihin tai lokeihin.
16. Selitettävä palaute vastaa tallennettua toteumaa eikä keksi tietoja.

Älä löysennä nykyisiä testejä saadaksesi uutta toteutusta vihreäksi.

## 15. Toteutusvaiheet

### Vaihe A – mallit ja liikebibliografia

- aukkoanalyysi
- uudet domain-tyypit ja Zod-skeemat
- tietokantamigraatiot ja RLS
- riittävän laaja, ei-arkaluonteinen liike-seed
- liikkeiden korvaus- ja progressiosäännöt
- unit- ja RLS-testit.

### Vaihe B – ohjelman muodostaminen

- kuntokartoituksen tyypitetty ohjelmointiprofiili
- tavoitekohtaiset konkreettiset harjoitusreseptit
- viikko-ohjelman optimointi
- täysi, kevennetty ja kompakti variantti
- testimatriisi kaikille tavoitteille ja kokemustasoille.

### Vaihe C – aktiivinen harjoitus

- liike- ja sarjakohtainen käyttöliittymä
- palautusajastin ja liikkeen vaihto
- offline-säilyminen ja optimistinen tallennus
- Android-, iPhone- ja näppäimistötestit.

### Vaihe D – palaute, historia ja progressio

- harjoituksen jälkeinen palaute
- suunniteltu–toteutunut-vertailu
- harjoitushistorian yksityiskohtainen näkymä
- usean harjoituksen trendiin perustuva progressio
- selitettävät seuraavan harjoituksen ja viikon päätökset.

### Vaihe E – kokonaisvarmennus

- lint, format-check ja TypeScript
- kaikki unit- ja integraatiotestit
- puhdas Supabase-migraatio ja RLS/API-testit
- offline- ja kahden selainkontekstin synkronointitestit
- Playwright Androidilla, WebKit-iPhonella ja työpöydällä
- tuotantobuild ja PWA-build-portti
- dokumentaatio ja rehellinen rajoitelista.

Jatka vaiheesta toiseen itsenäisesti, jos et kohtaa kustannuksiin,
tietosuojaan, ulkoiseen palveluun, tunnuksiin tai julkaisuun liittyvää käyttäjän
päätöstä vaativaa estettä.

## Valmis-määritelmä

Työ on paikallisesti valmis vasta, kun:

- käyttäjän kartoitus tuottaa yksilöllisen ja perustellun viikko-ohjelman
- jokainen harjoitus sisältää oikeat liikkeet ja täsmällisen reseptin
- kaikki tuetut tavoite-, kokemus-, aika-, väline- ja rajoiteyhdistelmät tuottavat
  turvallisen tuloksen tai selkeän fallbackin
- päivän kuntotarkistus muuttaa konkreettista harjoitusta oikein
- käyttäjä voi suorittaa ja kirjata harjoituksen sarja kerrallaan offline-tilassa
- historia näyttää suunnitelman, toteuman ja palautteen
- palaute vaikuttaa tulevaan progressioon vain määritettyjen sääntöjen kautta
- mitään aiempaa historiaa ei ylikirjoiteta
- RLS ja synkronointi estävät tiedon katoamisen ja käyttäjien välisen pääsyn
- kaikki testit, tuotantobuild ja PWA-portti läpäisevät
- toteutettu, paikallisesti testattu, pilvessä testattu ja ulkoista varmennusta
  vaativa osuus on raportoitu erikseen.

Älä julkaise, muuta DNS:ää, luo maksullisia resursseja, commitoi tai pushaa
muutoksia ilman käyttäjän nimenomaista lupaa.
