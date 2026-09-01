# Haukkarin aikuisten voimaharjoittelun tutkimus- ja hyväksyntäraportti

**Raporttiversio:** 2.0  
**Hakupäivä:** 27.8.2026  
**Arvioitu kohde:** `codex/training-engine-v2`, etähaaran HEAD `31204a7ef2e2685712a5396b7f1a67cc197d3e9c`; moottori- ja sisältöbaseline `cf14c7cea42be939b7fd2cec550af501208676ec`, moottori `adult-resistance-1.0.0`, sisältöjulkaisu `adult-resistance-v1.0.0` (`INTERNAL_BETA`)  
**Rajaus:** 18–64-vuotiaiden itsenäinen, ei-kuntouttava voimaharjoittelu; ei juoksua, ravitsemusta, juniori- tai lajivalmennusta  
**Arvioinnin luonne:** tutkimussynteesi ja teknisen hyväksynnän viitespesifikaatio; ei terveydenhuollon ammattihenkilön lausunto

> **Toteutusauditointi 27.8.2026:** Repository avattiin julkiseksi auditoinnin aikana. Commit `cf14c7ce` kloonattiin puhtaasti ja arvioitiin ilman koodi-, commit-, push-, merge- tai julkaisumuutoksia. Auditoinnin lopussa etähaara päivittyi committiin `31204a7e`; ainoa ero on CI:n reminder-function-proben muuttaminen POST-pyynnöksi. `src`, `training-content`, riippuvuudet ja kaikki auditoitu moottorikoodi ovat identtiset, joten moottorihavainnot koskevat myös uutta HEADia. `npm run check` läpäisi sisältövalidoinnin, lintin, formatoinnin, tyypityksen, 138 yksikkötestiä, 8 integraatiotestiä, tietosuojaskannauksen, tuotantobuildin ja PWA-portin. Tämän lisäksi ajettiin kaikki 40 hyväksyntätapausta ja 50 000 determinististä ominaisuustapausta siemenellä `0x48a2c17d`. Selain-E2E:tä ei voitu ajaa tässä työtilassa loppuun, koska Playwrightin selainbinaarien lataus aikakatkaistiin; ensimmäinen ajo pysähtyi yksinomaan puuttuviin selaimiin.

## 1. Johdon tiivistelmä selkokielellä

Haukkarin perusratkaisu on oikeansuuntainen. Deterministinen annostelu, RIR/RPE, kipuilmoitus, päivän kuntotarkistus, kuormahistorian varovainen käyttö, aikabudjetti ja päätösloki ovat juuri niitä rakenteita, joita ensimmäinen turvallinen beta tarvitsee. LLM:n pitäminen erossa varsinaisesta annostelupäätöksestä on hyvä arkkitehtuurivalinta.

Tutkimus ei tue sitä, että tavallisen aikuisen ohjelman pitäisi olla monimutkainen. Vuoden 2026 ACSM:n position stand kokosi 137 systemaattista katsausta ja yli 30 000 osallistujaa: säännöllisyys, riittävä ponnistelu, kaikkien suurten lihasryhmien harjoittaminen ja asteittainen eteneminen ovat tärkeämpiä kuin erikoistekniikat. Voiman kannalta raskaammat kuormat, 2–3 sarjaa, täysi hallittu liikerata, pääliikkeiden tekeminen alussa ja vähintään kaksi harjoituskertaa viikossa parantavat tuloksia. Lihaskasvussa viikkovolyymi on tärkeä; noin 10 sarjaa lihasryhmää kohti on näyttöön perustuva tavoitetaso, mutta ei turvallinen automaattinen cold start jokaiselle.

Ensimmäisessä betassa ei pidä määrätä failure-harjoittelua. Se ei ole tarpeen voiman tai lihaskasvun saavuttamiseksi, ja 2–3 toistoa varastoon on järkevä oletus. Aloittelijalle käytetään aluksi 3–4 RIR:ää, koska RIR-arvio on opittava taito. Kuormaa ei päätellä kehonkoosta eikä anneta kilogrammoina ilman liike- ja käyttäjäkohtaista historiaa.

**27 liikettä voi riittää ensimmäiseen rajattuun betaan.** Se ei kuitenkaan riitä vain siksi, että luku on 27. Jokaisella sallitulla välineprofiililla on muodostuttava järkevä koko kehon viikko, ja jokaiselle pakolliselle liikemallille on oltava käyttökelpoinen vaihtoehto. Jos esimerkiksi kotikäyttäjälle ei ole kivutonta vetoa tai lonkkadominanttia vaihtoehtoa, kirjasto ei ole hyväksyttävä, vaikka liikkeitä olisi 100. Laajaa sadan liikkeen kirjastoa ei tarvita ennen ensimmäistä betaa.

Haukkarin pitää erottaa neljä terveystilannetta: normaali aloitus, konservatiivisesti mukautettu aloitus, harjoittelun lykkäys ja ammattilaisarvio sekä välitön keskeytys ja kiireellinen hoito. Rintakipu, tajunnanmenetys, vaikea tai selittämätön hengenahdistus, äkillinen halvausoire, äkillinen erittäin voimakas päänsärky ja vakava vamma eivät ole ohjelmointiongelmia vaan sovelluksen toimivallan loppu.

## 2. Alustava hyväksyntäpäätös

### Päätös toteutuksesta `cf14c7ce`: `NO-GO IHMISBETAAN`

- **Valvottu vaihe 0:** ei vielä. Seitsemän P0-tason hyväksyntäaukkoa on suljettava ja ajettava uudelleen ennen ensimmäistä oikeaa harjoitusta.
- **Itsenäinen suljettu beta:** ei vielä. Kaikkien P0- ja P1-porttien, selain- ja staging-porttien sekä ulkopuolisen ihmisarvioinnin on läpäistävä.
- **Tutkimuskonsepti:** `GO KORJAUSTEN JÄLKEEN`. Deterministinen perusarkkitehtuuri on käyttökelpoinen, mutta nykyinen toteutus ei vielä täytä raportin beta-sopimusta.
- **40 tapausta:** 15 PASS, 10 FAIL, 14 NOT IMPLEMENTED ja 1 PARTIAL.
- **50 000 tapausta:** determinismi, alle 18 vuoden esto, health override, band-kg-suoja, tarkkojen kilojen cold-start-esto, välineraja, vasta-aiheraja, lämmittely ja failure-esto läpäisivät. Aikabudjetti ylittyi 2 503 tapauksessa, joista 723 muuten tuetussa 18–64/GREEN–YELLOW-rajauksessa. Lisäksi 65+-, ORANGE- ja RED-rajat puuttuivat keskitetystä prescription-API:sta.

### Vakavuusluokat

| Luokka | Merkitys | Esimerkki |
|---|---|---|
| P0 | Estää kaiken ihmisillä testaamisen | käyttäjätietojen sekoittuminen, terveysrajan ohitus, vaarallinen annostelu, väärälle käyttäjälle kohdistuva ohjelma |
| P1 | Estää itsenäisen suljetun betan | puutteellinen session prescription, liikevaihdon puute, aikabudjetin toistuva ylitys, kuorman arvaaminen |
| P2 | Korjattava ennen laajempaa julkaisua | suppea liikevalikoima, heikko selitys, puutteellinen saavutettavuus tai analytiikka |
| P3 | Myöhempi parannus | edistyneet periodisointimuodot, laajemmat liikevariaatiot, esteettiset optimoinnit |

## 3. Täsmällinen kohderyhmä ja poissulut

### Hyväksyttävä ensimmäisen betan kohderyhmä

Kaikkien ehtojen on täytyttävä:

1. Ikä 18–64 vuotta.
2. Käyttäjä pystyy ymmärtämään kirjalliset harjoitusohjeet, tekemään itsenäisiä päätöksiä ja keskeyttämään harjoituksen oireen vuoksi.
3. Tavoite on yleinen lihaskunto/terveys, perusvoima tai lihasmassan kasvattaminen.
4. Harjoittelu on kehonpaino-, vastuskuminauha-, käsipaino- tai tavallista kuntosaliharjoittelua.
5. Käyttäjä läpäisee hyväksytyn esiseulonnan ja vahvistaa ennen jokaista harjoitusta, ettei terveydentila ole olennaisesti muuttunut.
6. Käyttäjällä ei ole lääkärin määräämää liikuntarajoitusta, valvotun harjoittelun vaatimusta eikä akuuttia vammaa tai sairautta.
7. Käyttäjä hyväksyy, ettei Haukkari diagnosoi, kuntouta eikä korvaa ammattilaisen arviota.

### Ensimmäisen betan poissulut

- alle 18- ja vähintään 65-vuotiaat;
- raskaus ja synnytyksen jälkeinen vaihe, kunnes niille on oma arvioitu sisältö;
- sairauskohtainen liikuntahoito, vamman kuntoutus, tuore leikkaus, murtuma tai merkittävä akuutti vamma;
- epävakaa sydän-, verenkierto-, hengitys-, aineenvaihdunta- tai neurologinen sairaus;
- selittämätön rintakipu, pyörtyminen, rasitukseen liittyvä presynkopee, uusi tai poikkeava hengenahdistus, rasitukseen liittyvä rytmihäiriötuntemus, äkillinen suorituskyvyn lasku;
- lääkärin asettama liikkumis- tai kuormitusrajoitus;
- oire tai lääkitys, jonka vaikutuksesta käyttäjä ei tiedä, voiko hän harjoitella itsenäisesti;
- kilpavoimanosto, kehonrakennuskilpailuun valmistautuminen, painonveto tai lajikohtainen suorituskykyvalmennus;
- pakonomainen harjoittelu tai tilanne, jossa käyttäjä ei kykene noudattamaan lepo- ja keskeytysohjeita;
- päihtymys.

Ikä, sukupuoli, paino, BMI tai kehotyyppi eivät yksin kiellä liikettä eivätkä määrää kuormaa.

### Betan sisäinen lisärajaus

- Vaiheessa 1 enintään 3 voimaharjoitusta viikossa.
- Vaiheessa 2 enintään 4 harjoitusta viikossa; 5 päivän ohjelmat testataan ensin vain synteettisesti ja kokeneiden valvotuissa tapauksissa.
- Ensimmäisten kahden viikon aikana ei määrätä alle 6 toiston työsarjoja aloittelijalle tai uudelleen aloittavalle eikä kenellekään ilman luotettavaa liikehistoriaa.

## 4. Tutkimusmenetelmä ja lähteet

Haku tehtiin 27.8.2026. Etusijalla olivat viralliset suositukset, position stand -asiakirjat, systemaattiset katsaukset, meta-analyysit ja alkuperäiset vertaisarvioidut tutkimukset. Kaupallisia blogeja ei käytetty päätössääntöjen perustana.

Keskeinen lähde on vuoden 2026 ACSM:n position stand. Se on umbrella review: mukana oli 137 systemaattista katsausta, yli 30 000 tervettä vähintään 18-vuotiasta, 6–52 viikon harjoitusinterventiot ja hakuaineisto lokakuuhun 2024 asti. Sen vahvuus on aineiston laajuus ja systemaattinen näyttöluokitus. Sen rajoitus on, että suuri osa tutkimuksista koski nuoria tai vähän harjoitelleita ja yksilötason annostelun tarkat rajat jäävät epävarmoiksi.

WHO, UKK-instituutti ja Käypä hoito tukevat vähintään kahta viikoittaista suuria lihasryhmiä kuormittavaa harjoituskertaa. PAR-Q+ arvioitiin esiseulonnan työkaluna. Terveysturvallisuudessa käytettiin lisäksi ACSM:n preparticipation-seulonnan periaatteita sekä suomalaisia päivystys- ja oireohjeita.

## 5. Näyttötaulukko

| Päätöskysymys | Keskeinen lähde ja väestö | Näytön vahvuus | Epävarmuus | Haukkarin konservatiivinen sääntö |
|---|---|---:|---|---|
| Onko voimaharjoittelu hyödyllistä? | ACSM 2026, 137 katsausta, >30 000 tervettä aikuista | vahva | yksilöllinen vaste vaihtelee | vähintään 2 viikoittaista koko kehoa kattavaa ärsykettä |
| Voima | ACSM 2026; Currier 2023 NMA | vahva–kohtalainen | täydellinen “optimi” epävarma | pääliike alussa, 2–3 sarjaa; raskaat kuormat vasta historian jälkeen |
| Lihaskasvu | ACSM 2026; Pelland 2026; Schoenfeld 2017 | kohtalainen | yläraja ja yksilöllinen sieto epävarmoja | cold start 4–8 laskennallista sarjaa/lihaskunta/vko, tavoite 8–12, beta-katto 16 |
| Frekvenssi | WHO/UKK; ACSM 2026; Pelland 2026 | vahva terveyssuositukselle, kohtalainen optimoinnille | hypertrofiassa volyymin tasaus pienentää frekvenssivaikutusta | useimmat lihakset/liikemallit 2 kertaa viikossa; voimatavoitteessa pääliike 2–3 kertaa |
| Kuorma | ACSM 2026; Lopez 2021 | vahva voimalle, kohtalainen hypertrofialle | prosentit eivät vastaa kaikilla samaa toistomäärää | perusvoimassa 4–8 toistoa vasta historian jälkeen; muuten 6–15/8–15 |
| Failure | ACSM 2026; Refalo 2023; Grgic 2021 | kohtalainen | failure-määritelmät ja toteutunut RIR vaihtelevat | failurea ei määrätä; yleisesti 2–3 RIR, aloittavalle 3–4 |
| RIR:n käyttö | Lovegrove 2022; Bastos 2024 | rajallinen–kohtalainen | aineisto pääosin nuoria ja miehiä; tarkkuus heikkenee kaukana failuresta | RIR opetetaan; progressio vaatii kaksi yhdenmukaista altistusta ja tekniikkapassin |
| Palautus | Singer 2024; Grgic 2018 | kohtalainen | liikekohtaiset erot, ACSM 2026 ei löytänyt yhdenmukaista päävaikutusta | isot/voimapainotteiset 2–3 min, muut 60–120 s; lepoa ei leikata aikapulan vuoksi |
| Liikerata | ACSM 2026; Pallarés 2021 | kohtalainen | yksilöllinen anatomia ja kipu | kivuton, hallittu, käyttäjän nykyinen täysi liikerata; ei pakotettua syvyyttä |
| Tempo | ACSM 2026; Schoenfeld 2015 | kohtalainen | hyvin hitaasta harjoittelusta niukasti aineistoa | hallittu eksentrinen noin 2–3 s, tarkoituksellinen mutta ei räjähtävä konsentrinen; ei pakkoa tarkkaan sekuntitempoon |
| Progressio | ACSM 2009 ja 2026 | kohtalainen periaatteelle, heikompi tarkalle algoritmille | optimaalista yksilöalgoritmia ei ole | “2 altistusta” -sääntö, pienin sallittu kuormahyppy, ei usean muuttujan yhtäaikaista nostoa |
| Turvallisuus | ACSM 2026; Niemeijer 2020 | kohtalainen | haittatapahtumaraportointi epätäydellistä | seulonta, oiretriage, tekniikkastoppi, konservatiivinen cold start ja haittatapahtumarekisteri |
| Lyhyt harjoitus | Nuzzo 2024; ACSM 2026 | kohtalainen sille, että pieni annos on parempi kuin ei mitään | ei yhtä optimaalista 10 min rakennetta | säilytä lämmittely ja 2 tärkeintä liikemallia; älä pakkaa lepoja pois |

## 6. Harjoittelun prescription-määrittely

### 6.1 Koneelliset käyttäjäluokat

Luokitus tehdään todennettavasta harjoitushistoriasta ensisijaisesti ja itsearviosta toissijaisesti. Epävarmassa tilanteessa valitaan konservatiivisempi luokka.

| Luokka | Sisäänmenokriteerit | Päivitys |
|---|---|---|
| `NOVICE` täysin aloittelija | alle 8 strukturoitua voimaharjoitusta viimeisen 12 kk aikana tai ei osaa arvioida RIR:ää/liiketekniikkaa | aikaisintaan 8 hyväksytysti kirjattua harjoitusta ja vähintään 4 viikkoa |
| `RETURNING` uudelleen aloittava | aiemmin vähintään 12 viikkoa säännöllistä harjoittelua, mutta tauko vähintään 8 viikkoa | 4–6 hyväksyttyä paluuharjoitusta ilman kipu- tai palautumisongelmaa |
| `LOW_EXPERIENCE` vähän harjoitellut | 8–47 harjoitusta viimeisen 6 kk aikana tai keskimäärin alle 2 kertaa viikossa | vähintään 12 viikkoa ja 24 toteutunutta harjoitusta |
| `REGULAR` säännöllisesti harjoitellut | vähintään 2 harjoitusta/vko viimeiset 6 kk; liike- ja kuormahistoria riittävä | säilyy, ellei tauko tai data osoita muuta |
| `EXPERIENCED_NONCOMP` kokenut ei-kilpaurheilija | vähintään 2 vuotta säännöllistä harjoittelua, viimeiset 6 kk vähintään 2 kertaa/vko, luotettava kuorma- ja RIR-kirjaus | ei automaattista ylennystä kilpailijaksi; yli 8 viikon tauko -> `RETURNING` |

Luokka ei ole pysyvä henkilön ominaisuus. Se voi olla myös liikekohtainen: kokenut saliharjoittelija voi olla uudessa teknisessä liikkeessä `NOVICE`.

### 6.2 Tavoitekohtainen cold start ja tavoitetaso

“Laskennallinen sarja” tarkoittaa: pääkohdelihakselle 1,0 sarjaa ja selvästi kuormittuvalle synergistille 0,5 sarjaa. Tämä on käyttökelpoinen tuoteoletus, ei biologinen totuus.

| Tavoite | Cold start | Tavoitetaso historian jälkeen | Toistot | RIR | Palautus |
|---|---|---|---|---|---|
| Yleinen lihaskunto/terveys | 2 koko kehon harjoitusta/vko; 1–2 työsarjaa/liike; 4–8 laskennallista sarjaa/päälihas/vko | 2–3 kertaa/vko; 6–10 sarjaa/päälihas/vko | pääosin 8–15 | 3–4 alussa, sitten 2–3 | 90–150 s pääliikkeet, 60–90 s muut |
| Perusvoima | 2 kertaa/vko; 2 sarjaa/pääliike; ei alle 6 toistoa ilman historiaa | 2–3 altistusta/pääliike/vko; 4–8 laadukasta sarjaa/liikemalli/vko | 6–10 alussa, 4–8 kun tekniikka ja historia riittävät | 3 alussa, sitten 2–3 | 2–3 min pääliikkeet, 90–120 s muut |
| Lihasmassa | 2–3 kertaa/vko; 4–8 laskennallista sarjaa/päälihas/vko | 8–12, tarvittaessa enintään 16 sarjaa/päälihas/vko betassa | useimmiten 6–15, vakaissa liikkeissä 10–20 | 3 alussa, sitten 2–3 | 2 min moninivelliikkeet, 60–120 s eristävät |

Beta-katto on 16 laskennallista työsarjaa lihasryhmää kohti viikossa ja 6 samaa päälihasryhmää kuormittavaa työsarjaa yhdessä harjoituksessa. Nämä ovat konservatiivisia tuoterajoja. ACSM:n kuvaama 18–20 viikkosarjan jälkeen jyrkkenevä vähenevä rajahyöty ei ole tavoite ensimmäiselle betalle.

| Tavoite | Liikevalinta | Progression ensisijainen vipu | Viikkobudjetti |
|---|---|---|---|
| Yleinen lihaskunto/terveys | koko kehon suuret liikemallit, helposti opittavat ja vaihdettavat liikkeet; eristävät vain tarpeeseen | toistot -> pieni kuormannousu; sarjoja lisätään harvoin | vähintään 4 ja tavallisesti 6–10 laskennallista sarjaa/päälihas |
| Perusvoima | 2–4 tavoiteliikettä tai niiden läheistä variaatiota, tärkein ensin; avustavat tukevat eivätkä korvaa pääliikettä | tekniikka -> toistot -> kuorma; sarjat pidetään yleensä 2–3/liike | yleensä 4–8 laadukasta sarjaa/pääliikemalli, beta-katto 10 |
| Lihasmassa | moninivelliikkeet + vain tarvittavat eristävät, jotta päälihasryhmät saavuttavat volyymitavoitteen | toistot -> kuorma -> yksi sarja, tässä järjestyksessä | cold start 4–8, tavoite 8–12, ehdoton beta-katto 16/päälihas |

### 6.3 Jokaisen session pakollinen tuloste

Jokainen liikeolio sisältää:

- yksilöivä `exercise_content_id` ja sisältöversio;
- liikkeen nimi ja tarvittavat välineet;
- järjestysnumero;
- lämmittelysarjat ja niiden tarkoitus;
- työsarjat;
- toisto tai toistoalue;
- tavoite-RIR tai siitä johdettu RPE;
- kuorma vain, kun sama liike, sama välinevariantti ja luotettava historia täyttävät kuormaportin;
- palautusaika;
- suoritusohje, hengitysohje ja 1–3 havaittavaa laatukriteeriä;
- keskeytys-, kevennys- ja vaihtosääntö;
- vähintään yksi ennalta hyväksytty vaihtoehto;
- arvioitu kesto ja koko session kesto;
- reason code -tiedot.

**Kuormaportti:** kilogrammasuositus sallitaan vain, jos samalla käyttäjällä on samasta tarkasta liikevariantista vähintään kaksi hyväksyttyä altistusta viimeisen 56 päivän aikana, kuorma ja toteutuneet toistot on kirjattu, vähintään yhden työsarjan RIR on kirjattu, kipulippua ei ole ja kuorma ei perustunut epäonnistuneeseen sarjaan. Vastuskuminauhalle ei koskaan tulosteta kilogrammoja; käytetään nauhan tunnistetta ja venytys-/kiinnitysohjetta.

### 6.4 Referenssi-session prescription

Alla oleva ei ole väite Haukkarin nykyisestä tulosteesta vaan hyväksyntätestin odotettu referenssi.

**Käyttäjä:** `REGULAR`, tavoite yleinen lihaskunto, sali, 45 min, normaali valmius, ei oireita, luotettava käsipaino- ja laitehistoria.

| # | Liike | Lämmittely | Työ | Kuorma | Lepo | Laatu ja stoppi | Vaihto | Kesto |
|---:|---|---|---|---|---:|---|---|---:|
| 1 | Goblet-kyykky | 1×8 kevyesti | 2×8–12 @ RIR 3 | viime hyväksytty kuorma; ei automaattikorotusta | 120 s | polvi ja jalkaterä samaan suuntaan, hallittu kivuton syvyys; lopeta jos terävä/paheneva kipu | jalkaprässi tai tuolilta nousu | 7 min |
| 2 | Käsipaino-RDL | 1×8 kevyesti | 2×8–12 @ RIR 3 | viime hyväksytty kuorma | 120 s | selkä hallittuna, kuorma lähellä vartaloa; lopeta jos säteilevä kipu/puutuminen | lantionnosto | 7 min |
| 3 | Rintatuettu soutu | 1×10 kevyesti | 2×8–12 @ RIR 2–3 | historiasta | 90 s | ei nykäisyä, lapaluun hallinta | taljasoutu/kuminauhasoutu | 6 min |
| 4 | Käsipainopenkki | 1×8 kevyesti | 2×8–12 @ RIR 2–3 | historiasta | 120 s | ranne kyynärvarren päällä, hallittu kivuton liikerata | korotettu punnerrus/laitepunnerrus | 7 min |
| 5 | Ylätalja | 1×8 kevyesti | 2×8–12 @ RIR 2–3 | historiasta | 90 s | veto eteen rintakehän suuntaan, ei niskan taakse | avustettu leuanveto/kuminauhatalja | 6 min |
| 6 | Dead bug | 1 harjoitussarja | 2×6–10/puoli, noin RIR 3 | kehonpaino | 60 s | hengitys jatkuu, alaselän hallinta | lyhyt vipu / heel tap | 5 min |
| 7 | Suitcase carry | ei erillistä | 2×20–30 m/puoli @ RPE 6–7 | historiasta tai käyttäjän valinta | 60 s | pystyasento ja tasainen askel; laske paino hallitusti | paikallaan pito | 4 min |

**Alkulämmittely:** 4 min kevyt yleislämmittely + nivelten kivuttomat liikeradat.  
**Arvioitu kokonaisaika:** 42 min; 3 min turvapuskuri.  
**Reason codes:** `GOAL_GENERAL`, `FULL_BODY_COVERAGE`, `HISTORY_LOAD_ALLOWED`, `RIR_CONSERVATIVE`, `TIME_BUFFER_OK`, `CONTENT_VERSION_LOCKED`.

### 6.5 Palautus, tempo ja liikelaajuus

- Pääliikkeet ja 4–8 toiston voimasarjat: 120–180 s.
- Muut moninivelliikkeet: 90–150 s.
- Eristävät, keskivartalo ja kantaminen: 60–120 s.
- Supersarjoja saa käyttää vain toisistaan vähän häiritseville liikkeille, jos tekniikka ja tavoite-RIR säilyvät. Kahden raskaan koko kehon liikkeen supersarjaa ei käytetä ensimmäisessä betassa.
- Aikabudjetin vuoksi poistetaan sarja tai apuliike; määrättyä vähimmäispalautusta ei leikata.
- Toisto tehdään hallitusti. Tuoteoletus on noin 2–3 s eksentrinen vaihe, lyhyt hallittu suunnanvaihto ja tarkoituksellinen konsentrinen vaihe ilman heilahdusta. Sekuntitarkka tempo ei ole pakollinen.
- Räjähtävää nostoa, olympianostoja tai ballistista harjoittelua ei käytetä tässä betassa.
- Liikerata on käyttäjän kivuton ja hallittu nykyinen liikerata. Tavoitteena on täysi liikerata, mutta syvyyttä tai nivelkulmaa ei pakoteta eikä osittaista liikerataa käytetä kivun peittämiseen.

### 6.6 Lyhennetyt harjoitukset ja ehdoton aikabudjetti

Kestoarvio lasketaan: yleislämmittely + liikevalmistelu + arvioitu suoritusaika + kaikki määrätyt palautukset + siirtymät + vähintään 10 % puskuri. Jos arvio ylittää budjetin, tulosta ei saa julkaista.

| Budjetti | Rakenne | Säilyy aina | Ensin poistetaan | Työsarjakatto |
|---:|---|---|---|---:|
| 10 min | 2 min lämmittely + 2 liikettä, 1–2 sarjaa | yksi alavartalo- ja yksi ylävartalomalli; viikkokierto täydentää kattavuuden | kaikki eristävät ja kantaminen | 4 |
| 20 min | 3 min lämmittely + 3 liikettä | vähintään polvi/lonkka + työntö/veto; vuorottelu viikolla | eristävät, kolmas sarja | 6 |
| 30 min | 4 min lämmittely + 4–5 liikettä | molemmat vartalon puolet ja core viikon mukaan | eristävät, lisäsarja | 8–10 |
| 45 min | 4–6 min lämmittely + 5–7 liikettä | koko kehon perusmallit | eristävät, kantaminen, kolmas sarja | 12–15 |
| 60 min | 5–8 min lämmittely + 6–8 liikettä | koko keho ja tavoitekohtaiset pääliikkeet | pienimmän prioriteetin apuliike | 16–18 |
| 90 min | 6–10 min lämmittely + enintään 8 liikettä | tavoitteen mukainen työ; aikaa ei tarvitse täyttää | mitään ei lisätä vain kellon täyttämiseksi | 20–24 |

Prioriteetti: terveysraja > lämmittely > tärkein pääliike > vastakkainen pääliikemalli > viikon puuttuva liikemalli > core/kanto > eristävä liike.

## 7. Progression ja regression deterministiset säännöt

### 7.1 Toistojärjestys (“double progression”)

1. Aloita toistoalueen alapäästä ja tavoite-RIR:stä.
2. Jos kaikki sarjat valmistuvat, tekniikka hyväksytään, kipu harjoituksen aikana on 0–2/10 eikä oire ole pahempi seuraavana päivänä, lisää seuraavalla altistuksella ensisijaisesti yksi toisto yhteen tai useampaan sarjaan alueen sisällä.
3. Kuormaa saa lisätä vasta, kun kaikki työsarjat yltävät toistoalueen yläpäähän kahdessa peräkkäisessä altistuksessa ja toteutunut RIR on vähintään tavoitealueella.
4. Yhdellä altistuksella muutetaan vain yhtä päämuuttujaa: toistot, kuorma tai sarjat — ei kahta tai kolmea yhtä aikaa.

### 7.2 Kuorman muutos

- Käytä pienintä käytettävissä olevaa nousua.
- Ylävartalon liikkeissä tavoitenousu on noin 2–5 %, alavartalon liikkeissä noin 2–10 %; ehdoton beta-katto yhdelle nousulle on 10 %.
- Jos välineen pienin porras ylittää 10 %, kuormaa ei nosteta automaattisesti. Käytetään lisää toistoja, toista välinettä tai hyväksyttyä vaikeampaa variaatiota.
- Kuorma pidetään ennallaan, jos suoritus osuu alueelle ja RIR on tavoitealueella.
- Seuraavaa kuormaa pienennetään 5–10 %, jos sarja jää toistoalueen alle, toteutunut RIR on 0–1, tekniikka hajoaa tai käyttäjä keskeyttää kuorman vuoksi.
- Epävarma RIR kirjataan `RIR_UNCERTAIN`; se ei yksin oikeuta kuormannostoon.

### 7.3 Sarjojen lisääminen ja volyymirajat

Sarja lisätään vain, jos:

- tavoite edellyttää lisää volyymia;
- käyttäjä on ollut tavoite-RIR:ssä vähintään kaksi viikkoa;
- ei ole pahenevaa kipua, palautumisongelmaa tai suorituskyvyn laskua;
- harjoitus mahtuu aikabudjettiin palautuksia lyhentämättä;
- käyttäjä on alle tavoite- ja beta-kattojen.

Kun nykyinen volyymi on alle 10 laskennallista sarjaa/lihaskunta/vko, lisätään enintään 1 sarja/lihaskunta/vko. Kun volyymi on vähintään 10, lisätään enintään pienempi arvoista 2 sarjaa tai 20 %. Tämä on konservatiivinen tuotesääntö, ei todistettu biologinen kynnys.

### 7.4 Vaikea tai epäonnistunut harjoitus

- Yksi odotettua vaikeampi harjoitus ilman kipua: toista sama annos tai siirry rep-alueen alapäähän; ei progressiota.
- Kaksi peräkkäistä vaikeaa altistusta samassa liikkeessä: kuorma −5–10 % tai yksi sarja pois; reason `REPEATED_HARD`.
- Yksi teknisesti epäonnistunut sarja: sarja lopetetaan; jäljellä olevat sarjat vaihdetaan regressioon tai jätetään pois.
- Paheneva paikallinen kipu tai uusi neurologinen oire: liike ja tarvittaessa koko harjoitus keskeytetään terveystason mukaan.

### 7.5 Päivän valmius

| Valmius | Kriteeri | Muutos |
|---|---|---|
| normaali | ei olennaista muutosta, korkeintaan lievä DOMS | suunnitelma ennallaan |
| alentunut | huono uni/stressi, tavallista suurempi mutta lievä DOMS, ei varoitusmerkkiä | ei progressiota; RIR +1; sarjoista −20–30 % |
| selvästi alentunut | useita palautumistekijöitä, voimakas yleinen väsymys, suorituskyky selvästi heikompi | lyhyt versio; sarjoista −40–50 %; ei raskaita 4–6 toiston sarjoja |
| terveydellinen stoppi | kuume, akuutti infektio, rintakipu, pyörtyminen, selittämätön hengenahdistus tai muu taso 3/4 | ei harjoitusta |

### 7.6 Väliin jääminen ja tauolta paluu

- Yksi väliin jäänyt harjoitus: sitä ei ahdeta seuraavaan päivään eikä viikkovolyymeja “makseta takaisin”. Jatketaan seuraavasta sopivasta harjoituksesta.
- 8–14 vrk tauko: ensimmäinen viikko sarjoista −25 %, ei kuormaprogressiota.
- 15–27 vrk tauko: sarjoista −30–40 %, kuormasta tyypillisesti −5–10 % historian puitteissa.
- 28–55 vrk tauko: kahden viikon paluujakso, 1–2 sarjaa/liike, RIR 3–4.
- vähintään 56 vrk tauko: luokka `RETURNING`; vanha kilogrammahistoria näkyy käyttäjälle, mutta sitä ei käytetä automaattisena työkuormana ennen kahta uutta kalibrointia.

### 7.7 Palautumisviikko

Automaattista kalenteriin sidottua deloadia ei käytetä aloittelijoille. Reaktiivinen 5–7 päivän palautumisviikko käynnistyy, jos ilman sairautta täyttyy vähintään kaksi seuraavista: suoritus heikkenee kahdessa peräkkäisessä harjoituksessa vähintään kahdessa liikkeessä, palautumiskysely on selvästi alentunut kolmesti seitsemän päivän aikana, tai lihas-/nivelarkuus ei palaudu ennen seuraavaa altistusta. Tällöin volyymi −40–50 %, RIR 4, kuorma ennallaan tai −5–10 %. Näyttö deloadin tarkasta toteutuksesta on heikko, joten sääntö on palautumista suojaava tuotevalinta.

## 8. Liikevalikoiman puuteanalyysi

### 8.1 Johtopäätös 27 liikkeestä

**27 voi edelleen olla riittävä lukumäärä rajattuun beta-1:een, mutta nykyinen koostumus ei vielä läpäise kattavuusporttia.** Julkaistu sisältö sisältää 27 yksilöityä `PUBLISHED`-liikettä, ja jokaisella on vähintään yksi substitution-koodi. Liikemallijakauma on: kyykky 6 (mukaan lukien kahden mallin single-leg-liikkeet), hinge 4, vaakatyöntö 3, vaakaveto 3, pystytyöntö 2, pystyveto 3, single-leg 3, pohje 1, anti-extension 2 ja anti-rotation 2.

Todetut aukot:

- kehonpaino-only-profiilissa ei ole yhtään vetoliikettä; 20 min cold start tuotti siksi vain kyykyn ja työntöliikkeen;
- kantamista tai epäsymmetristä pitoa ei ole lainkaan eikä puutetta selitetä reason codella;
- side support / sivulankku puuttuu, joten keskivartalon lateraalinen rooli jää kattamatta;
- raportin referenssitulosteissa käytetyt lattiapunnerrus, rintatuettu soutu ja sivunosto puuttuvat;
- liikeohjeissa ei ole systemaattista hengitysohjetta eikä yksikään julkaistu liike ole vielä nimettynä ihmisasiantuntijan tekniikka-arvioima;
- vaihtoehtoverkko on teknisesti eheä, mutta kaikkien vaihtojen liikemallivastaavuutta ja oirekohtaisen turvallisuuden järkevyyttä ei ole ihmisarvioitu.

Johtopäätös ei ole “lisää kymmeniä liikkeitä”. Korjaa ensin kehonpainon vetokattavuus joko sallitulla välineoletuksella/selkeällä välinevaatimuksella, lisää 2–4 tarkasti valittua aukon sulkevaa liikettä tai rajaa kyseinen profiili eksplisiittisesti. Sen jälkeen aja koko viikon kattavuus uudelleen.

### 8.2 Pakollinen kattavuusmatriisi

Jokaisella tuetulla välineprofiililla pitää pystyä valitsemaan vähintään yksi turvallinen liike kustakin pakollisesta perusmallista ja ainakin yksi vaihtoehto, jos ensisijainen liike ei sovi. Kanto voidaan korvata staattisella epäsymmetrisellä pidolla.

| Liikemalli | Kirjaston minimiroolit | Hyväksynnän ehto |
|---|---:|---|
| Polvidominantti | vähintään 3: tuettu regressio, perusliike, kuormitettava progressio | koti- ja saliprofiilissa vähintään yksi; kipuvaihdolle toinen |
| Lonkkadominantti | vähintään 3 | lantionnosto-/hinge-perheestä kivuton vaihtoehto ilman pakkoa levytankoon |
| Vaakatyöntö | vähintään 3 | kevennettävä kehonpaino/DB/laite tai vastaava |
| Pystytyöntö | vähintään 2 | pystytyöntö ei saa olla pakollinen, jos olkapääoire; vaakatyöntö ei yksin korvaa koko viikkosuunnittelua |
| Vaakaveto | vähintään 3 | vähintään yksi tuettu ja yksi kotiin soveltuva |
| Pystyveto | vähintään 2 | vähintään yksi säädettävä vastus; ei niskan taakse vetoa |
| Keskivartalon hallinta | vähintään 5 | anti-extension, anti-rotation/side support ja regressiot |
| Kanto/pito | vähintään 2 | kävely tai paikallaan pito, helposti keskeytettävä |

Tämä tekee jo 23 liikettä. Jäljelle jäävät neljä paikkaa pitää käyttää niihin väline- tai oireaukkoihin, jotka käyttäjäkohtainen kombinatorinen testi paljastaa. Jos jokin profiili jää tyhjäksi, 27 ei riitä juuri nykyisellä koostumuksella.

### 8.3 Liikekohtaisen sisältöolion pakolliset tiedot

Jokaisesta 27 liikkeestä on oltava: kohderyhmä, liikemalli, pää- ja synergistilihasryhmät, taitoluokka, välineet, kuormamuoto, regressiot, progressiot, sallitut korvaajat, ei-suositella-tilanteet, 1–3 näkyvää laatukriteeriä, hengitysohje, kipu-/oirevaihto, arvioitu sarjakesto, lämmittelyvaatimus ja sisältöversion hyväksyjä.

### 8.4 Liikemallien yleiset laatu- ja vaihtosäännöt

| Malli | Laatukriteeri | Vaihda/kevennä, jos |
|---|---|---|
| Polvidominantti | jalkapohja hallittu, polven suunta vakaa, liikerata kivuton | kipu lisääntyy toisto toistolta, tasapaino pettää, syvyys vaatii hallinnan menetystä |
| Lonkkadominantti | liike lonkasta, kuorma hallittu lähellä vartaloa, selkäasento pysyy käyttäjän hallittuna | säteily, puutuminen, äkillinen selkä-/takareisikipu, ote määrää tekniikan |
| Työntö | ranne/kyynärvarsi linjassa, olkapään liikerata kivuton, ei pakotettua ala-asentoa | terävä olkapää-/rintakipu, puutuminen, nivelkipu pahenee |
| Veto | ei nykäisyä, lapaluun ja kyynärpään hallinta, niska neutraalina | veto niskan taakse, kyynär-/olkapääkipu pahenee, vartalo kompensoi voimakkaasti |
| Core | hengitys jatkuu, vartalon asento säilyy, liike lopetetaan ennen hallinnan pettämistä | selkäkipu tai paineoire kasvaa, hengitys pakottuu pitkäksi pidätykseksi |
| Kanto/pito | pystyasento, turvallinen reitti ja hallittu painon lasku | huimaus, ote pettää, askel muuttuu epävakaaksi, ympäristö ei ole turvallinen |

## 9. Terveydellinen esiseulonta

### 9.1 PAR-Q+:n käyttö

Vuoden 2025 PAR-Q+ on käyttökelpoinen valmis seulontapolku, mutta sitä ei saa muokata ja kutsua omaksi PAR-Q+:ksi. Virallisen aineiston mukaan koko lomake on käytettävä muuttamattomana, eikä sitä saa kopioida osaksi omaa sähköistä kyselyä tai johdannaista.

**Suositus ensimmäiseen betaan:**

1. Ohjaa käyttäjä viralliseen PAR-Q+/ePARmed-X+-polkuun tai anna alkuperäinen täydellinen lomake erillisenä muuttamattomana aineistona.
2. Tallenna Haukkariin vain käyttäjän vahvistama lopputulos, päivämäärä, lomakeversio ja mahdollinen ammattilaisarvion tarve — ei lomakkeen sisältöä kopioituna.
3. Lisää erillinen, juridisesti ja lääketieteellisesti tarkastettu Haukkarin oma “voinko aloittaa tämän harjoituksen tänään?” -turvakysely. Sitä ei kutsuta PAR-Q+:ksi.
4. Jos Haukkari myöhemmin haluaa upottaa tai automatisoida PAR-Q+:n, pyydetään oikeudenhaltijalta kirjallinen lupa.

### 9.2 Nelitasoinen päätösmalli

| Taso | Käyttäjän ymmärtämä kriteeri | Sovelluksen toiminta |
|---|---|---|
| 1 Normaali | ei uusia oireita, ei kuumetta/akuuttia sairautta, tavallinen vointi, enintään lievä DOMS | normaali prescription |
| 2 Konservatiivinen | vakaa tuttu lievä tuki- ja liikuntaelinoire 0–2/10, lievä DOMS, huono uni/stressi tai pitkä tauko ilman varoitusmerkkejä | regressio/vaihto, RIR +1, sarjoja −20–50 %, ei progressiota |
| 3 Lykkää ja arvioon | uusi tai paheneva kipu, tuore vamma/leikkaus, kuume/akuutti infektio, selittämätön huimaus, rasitukseen liittyvät uudet sydän-/hengitysoireet, lääkärin rajoitus, uusi lääkitys jonka vaikutus on epäselvä | ei harjoitusta; ohje terveydenhuoltoon tai pätevälle ammattilaiselle; ei diagnoosia |
| 4 Keskeytä ja kiireellinen apu | kova/äkillinen rintakipu, vaikea hengitysvaikeus, tajuttomuus/pyörtyminen, äkillinen halvausoire tai puhehäiriö, äkillinen erittäin voimakas päänsärky poikkeavine oireineen, vakava vamma/virheasento/runsas vuoto | keskeytä heti; Suomessa 112 henkeä uhkaavassa tilanteessa, muut kiireelliset oireet 116117/paikallinen päivystysapu |

### 9.3 Oirekohtaiset päätössäännöt

- **Rintakipu/paine, mahdollinen säteily, kylmä hiki, pahoinvointi tai hengenahdistus:** taso 4.
- **Pyörtyminen/tajunnanmenetys:** taso 4. Presynkopee tai toistuva selittämätön voimakas huimaus: taso 3; jos siihen liittyy rintakipu, rytmihäiriötuntemus tai neurologinen oire, taso 4.
- **Poikkeava hengenahdistus:** vaikea/äkillinen tai puhumisen estävä = taso 4; uusi selittämätön rasitushengenahdistus = taso 3.
- **Sydämentykytys/epäsäännöllinen rytmi:** jos siihen liittyy pyörtyminen, rintakipu tai vaikea hengenahdistus = taso 4; uusi toistuva rasitusoire = taso 3.
- **Kuume/akuutti infektio tai yleisesti sairaa olo:** taso 3, harjoitus lykätään.
- **Äkillinen kova kipu, napsahdus ja toimintakyvyn menetys, virheasento tai painonvarauksen mahdottomuus:** taso 3–4 vamman vakavuuden mukaan.
- **Neurologinen oire:** äkillinen toispuolinen heikkous/puutuminen, suupielen roikkuminen, puhevaikeus tai sekavuus = taso 4. Uusi säteilevä kipu, puutuminen tai lihasheikkous ilman hätäoiretta = taso 3.
- **Nopeasti lisääntyvä yksipuolinen turvotus ja kipu:** taso 3; jos lisäksi äkillinen rintakipu/hengenahdistus = taso 4.
- **Äkillinen erittäin voimakas rasituspäänsärky tai päänsärky neurologisin oirein:** taso 4. Uusi toistuva rasituspäänsärky = taso 3.
- **Vakaa krooninen TULE-kipu:** ei kuulu sairauskohtaiseksi kuntoutukseksi. Jos käyttäjä on saanut luvan itsenäiseen harjoitteluun ja oire pysyy lievänä, tuttuina ja ei-pahenevana, taso 2; muuten taso 3.
- **Lääkitys:** beetasalpaaja voi muuttaa sykevastetta, verenpainelääkitys/nitraatti voi altistaa huimaukselle ja diureetti nestevajaukselle. Haukkari ei muuta lääkitystä eikä käytä sykettä ainoana kuormitusmittarina; epäselvä vaikutus = taso 3.

## 10. Kipu-, DOMS- ja keskeytyssäännöt

| Havainto | Tulkinta sovelluksessa | Toiminta |
|---|---|---|
| tavallinen lihasväsymys, polte, hengästyminen; häviää levolla | odotettu harjoitusvaste | sarja loppuun tekniikkastopin puitteissa |
| DOMS 12–72 h harjoituksen jälkeen, molemminpuolinen/tuttu, ei turvotusta eikä toimintakyvyn selvää menetystä | tavallinen harjoitusarkuus | normaali tai taso 2 voimakkuuden mukaan |
| lievä tuttu paikallinen tuntemus 0–2/10, ei pahene sarjan aikana eikä seuraavana päivänä | seurattava oire | kevennä liikerataa/kuormaa tai vaihda; ei progressiota |
| kipu 3–4/10, pahenee toisto toistolta, muuttaa liikettä tai jää selvästi pahemmaksi seuraavaan päivään | ei hyväksyttävä beta-annos | lopeta liike, vaihda hyväksyttyyn kivuttomampaan; toistuessa taso 3 |
| terävä/repivä kipu, napsahdus, äkillinen voimattomuus, huomattava turvotus, virheasento | mahdollinen akuutti vamma | lopeta harjoitus; taso 3–4 |
| rintakipu, pyörtyminen, vaikea hengenahdistus, neurologinen oire, äkillinen voimakas päänsärky | lääketieteellinen varoitusmerkki | taso 4 |

Kipunumero ei yksin ratkaise tilannetta. Oireen laatu, äkillisyys, paheneminen, toimintakyky ja yleisoireet ohittavat 0–10-luvun. Kroonisen kivun harjoittaminen kivun kanssa voi joissain kuntoutustutkimuksissa olla hyväksyttävää, mutta Haukkarin ensimmäinen beta ei ole kuntoutuspalvelu; siksi sen kipuraja on tarkoituksella konservatiivinen.

## 11. Hyväksyntätestien suunnitelma

### 11.1 Kymmenen täydellistä referenssitulostetta

Seuraavissa prescriptioneissä jokaisen liikkeen laatu- ja kipustoppi määräytyy kohdan 8.4 mukaan. Kaikissa tulosteissa näkyvät lisäksi sisältöversio, moottoriversio, harjoituksen arvioitu kesto, käyttäjän aikabudjetti ja reason codes. Merkintä `ei kg` tarkoittaa, että sovellus pyytää käyttäjää valitsemaan vastuksen, jolla tavoite-RIR saavutetaan; se ei arvaa kuormaa.

**R1 – NOVICE-HOME-GENERAL-20**  
Lämmittely 3 min: paikallakävely 60 s, kivuttomat kyykky- ja käsivarsiliikkeet 60 s, 1 harjoituskierros. Työ: (1) tuolilta nousu 2×8–12 @ RIR 4, kehonpaino, 90 s, vaihto osittain avustettu nousu; (2) korotettu punnerrus 2×6–10 @ RIR 4, 90 s, vaihto seinäpunnerrus; (3) kuminauhasoutu 2×8–15 @ RIR 4, nauhan tunniste mutta ei kg, 75 s, vaihto isometrinen pyyheveto vain jos hyväksytty sisältö; (4) dead bug 1×6/puoli, 60 s, vaihto heel tap. Arvio 18 min + 2 min puskuri. Syyt: `COLD_START`, `NO_LOAD_HISTORY`, `FULL_BODY_MINIMUM`, `TIME_BUFFER_OK`.

**R2 – RETURNING-BAND-GENERAL-30**  
Lämmittely 4 min + yksi kevyt harjoitussarja ensimmäisestä kolmesta liikkeestä. Työ: (1) kuminauha-etukyykky 2×8–12 @ RIR 3–4, 90 s; (2) kuminauha-RDL 2×8–12 @ RIR 3–4, 90 s; (3) kuminauhasoutu 2×10–15 @ RIR 3, 75 s; (4) seisten kuminauhapaine 2×8–15 @ RIR 3, 75 s; (5) Pallof-pito 2×15–25 s/puoli, 60 s. Nauhat tunnisteella, ei kg. Arvio 27 min + 3 min puskuri. Syyt: `BREAK_REENTRY`, `BAND_NO_KG`, `RIR_CONSERVATIVE`.

**R3 – REGULAR-GYM-STRENGTH-45**  
Lämmittely 5 min; pääliikkeisiin 2 noususarjaa noin 40–60 % käyttäjän viime työkuormasta, ei väsymykseen. Työ: (1) kyykkyvariantti 3×5–8 @ RIR 3, historiakuorma jos portti täyttyy, 180 s, vaihto jalkaprässi/goblet; (2) penkkipunnerrusvariantti 3×5–8 @ RIR 3, 150 s, vaihto käsipainopenkki/laite; (3) rintatuettu soutu 2×6–10 @ RIR 2–3, 120 s; (4) dead bug 2×6–10/puoli, 60 s. Arvio 41 min + 4 min puskuri. Syyt: `GOAL_STRENGTH`, `MAIN_LIFT_FIRST`, `HISTORY_LOAD_ALLOWED` tai `NO_LOAD_HISTORY`.

**R4 – EXPERIENCED-GYM-STRENGTH-60**  
Lämmittely 6 min; kahteen pääliikkeeseen 2–3 noususarjaa. Työ: (1) kyykky-/jalkaprässivariantti 3×4–6 @ RIR 2–3, 180 s; (2) penkki-/DB-punnerrus 3×4–6 @ RIR 2–3, 180 s; (3) RDL 2×6–8 @ RIR 3, 150 s; (4) ylätalja 2×6–10 @ RIR 2–3, 120 s; (5) suitcase carry 2×20–30 m/puoli @ RPE 6–7, 75 s. Kilogrammat vain hyväksytystä historiasta. Arvio 55 min + 5 min puskuri. Ei failurea eikä alle 2 RIR:ää. Syyt: `EXPERIENCED_NONCOMP`, `GOAL_STRENGTH`, `FAILURE_NOT_PRESCRIBED`.

**R5 – NOVICE-DB-HYPERTROPHY-30**  
Lämmittely 4 min + yksi kevyt harjoitussarja. Työ: (1) goblet-kyykky 2×8–12 @ RIR 4, ei kg; (2) DB-RDL 2×8–12 @ RIR 4, ei kg; (3) yhden käden DB-soutu tuettuna 2×8–12/puoli @ RIR 3–4, ei kg; (4) DB-lattiapunnerrus 2×8–12 @ RIR 3–4, ei kg; (5) sivulankku polvet maassa 1×15–25 s/puoli. Lepo 90 s pääliikkeissä, 60–75 s coressa. Arvio 27 min + 3 min puskuri. Syyt: `COLD_START`, `GOAL_HYPERTROPHY`, `VOLUME_BELOW_TARGET_RAMP`.

**R6 – REGULAR-GYM-HYPERTROPHY-60**  
Lämmittely 6 min; pääliikkeisiin 1–2 noususarjaa. Työ: (1) jalkaprässi 3×8–12 @ RIR 2–3, 150 s; (2) DB-RDL 3×8–12 @ RIR 2–3, 150 s; (3) rintatuettu soutu 3×8–12 @ RIR 2, 120 s; (4) DB-/laitepunnerrus 3×8–12 @ RIR 2, 120 s; (5) ylätalja 2×10–15 @ RIR 2–3, 90 s; (6) sivunosto 2×12–20 @ RIR 2–3, 75 s; (7) Pallof 2×8–12/puoli, 60 s. Arvio 54 min + 6 min puskuri. Viikkolaskenta tarkistaa 8–12 tavoitesarjaa ja 16 sarjan katon. Syyt: `GOAL_HYPERTROPHY`, `WEEKLY_VOLUME_TARGET`, `NO_FAILURE`.

**R7 – MICRO-10**  
Lämmittely 2 min. Työ A-päivä: tuolilta nousu/goblet 2×8–12 @ RIR 3–4, 75 s; kuminauha-/DB-soutu 2×8–12 @ RIR 3–4, 75 s. Työ B-päivä: lantionnosto/RDL 2×8–12 ja korotettu punnerrus 2×6–12 samoilla säännöillä. Arvio 9 min + 1 min puskuri. Syyt: `TIME_10`, `WEEKLY_ROTATION_COVERAGE`, `ACCESSORIES_REMOVED`.

**R8 – LONG-CAP-90**  
Käyttää R4- tai R6-runkoa tavoitteen mukaan, mutta enintään 8 liikettä ja 24 työsarjaa. Lämmittely 8–10 min, pääliikkeiden palautus 180 s. Jos ohjelma valmistuu 65–75 minuutissa, lisää työtä ei määrätä vain 90 minuutin täyttämiseksi. Syyt: `TIME_IS_MAX_NOT_TARGET`, `SESSION_SET_CAP`.

**R9 – LOW-READINESS-MODIFIED**  
Pohjana käyttäjän normaali R3/R4/R6. Ei kuorma- tai volyymiprogressiota. Työsarjoista −40 %, RIR +1, kaikki alle 6 toiston sarjat muunnetaan 6–10 toistoon kevyemmällä vastuksella, apuliikkeet poistetaan. Lämmittely säilyy. Jos lämmittelyssä vointi huononee, harjoitus keskeytetään. Syyt: `READINESS_LOW`, `VOLUME_REDUCED`, `PROGRESSION_BLOCKED`.

**R10 – PAIN-SWAP**  
Kun yhden liikkeen aikana syntyy 3–4/10 paikallinen tai paheneva kipu ilman lääketieteellistä varoitusmerkkiä: sarja loppuu heti, kuormaa ei lisätä, liike merkitään `PAIN_STOP`, ja käytetään ennalta hyväksyttyä regressiota 1 harjoitussarja @ RIR vähintään 4. Jos regressio on 0–2/10 eikä pahene, tehdään enintään 1–2 työsarjaa; muuten liike poistetaan. Koko session volyymia ei korvata toisella lihasryhmällä. Toistuva oire johtaa tasoon 3. Syyt: `PAIN_OVERRIDES_PREFERENCE`, `EXERCISE_SWAPPED`, `NO_PROGRESSION`.

**Referenssitulosteiden liikedetaljit:**

| Liike/perhe | Väline | Näkyvä laatukriteeri | Ensisijainen regressio/vaihto |
|---|---|---|---|
| tuolilta nousu / kyykky / goblet | tuoli, kehonpaino, DB tai sali | jalkapohja hallittu, polven suunta vakaa, kivuton hallittu syvyys | korkeampi tuoli -> tuettu kyykky -> jalkaprässi liikeprofiilin mukaan |
| jalkaprässi | laite | alaselkä ja lantio pysyvät tuettuina, polvet hallitussa suunnassa | goblet-kyykky tai tuolilta nousu |
| RDL / band-RDL | DB tai nauha | liike lonkasta, vastus lähellä vartaloa, ei säteilyä/puutumista | lantionnosto |
| lantionnosto | kehonpaino/DB | jalkapohjat vakaat, liike kivuton, ei pakotettua yliojennusta | lyhyempi liikerata tai kehonpaino |
| korotettu-/seinäpunnerrus | tukeva taso | vartalo yhtenäisenä, ranne/kyynärvarsi hallittu | korkeampi tuki tai seinä |
| penkki-/DB-/laitepunnerrus | tanko, DB tai laite | kivuton olkapään liikerata, ei pakotettua ala-asentoa | DB-lattiapunnerrus -> korotettu punnerrus |
| kuminauha-/rintatuettu soutu | nauha, DB tai laite | ei nykäisyä, niska rentona, kyynärpää hallittu | kevyempi nauha / pienempi kuorma / tuetumpi asento |
| ylätalja | talja/nauha | veto vartalon etupuolelle, ei niskan taakse, ei heilahdusta | kevyempi ylätalja -> kuminauhaveto tai hyväksytty vaakaveto |
| Pallof-pito | nauha/talja | vartalo ei kierry, hengitys jatkuu | kevyempi vastus tai lähempi kiinnitys |
| dead bug / heel tap | kehonpaino | hengitys jatkuu ja vartalon hallinta säilyy | lyhyempi vipu -> heel tap |
| sivulankku | kehonpaino | hartia ja vartalo hallittu, hengitys jatkuu | polvet maassa -> lyhyempi pito |
| suitcase carry / pito | DB/kahvakuula | pystyasento, tasainen askel, turvallinen lasku | paikallaan pito -> kevyempi kuorma |
| sivunosto | DB/laite | ei heilahdusta, kivuton olkapään liikerata | kevyempi kuorma tai liikkeen poistaminen |

Kaikissa liikkeissä sarja lopetetaan ennen kuin laatukriteeri rikkoutuu. Terävä/paheneva kipu, puutuminen, säteily, äkillinen voimattomuus, huimaus tai yleinen varoitusoire ohittaa liikevaihdon ja siirtää käyttäjän kohdan 9 mukaiseen triageen.

### 11.2 Neljäkymmentä käsin määriteltyä hyväksyntätapausta

Jokaisen rivin täydellinen odotettu prescription muodostuu yllä nimetystä R1–R10-tulosteesta ja rivillä ilmoitetusta muutoksesta. Toteutunut tulos ajettiin commitin `cf14c7ce` julkisen domain-API:n kautta; käyttöliittymään liittyvät havainnot varmennettiin koodipolusta. `NOT IMPLEMENTED` tarkoittaa, ettei vaadittua syötettä tai päätössääntöä ole, ei että tapaus olisi läpäissyt.

| # | Tila | Vakavuus | Toteutunut havainto |
|---:|---|---|---|
| 1 | FAIL | P1 | 20 min cold start tuotti vain `CHAIR_SQUAT` + `ELEVATED_PUSH_UP`, yhteensä 2 sarjaa ja laskennallisesti 6 min; kilogrammaa ei arvattu. |
| 2 | NOT IMPLEMENTED | P1 | Viikkopäivien liikejärjestys ja hypertrofiavolyymin ramppi eivät ole prescription-API:n syötteitä. |
| 3 | NOT IMPLEMENTED | P1 | `RETURNING`-luokkaa tai 10 viikon taukosääntöä ei ole. |
| 4 | FAIL | P1 | Aloittelijan voimaprofiili sai `4–6` toistoa ilman luotettavaa kuormahistoriaa. |
| 5 | NOT IMPLEMENTED | P1 | Kolmen päivän pääliikekiertoa ei muodosteta. |
| 6 | NOT IMPLEMENTED | P1 | Neljän päivän ylä-/alavartalojakoa ja kahta viikkoaltistusta ei muodosteta. |
| 7 | PASS | — | 64 vuoden ikä ei yksin muuttanut liikkeitä tai annosta. |
| 8 | PASS | — | 17-vuotias sai `YOUTH_ENGINE_NOT_AVAILABLE`; prescriptionia ei syntynyt. |
| 9 | FAIL | P0 | 65-vuotiaalle syntyi normaali voimaharjoitus. |
| 10 | NOT IMPLEMENTED | P1 | Yksi 10 min tuloste syntyi, mutta A/B-viikkokiertoa ei ole. |
| 11 | NOT IMPLEMENTED | P1 | 8–12 viikkosarjan jakamista neljälle 20 min päivälle ei mallinneta. |
| 12 | FAIL | P1 | 30 min kehonpainoprofiili tuotti 3 liikettä, 9 sarjaa ja 28 min; odotettu 4–5 liikkeen kattavuus ei täyttynyt. |
| 13 | PASS | — | 90 min profiili tuotti 5 liikettä, 20 sarjaa ja 54 min; aikaa ei täytetty keinotekoisesti. |
| 14 | NOT IMPLEMENTED | P1 | 3/4 päivän beta-frekvenssikattoa ei ole prescription-sopimuksessa. |
| 15 | PASS | — | `BAND_ROW` käytti nauhan vastustasoa eikä kilogrammoja. |
| 16 | PASS | — | Toisen variantin historia ei tuottanut tarkkaa kg-arviota muille liikkeille. |
| 17 | FAIL | P0 | Kahden onnistumisen jälkeen 5 kg -> 6 kg sallittiin: nousu 20 %. |
| 18 | PARTIAL | P1 | Yhden onnistumisen jälkeen kuorma pidettiin, mutta toistoa ei lisätty alueen sisällä. |
| 19 | PASS | — | Puuttuva RIR esti capability- ja progressiokelpoisuuden. |
| 20 | PASS | — | RIR 0 pienensi seuraavan sarjan kuorman 40 -> 37,5 kg. |
| 21 | PASS | — | Kaksi vaikeaa harjoitusta tuotti `REDUCE_LOAD`, yhden sarjan ja yhden RPE-yksikön vähennyksen. |
| 22 | NOT IMPLEMENTED | P1 | Lihaskohtaista +1 sarja/vko -progressiota ei ole. |
| 23 | FAIL | P0 | 16 viikkosarjan kovaa lihaskohtaista kattoa ei ole. |
| 24 | PASS | — | `ScheduleOptimizer` poistaa väliin jääneen harjoituksen eikä kasaa kuormaa; regressiotesti on olemassa. |
| 25 | NOT IMPLEMENTED | P1 | 8–14 vuorokauden taukosääntöä ei ole. |
| 26 | NOT IMPLEMENTED | P1 | 15–27 vuorokauden taukosääntöä ei ole. |
| 27 | NOT IMPLEMENTED | P1 | 28–55 vuorokauden paluublokkia ei ole. |
| 28 | NOT IMPLEMENTED | P1 | 56+ vuorokauden `RETURNING`-sääntöä ei ole; yli 90 päivää vanha capability-data kyllä estää tarkan kg-arvion. |
| 29 | PASS | — | Huono uni + korkea stressi tuotti YELLOW-tilan ja volyymikertoimen 0,6. |
| 30 | NOT IMPLEMENTED | P2 | Lievää DOMS 2/10 -tasoa ei voi syöttää; `soreness` on vain LOW/NORMAL/HIGH. |
| 31 | FAIL | P1 | Voimakas DOMS yksin tuotti vain YELLOW/0,75, ei vaadittua 40–50 % kevennystä tai palauttavaa vaihtoehtoa. |
| 32 | FAIL | P0 | Sarjakohtainen UI kutsuu mukautusta aina `pain=NONE`, `techniqueOk=true`; vaihto estetään ensimmäisen kirjatun sarjan jälkeen. |
| 33 | FAIL | P0 | Domain palauttaa `REFER_SAFETY`, mutta aktiivinen UI ei välitä kipua sarjapäätökseen ja sallii palautesivulta paluun harjoitukseen. |
| 34 | PASS | — | `CHEST_PAIN` tuotti RED_STOP-tilan, päivystysarvion ja 112-ohjeen. |
| 35 | PASS | — | `FAINTING` tuotti RED_STOP-tilan, päivystysarvion ja 112-ohjeen. |
| 36 | PASS | — | `UNUSUAL_BREATHLESSNESS` tuotti RED_STOP-tilan ja kiireellisen arvion. |
| 37 | PASS | — | `FEVER` tuotti RED_STOP-tilan; harjoitusta ei sallittu. |
| 38 | PASS | — | `NEW_NEUROLOGICAL_SYMPTOM` tuotti RED_STOP-tilan, päivystysarvion ja 112-ohjeen. |
| 39 | NOT IMPLEMENTED | P0 | Yksipuolinen pohjeturvotus ja leposärky eivät ole daily check-inin oirevalikoimassa. |
| 40 | FAIL | P0 | “Pystyveto aiheuttaa kipua” ei tuota `OVERHEAD_RESTRICTION`-tagia; kielto ei ole hard constraint, vaikka tämän kerran liikevalinta ei sattunut sisältämään pystyvetoa. |

**Yhteenveto:** 15 PASS, 10 FAIL, 14 NOT IMPLEMENTED ja 1 PARTIAL. Ei-läpäisseissä tapauksissa on 7 P0-, 17 P1- ja 1 P2-havaintoa. Tämä riittää yksin estämään ihmisbetan.

### 11.3 Automaattinen ominaisuus- ja rajatestaus

Muodosta vähintään 50 000 determinististä tapausta yhdistämällä rajaarvot: iät 17/18/64/65, viisi kokemustasoa, kolme tavoitetta, 2–5 päivää, kuusi aikabudjettia, viisi välineprofiilia, neljä valmiustilaa, kuormahistorian tilat, kivun tasot ja terveysliput. Kiinnitä satunnaissiemen raportoitavaan testiajoon.

Pakolliset invariantit:

1. `estimated_duration <= time_budget` kaikissa julkaistuissa harjoituksissa.
2. Lämmittelyä ei poisteta lyhennettäessä.
3. Session ja viikon sarjakatot eivät ylity; suorat ja epäsuorat sarjat lasketaan samalla versioidulla funktiolla.
4. Tason 3/4 terveyslippu estää prescriptionin.
5. Turvallisuusraja ohittaa tavoitteen, mieltymyksen, streakin ja kalenterin.
6. Kilogrammaa ei ole ilman tarkkaa varianttihistoriaa; nauhalla ei koskaan ole kilogrammaa.
7. Kielletty/kipuliputettu liike ei esiinny työsarjana ennen hyväksyttyä uudelleenarviointia.
8. Jokaisessa ei-estetyssä harjoituksessa on vähintään yksi tarkoituksenmukainen työsarja, tai tulos on eksplisiittinen “ei harjoitusta” reason codella — ei hiljaista tyhjää ohjelmaa.
9. Liikejärjestys: lämmittely -> teknisesti/raskaudeltaan tärkeät -> muut -> core/kanto; oirevaihto ei siirrä raskasta liikettä väsyneenä loppuun.
10. Yksi kuorman nousu on pienin välineaskel ja enintään 10 %; jos porrasta ei ole, kuorma ei nouse.
11. Yksi altistus ei riitä kuormaprogressioon.
12. Failurea tai RIR 0:aa ei määrätä.
13. Väliin jäänyttä volyymia ei kasata seuraavaan harjoitukseen.
14. Sama täydellinen syöte + sama moottori- ja sisältöversio = tavutasolla sama päätösobjekti.
15. Uusi sisältöversio ei muuta vanhan harjoituksen tulostetta tai reason code -historiaa.
16. Käyttäjän A ohjelma/kuorma ei koskaan ilmesty käyttäjälle B.
17. Jokaisella tuetulla välineprofiililla viikkosuunnitelma kattaa polvi-, lonkka-, työntö-, veto- ja core-mallit; kantaminen/pito mukana tai eksplisiittisesti perusteltu korvaus.
18. Kaikilla julkaistuilla liikkeillä on vaihtoehto tai reason code, miksi vaihtoehtoa ei ole ja harjoitus estetään.
19. 10/20 minuutin ohjelmat eivät saavuta aikaa lyhentämällä palautusta alle liike- ja tavoitekohtaisen minimin.
20. Terveys- ja kipupäätöksistä jää versioitu, henkilötietosuojan mukainen audit-loki.

#### Toteutunut 50 000 tapauksen ajo

Commit `cf14c7ce` ajettiin kiinnitetyllä siemenellä `0x48a2c17d`. Julkisen prescription-sopimuksen satunnaistetut syötteet kattoivat iät 17/18/64/65, toteutuksen kolme kokemustasoa, kolme tavoitetta, ajat 10/20/30/45/60/90 min, viisi realistista välineprofiilia, neljä readiness-tilaa, neljä rajoitetekstiä ja terveyseston. Toteutuksessa ei ole raportin viittä käyttäjäluokkaa, viikkopäivä-/taukoparametreja, lihaskohtaista viikkovolyymia eikä sarjakohtaista kipusyötettä; siksi näitä ei voitu sisällyttää julkisen API:n ominaisuustilaan. Tämä on itsessään P1/P0-aukko, ei testin vapaaehtoinen rajaus.

| Invariantti | Tulos | Havainto |
|---|---|---|
| determinismi | PASS | 0 tavutason eroa saman syötteen kahdessa ajossa |
| alle 18 vuotta | PASS | 0 prescriptionia |
| `healthBlocked` | PASS | 0 health override -ohitusta |
| lämmittely ja vähintään yksi työsarja | PASS | 0 puuttuvaa lämmittelyä tai tyhjää tuettua ohjelmaa |
| failure/RIR 0 | PASS | 0 määrättyä RIR 0 -sarjaa |
| band-kg ja cold-start-kg | PASS | 0 nauhan kg-tulostetta ja 0 tarkkaa kg-arviota ilman historiaa |
| väline- ja tunnettu vasta-aiheraja | PASS | 0 valittua puuttuvaa välinettä tai parserin muodostaman rajoitetagin vastaista liikettä |
| 65+ beta-raja | FAIL P0 | 10 856 tapausta sai prescriptionin |
| RED_STOP keskitettynä rajana | FAIL P0 | 8 222 tapausta sai voimaharjoituksen domain-API:lta |
| ORANGE_RECOVERY keskitettynä rajana | FAIL P0 | 8 059 tapausta sai voimaharjoituksen domain-API:lta |
| todellinen aikabudjetti | FAIL P1 | 2 503 ylitystä; 723 ylitystä muuten tuetussa 18–64/GREEN–YELLOW-rajauksessa |

Rikkomusmäärät ovat invarianttikohtaisia ja voivat osua samaan generoituun tapaukseen; niitä ei pidä summata erillisiksi käyttäjätapauksiksi.

Nykyinen käyttöliittymä pysäyttää RED_STOP-tilan ja muuntaa tavallisen ORANGE-polun palauttavaksi ennen harjoitusnäkymää. Silti `resolvePrescription` hyväksyy nämä syötteet, joten turvallisuus riippuu kutsujan oikeasta järjestyksestä. P0-invariantin pitää olla keskitetty ja mahdoton ohittaa uudella käyttöliittymä-, synkronointi- tai API-polulla.

Aikavirheen juurisyy on kahden laskurin ristiriita: `AdultResistanceEngine` sovittaa voimaharjoituksen budjettiin oletuksella 35 sekuntia/työsarja, mutta kanoninen `prescriptionDurationSeconds` laskee 60 sekuntia/työsarja. Esimerkiksi muuten tuettu 64-vuotiaan kokeneen GREEN-profiili, 30 min, tuotti kolme liikettä × kolme sarjaa ja kanonisen 32 min keston. Moottori leikkasi näkyvän `durationMinutes`-kentän 30 minuuttiin, vaikka annoksen osat kestivät 32 minuuttia. Korjaus on käyttää yhtä kanonista laskuria sekä sovituksessa että tulostuksessa; kestokenttää ei saa `min()`-leikkauksella naamioida.

Lisäksi käytä mutaatiotestausta tärkeimmille rajoille: testin pitää epäonnistua, jos aikavertailu vaihdetaan `<=` -> `<`, health override poistetaan, band-kg-suoja ohitetaan, käyttäjätunniste vaihdetaan tai progressiokatto nostetaan yli 10 %.

Automaattinen testaus todistaa vain sääntöjen johdonmukaisuutta. Se ei todista lääketieteellistä turvallisuutta, liikkeiden teknistä laatua eikä harjoitusohjelman vaikuttavuutta.

## 12. Ulkopuolisen ihmisarvioijan paketti

Katselmointipaketti jäädytetään yhdeksi muuttumattomaksi zip-/hakemistokokonaisuudeksi. Sen manifestissa on jokaisen tiedoston SHA-256, sisältöversion ja moottoriversion tunniste sekä arviointipäivä.

Pakollinen sisältö:

1. Tämän raportin kohdan 1 yhden sivun tiivistelmä.
2. Kohderyhmä ja poissulut.
3. Tarkka build, commit, moottoriversio, sisältöjulkaisu ja tietokantaskeema.
4. Lähdetaulukko ja epävarmuudet.
5. Käyttäjäluokitus, tavoitesäännöt, volyymilaskenta ja aikamalli.
6. Kaikkien 27 liikkeen sisältöoliot, ohjeet ja vaihtoehtoverkko.
7. Progressio-, regressio-, readiness-, tauko- ja kipusäännöt.
8. Nelitasoinen terveysturvallisuuden päätöspuu täsmällisine käyttöliittymäteksteineen.
9. Kaikki 40 hyväksyntätapausta todellisine JSON-syötteineen ja moottoritulosteineen.
10. Automaattisen invariantti-, raja-, determinismi- ja käyttäjäeristystestauksen raportti.
11. Vähintään 12 ihmisen luettavaksi renderöityä ohjelmaa: jokainen tavoite, aloittelija/kokenut, koti/sali, 10/20/45/60/90 min, matala valmius, kipuvaihto ja puuttuva historia.
12. Tunnetut rajoitukset, poissuljetut käyttötapaukset ja avoimet kysymykset.
13. Arviointilomake.

### Arviointilomake

| Kenttä | Täytettävä tieto |
|---|---|
| Arvioijan nimi |  |
| Koulutus ja pätevyys |  |
| Ammattirooli ja soveltuva kokemus |  |
| Arviointipäivä |  |
| Tarkastettu commit/build |  |
| Moottoriversio |  |
| Sisältöversio |  |
| Arvioinnin rajaus |  |
| Tarkastettujen skenaarioiden numerot |  |
| P0-kriittiset havainnot |  |
| P1-havainnot |  |
| P2/P3-muutokset |  |
| Hyväksytyt käyttötapaukset |  |
| Poissuljetut käyttötapaukset |  |
| Korjausten todentamistapa |  |
| Lopputulos | `HYVÄKSYTTY` / `HYVÄKSYTTY KORJAUKSIN` / `HYLÄTTY` |
| Uuden arvioinnin triggerit | sisältöversio, turvallisuussääntö, annostelulogiikka tai kohderyhmä muuttuu |
| Allekirjoitus / vahvistus |  |

Arvioijalle ei pidä esittää pelkkää sääntötaulukkoa. Hänen pitää nähdä oikeat käyttäjätekstit ja harjoitusnäkymät puhelimen kokoisina, koska turvallinen logiikka voi muuttua käyttöliittymässä vaaralliseksi, jos stop-ohje jää piiloon.

## 13. Ensimmäisen ihmisbetan toteutussuunnitelma

Betan tavoite on arvioida ohjelmien järkevyyttä, ymmärrettävyyttä, ohjelmalogiikan luotettavuutta ja haittoja. Se ei ole kliininen tutkimus eikä todista terveysvaikutuksia.

### Vaihe 0 — valvotut end-to-end-läpikäynnit

- **Osallistujat:** 3–5 henkilöä. Käyttäjä ja hänen vaimonsa voivat olla kaksi ensimmäistä, koska he ovat kokeneita sali- ja kotiharjoittelijoita; mukaan vähintään yksi aloittelija/uudelleen aloittava vasta, kun ammattilainen on paikalla.
- **Kesto:** 1–2 viikkoa, yhteensä vähintään 10 toteutettua harjoitusta ja kaikki kolme tavoitetta simuloituna, vaikka osallistujat eivät itse tavoittelisi kaikkia.
- **Valvonta:** koulutettu valmentaja tai fysioterapeutti seuraa vähintään ensimmäisen liikesuorituksen jokaisesta käytetystä liikkeestä. Tuotetiimi seuraa koko käyttöpolun.
- **Rajaus:** enintään 2–3 harjoitusta/hlö, ei alle 6 toiston työsarjoja, RIR vähintään 3, ei automaattista kuormannostoa.
- **Tavoite:** löytää väärät oletukset, epäselvät tekstit, aikamallin virheet, vaihtoehtojen katkokset ja kirjaus-/synkronointiongelmat.
- **Eteneminen:** kaikki P0/P1 löydökset korjattu ja uudelleentestattu; 100 % ohjelmista alle aikabudjetin laskennassa; 0 käyttäjäeristys- tai health override -virhettä; ihmisarvioija hyväksyy vaiheen 1.

### Vaihe 1 — pieni suljettu pilotti

- **Osallistujat:** 12–20 henkilöä.
- **Jakauma:** 50 % `NOVICE`/`RETURNING`, 50 % `REGULAR`/`EXPERIENCED_NONCOMP`; molempia koti- ja saliprofiileja; vähintään 3 henkilöä kutakin tavoitetta kohti.
- **Kesto:** 4 viikkoa.
- **Annos:** 2–3 voimaharjoitusta/vko, 20–60 min; 10 ja 90 min testataan vain erillisillä hyväksyntäkerroilla.
- **Perehdytys:** 30–45 min videopuhelu tai lähitapaaminen, esiseulonta, RIR-opetus, tekniikkastoppi, hätäohje, tietosuoja, bugi- ja haittailmoitus.
- **Seuranta:** ensimmäinen harjoitus havainnoituna; viikoittainen 10 min check-in; sovelluksen jälkeinen 5 kysymyksen palaute; ongelmayhteys vastaa arkisin 24 tunnissa, P0-ilmoituksiin välittömästi sovitun päivystyskäytännön mukaan.
- **Eteneminen:** vähintään 80 % aloitetuista harjoituksista kirjautuu loppuun tai selkeällä lopetussyyn koodilla; ≥90 % tulosteista ymmärretään ilman lisäselitystä; ≥85 % toteutuneista ajoista mahtuu budjettiin ±10 %; ei vakavaa mahdollisesti sovellukseen liittyvää haittaa; kaikki P1:t suljettu.

### Vaihe 2 — laajennettu suljettu beta

- **Osallistujat:** 40–60 henkilöä, joista 40–50 % aloittelijoita/uudelleen aloittavia.
- **Kesto:** 6–8 viikkoa.
- **Annos:** 2–4 harjoitusta/vko, 10–90 min; 5 päivän ohjelma edelleen vain erikseen hyväksytyille kokeneille, jos sille on todellinen tuotetarve.
- **Tuki:** asynkroninen tukikanava, viikoittainen automaattinen check-in, jokainen kipu-/stop-tapaus manuaaliseen triagejonoon.
- **Eteneminen laajempaan julkaisuun:** 0 P0:aa; crash-free session rate ≥99,5 %; synkronoinnin onnistuminen ≥99 %; 0 väärän käyttäjän tietoa; ≥90 % ohjelmista koetaan järkeviksi; ≥90 % liikevaihdoista onnistuu yhdellä vaihdolla; progressiota ei hylätä liian aggressiivisena yli 10 %:ssa altistuksista; ihmisarvioija hyväksyy lopullisen version.

### Osallistujien valinta ja esiseulonta

- Rekrytoi tarkoituksella sekä kotona että salilla harjoittelevia; älä ota ensimmäiseksi vain erittäin kokeneita ystäviä, koska he korjaavat hiljaa huonon prescriptionin omalla osaamisellaan.
- Käytä virallista PAR-Q+/ePARmed-X+-polkua edellä kuvatulla tavalla ja Haukkarin omaa päivittäistä turvakyselyä.
- Vaiheessa 1 kaikki epäselvä “kyllä”-vastaus ratkaistaan ennen harjoittelua ammattilaisen kanssa. Sovellus ei tulkitse vapaata tekstiä lääketieteelliseksi luvaksi.
- Osallistuja voi lopettaa koska tahansa ilman perustelua.

### Suostumus ja tietosuoja

Suostumuksessa erotetaan palvelun käyttö, tutkimus-/tuotekehityspalaute ja mahdollinen yhteydenotto. Kerätään vain tarpeellinen: käyttäjätunniste, ikäluokka, harjoitushistoria, välineet, prescription, toteuma, RIR/RPE, kipu-/stop-lippu, tekniset lokit ja palaute. Terveystiedot ovat erityisen suojattavia; tietojen minimointi, säilytysajat, pääsynhallinta, poisto- ja tarkastuspyynnöt sekä mahdollinen vaikutustenarviointi ratkaistaan tietosuojavastaavan/juristin kanssa ennen vaihetta 1. Tämä raportti ei ole oikeudellinen arvio.

### Harjoituksen jälkeiset palautekysymykset

1. Ymmärsitkö heti mitä sinun piti tehdä? 1–5.
2. Vastasiko vaikeus tavoite-RIR:ää? liian helppo / sopiva / liian vaikea / en osaa arvioida.
3. Tuntuiko kipua tai muuta oiretta? sijainti, 0–10, laatu, paheniko.
4. Kuinka kauan harjoitus oikeasti kesti?
5. Oliko jokin liike tai ohje epäselvä, sopimaton tai turvattoman tuntuinen?
6. Toimiko vaihtoehto? kyllä / ei / ei tarvittu.
7. Luotatko seuraavaan kuorma-/toistosuositukseen? 1–5 + vapaa kommentti.

### Haittatapahtuma ja läheltä piti

- **Vakava haittatapahtuma:** kuolema, hengenvaarallinen tilanne, päivystys-/sairaalahoito, merkittävä tai pysyvä toimintakyvyn heikkeneminen.
- **Muu haittatapahtuma:** harjoituksen yhteydessä tai jälkeen ilmennyt kipu, venähdys, kaatuminen, turvotus, oireen paheneminen tai terveydenhuoltokontakti riippumatta varmistetusta syy-yhteydestä.
- **Läheltä piti:** vaarallinen ohje tai kuorma havaittiin ennen toteutusta, käyttäjä oli vähällä kaatua/loukkaantua, väärä väline/liike ehdotettiin tai käyttäjä-/historiatieto oli väärä mutta haittaa ei syntynyt.
- **Syy-yhteys:** ei liity / epätodennäköinen / mahdollinen / todennäköinen / varma. Epävarma käsitellään pysäytyspäätöksessä mahdollisena.

Jokaisesta tapahtumasta kirjataan aika, build, prescription, toteutuma, oire, toimenpide, syy-yhteysarvio ja korjaava toiminta. P0-tapahtuma jäädyttää altistavan toiminnon kaikilta, kunnes juurisyy ja regressiotesti on valmis.

### Ehdottomat koko betan pysäytyskriteerit

1. käyttäjien tietojen sekoittuminen tai luvaton näkyminen;
2. terveysrajan ohittuminen;
3. selvästi vaarallinen harjoitusohje;
4. väärälle käyttäjälle kohdistuva kuorma tai harjoitus;
5. toistuva aikabudjetin olennainen ylitys: vähintään 20 % yli budjetin kahdessa saman juurisyyn tapauksessa;
6. vakava haittatapahtuma, jonka yhteyttä sovelluksen ohjeeseen ei voida sulkea pois;
7. automaattinen failure-/RIR 0 -määräys tai kuormahyppy yli 10 %;
8. kielletyn tai kipuliputetun liikkeen uudelleenmääräys ilman hyväksyttyä syytä.

## 14. Pakolliset korjaukset ennen valvottua pilottia

### P0

- Estä 65+ tämän sisältöjulkaisun keskitetystä `resolvePrescription`-rajasta tai laajenna kohderyhmä vasta erikseen arvioidulla sisältöversiolla.
- Tee RED_STOP, ORANGE_RECOVERY ja health override keskitetysti ohittamattomiksi; UI:n ennakkosuoja ei yksin riitä.
- Vie toteutunut kipu ja tekniikan tila `adaptNextSet`-kutsuun. Kipu-/hengitys-/huimausstopin jälkeen harjoitukseen ei saa voida palata ilman uutta hyväksyttyä turvallisuuspäätöstä.
- Estä yli 10 % kuormahyppy. Yhden “todellisen portaan” pitää tulla välinekohtaisesta askelmallista; UI ei saa keksiä pienempää desimaaliporrasta eikä domain sallia 5 -> 6 kg:n 20 % nousua.
- Toteuta lihaskohtainen kova 16 viikkosarjan katto samalla versioidulla laskurilla, jota ohjelmageneraattori käyttää.
- Muuta vapaa rajoiteteksti rakenteisiksi, käyttäjän vahvistamiksi hard constraint -tageiksi; kipukielto ei saa riippua neljästä substringistä.
- Lisää yksipuolisen nopeasti lisääntyvän pohjeturvotuksen/leposäryn lykkäys- ja arvio-ohje tai varmista lääketieteellisesti hyväksytty yleinen red-flag-polku.
- Aja nämä korjaukset uudelleen kaikilla P0-tapauksilla, 50 000 ominaisuustapauksella ja mutaatiotesteillä.

### P1

- Käytä yhtä kanonista aikamallia sekä sovituksessa että tulostuksessa; poista näkyvän keston `min()`-naamiointi ja lisää siirtymä-/säätöpuskurit.
- Estä 4–6 toiston voimablokki aloittelijalta ja käyttäjältä, jolla ei ole luotettavaa liikehistoriaa.
- Toteuta 10/20/30 min ohjelmien viikkokierto ja välineprofiilien koko viikon kattavuus; kehonpainoprofiilin vetokatkos on suljettava tai profiili rajattava.
- Toteuta `RETURNING`, taukojen 8–14/15–27/28–55/56+ päivää, frekvenssikatot ja lihaskohtainen viikkovolyymin progressio.
- Voimakas DOMS ei saa jäädä yhden YELLOW-lipun 25 % kevennykseksi, jos toimintakyky on selvästi heikentynyt.
- Täydennä session prescriptionin pakolliset kentät, hengitysohjeet ja reason codet.
- Aja selain-E2E Chromiumilla ja WebKitillä sekä tietokanta-/staging-portit vihreiksi ympäristössä, jossa testiselaimet ja Supabase ovat käytettävissä.

## 15. Pakolliset korjaukset ennen itsenäistä suljettua betaa

- Kaikki 40 tapausta ajettu korjatusta buildista uudelleen ja jokainen PASS; 50 000 tapauksen ajo tuottaa 0 hyväksyntäinvariantin rikkomusta.
- Kaikki 27 liikettä arvioitu ulkopuolisella pätevällä valmentajalla tai fysioterapeutilla; health triage liikuntalääketieteen osaajalla.
- PAR-Q+/oma seulontaratkaisu sekä käyttöehdot, tietosuoja ja suostumus tarkastettu.
- Haittatapahtuma-, läheltä piti-, stop- ja eskalointiprosessi harjoiteltu pöytätestillä.
- Käyttöliittymätestissä aloittelija osaa löytää sarjat, toistot, RIR:n, palautuksen, kuorman valinnan, vaihtoehdon ja stop-ohjeen ilman suullista apua.
- Synkronointi, offline-/online-siirtymä, duplikaatit ja historiaversiointi läpäisevät testit.

## 16. Myöhemmäksi siirrettävät asiat

- liikevalikoiman kasvatus ilman todettua kattavuusaukkoa;
- automaattinen koneoppiminen;
- edistynyt periodisointi, failure-tekniikat, drop setit, rest-pause, BFR, olympianostot ja power-harjoittelu;
- 65+, raskaus/synnytyksen jälkeinen vaihe, juniorit, sairauskohtaiset ohjelmat ja kuntoutus;
- viiden voimaharjoituspäivän tavalliset ohjelmat;
- lajikohtainen suorituskyky, juoksu, ravitsemus ja painonveto;
- kameralla tehtävä tekniikan automaattiarvio;
- laaja “satojen liikkeiden” kirjasto.

## 17. Priorisoitu toteutusjono

| Järjestys | Työ | Vakavuus | Tuotos |
|---:|---|---|---|
| 1 | Keskitetty 18–64/RED/ORANGE/health safety gate | P0 | ohittamaton domain-raja + mutaatiotestit |
| 2 | Aktiivisen harjoituksen kipu-, tekniikka- ja hätästoppi | P0 | sarjasyötteet, lukittu stop-polku, audit-loki |
| 3 | Kuormahyppy ja 16 sarjan viikkokatto | P0 | välineaskelmalli + lihaskohtainen laskuri |
| 4 | Rakenteiset liikekiellot ja red-flag-polku | P0 | tagit, UI-vahvistus, testit |
| 5 | Yksi kanoninen aikabudjetti | P1 | 10–90 min nollaylitys ilman kentän leikkausta |
| 6 | Cold start, viikkorakenne, tauot ja readiness | P1 | deterministiset säännöt + testit |
| 7 | 27 liikkeen täsmäkorjaukset | P1 | kehonpainoveto/core/kanto tai eksplisiittinen rajaus |
| 8 | 40 + 50 000 uudelleenajo ja selain-/staging-portit | P1 | kaikki PASS, allekirjoitettava raportti |
| 9 | Ulkopuolinen asiantuntijakatselmus | P1 | hyväksyntälomake |
| 10 | Vaihe 0 | P1 | vähintään 10 valvottua harjoitusta |
| 11 | Tietosuoja, suostumus ja haittatapahtumaprosessi | P1 | beta-operointipaketti |
| 12 | Vaihe 1 ja 2 | — | porttipäätökset datan perusteella |

## 18. Definition of Done työvaiheittain

| Työvaihe | Valmis, kun |
|---|---|
| Buildin jäädytys | commit, riippuvuudet, migraatiot, moottori- ja sisältöversio ovat yksiselitteisiä; sama build voidaan toistaa |
| Turvallisuuslogiikka | kaikki taso 3/4-, käyttäjäeristys-, band-kg- ja kuormaporttitestit läpäisevät; mutaatiotesti todistaa testien purevan |
| Prescription | jokainen pakollinen kenttä näkyy sekä JSONissa että käyttäjälle; ei piilossa olevaa olennaista annostelua |
| Liikekirjasto | kaikki 27 sisältöoliota arvioitu; jokainen tuettu välineprofiili tuottaa koko viikon; kielletyille liikkeille on turvallinen vaihtoehto tai eksplisiittinen esto |
| Progressio | kaksi altistusta, RIR-epävarmuus, failure, tauot, readiness ja volyymikatot on testattu rajoilla; mikään kuormahyppy ei ylitä sääntöä |
| Aikabudjetti | 10/20/30/45/60/90 min ohjelmat sisältävät lämmittelyn, levot ja puskurin; arvio ei ylitä budjettia |
| Hyväksyntätestaus | 40 tapausta ovat PASS oikeasta buildista; ominaisuustestit ja determinismi läpäisevät kiinnitetyllä siemenellä |
| Ihmisarviointi | pätevä arvioija allekirjoittaa version ja kaikki ehdolliset korjaukset on suljettu todisteineen |
| Vaihe 0 | 10+ valvottua harjoitusta, 0 P0, kaikki P1 suljettu, ajan ja ymmärrettävyyden kriteerit täyttyvät |
| Vaihe 1 | osallistuja-, kesto-, turvallisuus-, tekniset ja sisältökriteerit täyttyvät; riippumaton porttipäätös dokumentoitu |
| Vaihe 2 | skaalautuvuuskriteerit täyttyvät, ei avointa P0/P1:tä, julkaisuversio arvioitu uudelleen |

## 19. Oikean asiantuntijan päätöstä vaativat avoimet kysymykset

1. Täyttävätkö juuri nykyiset 27 liikettä kattavuus- ja vaihtoehtoverkon vai tarvitaanko muutama täsmäliike?
2. Ovatko jokaisen liikkeen käyttäjäteksti, kuva/video, hengitysohje, regressio ja kipustoppi kliinisesti ja valmennuksellisesti hyväksyttäviä?
3. Hyväksyykö liikuntalääketieteen osaaja nelitasoisen terveystriagen sanamuodot ja 112/116117-ohjauksen?
4. Käytetäänkö virallista PAR-Q+/ePARmed-X+-polkua, vai rakennetaanko juridisesti tarkastettu Haukkarin oma esiseulonta?
5. Onko 0–2/10 beta-kipuraja sopiva rajatulle ei-kuntouttavalle tuotteelle, ja miten seuraavan päivän oire kirjataan?
6. Voidaanko vaiheessa 2 hyväksyä RIR 1 vakaassa laite-/eristävässä liikkeessä kokeneelle, vai pidetäänkö beta kokonaan vähintään RIR 2:ssa? Tämän raportin suositus on jälkimmäinen.
7. Miten henkilötietojen ja terveystietojen roolit, säilytysajat, suostumusperusteet ja poistot toteutetaan Suomen/EU:n vaatimusten mukaisesti?
8. Kuka toimii betaoperaation kliinisenä/valmennuksellisena yhteyshenkilönä ja millä vasteajalla?

## 20. Lähdeluettelo

### Viralliset suositukset ja seulonta

1. Currier BS ym. *American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews.* Med Sci Sports Exerc. 2026;58(4):851–872. [Täysteksti](https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/) · DOI: [10.1249/MSS.0000000000003897](https://doi.org/10.1249/MSS.0000000000003897) · PMID: [41843416](https://pubmed.ncbi.nlm.nih.gov/41843416/).
2. World Health Organization. *WHO Guidelines on Physical Activity and Sedentary Behaviour.* 2020. [Virallinen julkaisu](https://www.who.int/publications/i/item/9789240015128). ISBN 978-92-4-001512-8.
3. Suomalainen Lääkäriseura Duodecim ym. *Liikunta. Käypä hoito -suositus.* Päivitetty 9.6.2026. [Suositus](https://www.kaypahoito.fi/hoi50075).
4. UKK-instituutti. *Aikuisten liikkumisen suositus 18–64-vuotiaille.* [Suositus](https://ukkinstituutti.fi/liikkuminen/liikkumisen-suositukset/aikuisten-liikkumisen-suositus/).
5. PAR-Q+ Collaboration. *2025 PAR-Q+.* [Virallinen muuttamaton PDF](https://eparmedx.com/wp-content/uploads/2025/01/PARQPlus2025ImageFile.pdf) ja [virallinen palvelu](https://eparmedx.com/).
6. Riebe D ym. *Updating ACSM's Recommendations for Exercise Preparticipation Health Screening.* Med Sci Sports Exerc. 2015;47(11):2473–2479. DOI: [10.1249/MSS.0000000000000664](https://doi.org/10.1249/MSS.0000000000000664) · PMID: [26473759](https://pubmed.ncbi.nlm.nih.gov/26473759/).

### Annostelu, kuorma, volyymi ja frekvenssi

7. Currier BS ym. *Resistance training prescription for muscle strength and hypertrophy in healthy adults: a systematic review and Bayesian network meta-analysis.* Br J Sports Med. 2023;57:1211–1220. [Täysteksti](https://pmc.ncbi.nlm.nih.gov/articles/PMC10579494/) · DOI: [10.1136/bjsports-2023-106807](https://doi.org/10.1136/bjsports-2023-106807) · PMID: [37414459](https://pubmed.ncbi.nlm.nih.gov/37414459/).
8. Pelland JC ym. *The Resistance Training Dose Response: Meta-Regressions Exploring the Effects of Weekly Volume and Frequency on Muscle Hypertrophy and Strength Gains.* Sports Med. 2026. DOI: [10.1007/s40279-025-02344-w](https://doi.org/10.1007/s40279-025-02344-w) · PMID: [41343037](https://pubmed.ncbi.nlm.nih.gov/41343037/).
9. Lopez P ym. *Resistance Training Load Effects on Muscle Hypertrophy and Strength Gain: Systematic Review and Network Meta-analysis.* Med Sci Sports Exerc. 2021;53:1206–1216. [Täysteksti](https://pmc.ncbi.nlm.nih.gov/articles/PMC8126497/) · DOI: [10.1249/MSS.0000000000002585](https://doi.org/10.1249/MSS.0000000000002585) · PMID: [33433148](https://pubmed.ncbi.nlm.nih.gov/33433148/).
10. Schoenfeld BJ ym. *Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis.* J Sports Sci. 2017;35:1073–1082. DOI: [10.1080/02640414.2016.1210197](https://doi.org/10.1080/02640414.2016.1210197) · PMID: [27433992](https://pubmed.ncbi.nlm.nih.gov/27433992/).
11. Grgic J ym. *Effect of Resistance Training Frequency on Gains in Muscular Strength: A Systematic Review and Meta-Analysis.* Sports Med. 2018;48:1207–1220. DOI: [10.1007/s40279-018-0872-x](https://doi.org/10.1007/s40279-018-0872-x) · PMID: [29470825](https://pubmed.ncbi.nlm.nih.gov/29470825/).
12. Nuzzo JL ym. *Resistance Exercise Minimal Dose Strategies for Increasing Muscle Strength in the General Population: an Overview.* Sports Med. 2024. [Täysteksti](https://pmc.ncbi.nlm.nih.gov/articles/PMC11127831/) · PMID: [38509414](https://pubmed.ncbi.nlm.nih.gov/38509414/).

### RIR, failure, lepo, liikerata ja tempo

13. Refalo MC ym. *Influence of Resistance Training Proximity-to-Failure on Skeletal Muscle Hypertrophy: A Systematic Review with Meta-analysis.* Sports Med. 2023;53:649–665. [Täysteksti](https://pmc.ncbi.nlm.nih.gov/articles/PMC9935748/) · DOI: [10.1007/s40279-022-01784-y](https://doi.org/10.1007/s40279-022-01784-y) · PMID: [36334240](https://pubmed.ncbi.nlm.nih.gov/36334240/).
14. Grgic J ym. *Effects of resistance training performed to repetition failure or non-failure on muscular strength and hypertrophy: a systematic review and meta-analysis.* J Sport Health Sci. 2022;11:202–211. DOI: [10.1016/j.jshs.2021.01.007](https://doi.org/10.1016/j.jshs.2021.01.007) · PMID: [33497853](https://pubmed.ncbi.nlm.nih.gov/33497853/).
15. Lovegrove S ym. *Repetitions in Reserve Is a Reliable Tool for Prescribing Resistance Training Load.* J Strength Cond Res. 2022;36:2696–2700. DOI: [10.1519/JSC.0000000000003952](https://doi.org/10.1519/JSC.0000000000003952) · PMID: [36135029](https://pubmed.ncbi.nlm.nih.gov/36135029/).
16. Bastos V ym. *Feasibility and Usefulness of Repetitions-In-Reserve Scales for Selecting Exercise Intensity: A Scoping Review.* Percept Mot Skills. 2024;131:940–970. [Täysteksti](https://pmc.ncbi.nlm.nih.gov/articles/PMC11127506/) · DOI: [10.1177/00315125241241785](https://doi.org/10.1177/00315125241241785) · PMID: [38563729](https://pubmed.ncbi.nlm.nih.gov/38563729/).
17. Singer A ym. *Give it a rest: a systematic review with Bayesian meta-analysis on the effect of inter-set rest interval duration on muscle hypertrophy.* Front Sports Act Living. 2024;6:1429789. [Täysteksti](https://pmc.ncbi.nlm.nih.gov/articles/PMC11349676/) · DOI: [10.3389/fspor.2024.1429789](https://doi.org/10.3389/fspor.2024.1429789) · PMID: [39205815](https://pubmed.ncbi.nlm.nih.gov/39205815/).
18. Grgic J ym. *Effects of Rest Interval Duration in Resistance Training on Measures of Muscular Strength: A Systematic Review.* Sports Med. 2018;48:137–151. DOI: [10.1007/s40279-017-0788-x](https://doi.org/10.1007/s40279-017-0788-x) · PMID: [28933024](https://pubmed.ncbi.nlm.nih.gov/28933024/).
19. Pallarés JG ym. *Effects of range of motion on resistance training adaptations: A systematic review and meta-analysis.* Scand J Med Sci Sports. 2021;31:1866–1881. DOI: [10.1111/sms.14006](https://doi.org/10.1111/sms.14006) · PMID: [34170576](https://pubmed.ncbi.nlm.nih.gov/34170576/).
20. Schoenfeld BJ ym. *Effect of repetition duration during resistance training on muscle hypertrophy: a systematic review and meta-analysis.* Sports Med. 2015;45:577–585. DOI: [10.1007/s40279-015-0304-0](https://doi.org/10.1007/s40279-015-0304-0) · PMID: [25601394](https://pubmed.ncbi.nlm.nih.gov/25601394/).

### Turvallisuus ja kipu

21. Niemeijer A ym. *Adverse events of exercise therapy in randomised controlled trials: a systematic review and meta-analysis.* Br J Sports Med. 2020;54:1073–1080. DOI: [10.1136/bjsports-2018-100461](https://doi.org/10.1136/bjsports-2018-100461) · PMID: [31563884](https://pubmed.ncbi.nlm.nih.gov/31563884/).
22. Smith BE ym. *Should exercises be painful in the management of chronic musculoskeletal pain? A systematic review and meta-analysis.* Br J Sports Med. 2017;51:1679–1687. [PubMed](https://pubmed.ncbi.nlm.nih.gov/28596288/).
23. Terveyskirjasto. *Aivohalvaus*, *Laskimotukos*, *Päänsärky* ja *Sepelvaltimotautikohtaus*. [Aivohalvaus](https://www.terveyskirjasto.fi/dlk00001) · [Laskimotukos](https://www.terveyskirjasto.fi/dlk00039) · [Päänsärky](https://www.terveyskirjasto.fi/dlk00322) · [Sydänkohtaus](https://www.terveyskirjasto.fi/dlk00086).
24. Suomi.fi. *Päivystysapu*: henkeä uhkaavissa tilanteissa 112, muut kiireelliset tilanteet 116117. [Palveluohje](https://www.suomi.fi/palvelut/puhelinasiointi/paivystysapu-asiointipalvelut-soita-paivystysapuun-helsingin-kaupunki-sosiaali-terveys-ja-pelastustoimiala/002b94de-ebf1-4a26-b6d3-a71e161b5a9f).

## Lopullinen tiukka johtopäätös

Haukkarin ei tarvitse kasvattaa liikepankkia huomattavasti laajemmaksi. Nykyinen 27 liikkeen paketti on rakenteeltaan siisti ja versionoitu, mutta siinä on täsmällisiä kattavuusaukkoja: kehonpainoprofiilin veto, side support ja kanto/pito. Korjaa nämä muutamalla harkitulla lisäyksellä tai eksplisiittisellä tuoterajauksella; sadan liikkeen kirjasto ei ratkaise moottorin turvallisuus- ja viikkosuunnitteluaukkoja.

Commit `cf14c7ce` ei ole hyväksytty ihmisbetaan. Staattinen laatuportti on vahva ja useat tärkeät suojat toimivat, mutta 40 tapauksesta vain 15 läpäisi. Seitsemän P0-porttia on auki, ja 50 000 tapauksen ajossa todellinen aikabudjetti ylittyi 723 kertaa muuten tuetussa rajauksessa. Tämä ei ole kosmeettinen testivaje.

Järkevin eteneminen on nyt: keskitetyt turvallisuusrajat -> aktiivisen harjoituksen oirestoppi -> kuorma- ja volyymikatot -> yhteinen aikamalli -> viikko-/tauko-/readiness-säännöt -> liikepankin täsmäaukot -> 40 + 50 000 uudelleenajo -> selain- ja staging-portit -> ulkopuolinen katselmus -> 3–5 henkilön valvottu vaihe 0. Vasta kaikkien P0/P1-porttien sulkeuduttua otetaan 12–20 henkilöä itsenäiseen pilottiin.
