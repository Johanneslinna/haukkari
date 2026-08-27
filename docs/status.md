# Toteutustila 27.8.2026

Vaihekohtaisten osioiden testimäärät ovat kyseisen vaiheen hyväksyntähetken
historiallisia lukuja. Nykyinen kokonaismäärä on kirjattu uusimpaan
harjoittelumoottori v2 -osioon.

## Vaihe 0 – valmis

- Uusi Git-repository ja lukittu npm-riippuvuuspuu
- React 19, TypeScript 6, Vite 8, Tailwind CSS 4 ja PWA-perusta
- dev-, lint-, format-check-, typecheck-, unit-, integration-, e2e- ja build-komennot
- arkkitehtuuri, hakemistorakenne, tietomalli, uhkamalli, päätösloki ja oletukset
- `.env.example`, Git-ohitukset ja salaisuusrajat

## Vaihe 1 – paikallisesti valmis

Toteutettu:

- 25 käyttäjäkohtaista taulua sekä yhteinen liikehakemisto
- UUID:t, `user_id`, aikaleimat, tombstonet, versiot ja synkronointi-indeksit
- RLS + FORCE RLS ja select/insert/update/delete-politiikat kaikille käyttäjätauluille
- samaan käyttäjään sidotut yhdistelmäviiteavaimet sekä `user_id`:n vaihtamisen esto
- yksityinen kehityskuvabucket käyttäjäpolitiikoilla
- sähköposti/salasana-rekisteröityminen, vahvistuscallback, kirjautuminen,
  salasanan palautus ja vaihto, istunnon säilytys sekä uloskirjautuminen
- tilin ja kuvien poistava JWT-varmennettu Edge Function
- seed-liikekirjasto, muokattava esimerkkiprofiilifixture ja tietokantatyypit
- kahden käyttäjän pgTAP/RLS-testit valmiina.

Paikallisesti testattu:

- lint, format-check ja TypeScript
- 4 unit-testiä ja 2 React-integraatiotestiä
- 6 Playwright-testiä Chromium-mobiililla, WebKit-mobiililla ja Chromium-työpöydällä
- tuotantokäännös, manifesti ja service workerin generointi
- frontend-bundlen salaisuusskannaus
- Docker Desktop 4.88.0, Docker Engine 29.7.2 ja WSL 2 -ympäristö
- Supabase-migraation puhdas ajo ja toistettava `db reset`
- 14/14 pgTAP-tietokanta- ja RLS-testiä
- kahden oikean JWT-istunnon REST- ja Storage-API-eristystesti
- TypeScript-tietokantatyyppien generointi varmennetusta paikallisskeemasta.

Ei vielä testattu hosted Supabase -ympäristössä:

- sähköpostien toimitus ja vahvistus
- hosted Auth, Storage ja Edge Function
- kahden käyttäjän suorat API-kutsut pilvessä.

Vaiheen 1 paikallinen hyväksyntäportti on suljettu. Hosted-ympäristön varmennus
tehdään erikseen, kun staging-projekti ja sen tunnisteet ovat käytettävissä.

## Vaihe 2 – paikallisesti valmis

Toteutettu:

- Dexie-pohjainen käyttäjäeristetty paikallistietokanta
- atominen tietueen ja outbox-operaation kirjoituspolku sekä optimistinen UI-raja
- asiakas-UUID:t, operaation idempotenssi ja katkenneen kuittauksen palautuminen
- eksponentiaalinen uusintaviive ilman epäonnistuneen muutoksen poistamista
- taulukohtainen vakaa `(updated_at, id)`-pull-kursori
- optimistinen versioehto, tombstonet ja paikallisen/pilvi/yhdistetyn version valinta
- käynnistys-, kirjautumis-, online-, näkyvyys- ja manuaaliset synkronointitriggerit
- Synkronoitu-, Synkronointi kesken-, Offline-, Synkronointivirhe- ja
  Ristiriita vaatii valinnan -tilat sekä viimeisin onnistumisaika
- käyttäjän paikallisten tietojen tyhjennys uloskirjautuessa.

Paikallisesti testattu:

- 7 unit-testiä ja 7 integraatiotestiä
- IndexedDB-säilyminen kannan sulkemisen ja avaamisen yli
- verkkokatko, epäonnistuneen operaation säilyminen ja kuittauksen katoaminen
- kahden laitteen edestakainen synkronointi, versioristiriita ja tombstone
- oikean Supabase Auth/REST/RLS-pinon idempotenssi-, versio- ja kursorisopimus
- kaksi oikeaa Chromium-selainkontekstia, offline-PWA-uudelleenlataus,
  konfliktin käyttöliittymäratkaisu ja poiston välittyminen.

Hosted-pilvisynkronointi on edelleen varmentamatta, koska staging-projektia ja
sen tunnuksia ei ole käytettävissä. Vaiheen 2 paikallinen hyväksyntäportti on
suljettu.

## Vaihe 3 – paikallisesti valmis

Toteutettu:

- yhdeksän erillistä tavoitestrategiaa ja yhteinen selitettävä päätösrakenne
- tavoitteen vaihdon esikatselu, vahvistus, siirtymäviikko ja historian säilytys
- seitsemän tavoitekonfliktia käyttäjän eksplisiittisine kompromissivalintoineen
- juoksun, pyöräilyn ja voimanoston täydet lajisovittimet sekä rajattu yleinen tuki
- nykykuormasta aloittava ohjelmageneraattori ja kiinteän lajikuorman huomioiva
  aikatauluoptimointi
- GREEN-, YELLOW-, ORANGE_RECOVERY- ja RED_STOP-päätökset ilman näennäistä pistettä
- kevennys-, toteuma-, yhden muuttujan ja tasannelogiikka
- käyttäjän hyväksyntää vaativa energiaohjaus sekä matalan energiansaatavuuden esto
- turvallisuusrajojen lähteet ja tuotepolitiikkojen rajaus.

Paikallisesti testattu:

- briefin valmennuslogiikan testit 16–31
- kaikki kahdeksan lueteltua RED_STOP-oiretta ja kävelyä muuttava kipu
- kolmen keltaisen ja kahden oranssin päivän 30 %:n kevennys
- kaikkien tavoitestrategioiden ja 12 täyden lajialalajin rekisteröinti
- `npm run check`: lint, format-check, TypeScript, 60 yksikkötestiä,
  7 integraatiotestiä ja tuotantokäännös
- 6/6 Playwright-regressiotestiä Chromium-mobiililla, WebKit-mobiililla ja
  Chromium-työpöydällä; testipalvelimen elinkaari on Playwrightin hallinnassa.

Domain-logiikka ei diagnosoi, käytä kielimallia päätöksentekoon tai muuta
energiatavoitetta ilman käyttäjän hyväksyntää.

## Vaihe 4 – paikallisesti valmis

Toteutettu:

- responsiivinen sovelluskehys työpöydän sivupalkilla, mobiilin alavalikolla,
  safe area -reunoilla, skip-linkillä ja vähennetyn liikkeen tuella
- vaalea, tumma ja laitteen mukaan vaihtuva teema sekä vähintään 44 px:n
  toimintokohteet
- nelivaiheinen onboarding, joka kysyy briefin lähtö-, tavoite-, harjoitustausta-,
  aika-, väline-, ravinto-, terveys- ja seurantatiedot; terveystietojen suostumus
  annetaan aktiivisesti eikä kuukautisseurantaa esivalita
- Tänään-, kuntotarkistus-, aktiivinen harjoitus- ja viikkonäkymät, mukaan lukien
  täysi, kevennetty sekä 10/20/30 minuutin harjoitusversio
- tavoitteen vaihto esikatseluineen, konflikteineen, vahvistuksineen ja edellisen
  tavoitteen palautuksineen
- laji- ja kilpailukalenteri, ravintokirjaus ja energiaehdotuksen hyväksyntä,
  edistymisen seuranta, tavoiteaikajana ja harjoitushistoria
- muistutusten paikallinen hallinta sekä asetusten, asennuksen, synkronoinnin ja
  omien tietojen näkymät; varsinaiset viennit, ICS, Push ja poistovirrat kuuluvat
  suunnitelman mukaisesti vaiheeseen 5
- PWA-manifesti, oma maskattava SVG-kuvake, asennusohjeet, päivitysilmoitus,
  47 tiedoston precache ja nykyisen clientin haltuun ottava service worker
- käyttäjään sidottu IndexedDB:n alkulataus, joka estää auth-/offline-reloadin
  ohjauskilpailut; onboarding valmistuu vasta koko suunnitelman tallennuksen jälkeen.

Paikallisesti testattu:

- `npm run check`: lint ilman varoituksia, format-check, TypeScript,
  60 yksikkötestiä, 7 integraatiotestiä ja tuotantokäännös
- `npm run e2e:app`: Pixel 7-, iPhone 13 Mini- ja työpöytä-Chrome-ydinpolut,
  työpöydän näppäimistö/skip-link sekä Androidin aktiivisen harjoituksen aito
  offline-uudelleenlataus tuotanto-service workerilla
- kaikki 17 suojattua ydinnäkymää avattu paikallisesti in-app-selaimessa ilman
  runtime-virheitä; onboarding ja Tänään-näkymä tarkistettu myös visuaalisesti.

Vaiheen 4 paikallinen hyväksyntäportti on suljettu. Pilvijulkaisua ei ole tehty,
eikä hosted Supabasea ole muutettu. Seuraava vaihe on tietosuoja-, vienti-, kuva-,
ICS-, muistutus- ja feature flagin takainen Web Push -kokonaisuus.

## Vaihe 5 – paikallisesti valmis

Toteutettu:

- täydellinen versioitu JSON-vienti, validoitu palautus ja taulukohtaiset UTF-8
  CSV-viennit; palautus säilyttää tietueiden UUID-viitteet eikä palauta
  laitesidonnaisia push-avaimia
- yksittäisten kehomittausten pehmeä poisto sekä yksityisten kehityskuvien
  pysyvä poisto
- erillisen suostumuksen vaativa kehityskuvapolku, selainpakkaus, käyttäjä-ID:n
  mukainen Storage-polku ja viiden minuutin allekirjoitettu esikatseluosoite
- valinnainen kuukautiskierron merkintä omalla suostumusvalinnallaan
- sovelluksen sisäiset aikavyöhykkeelliset muistutukset, käyttöönotto/poiskytkentä,
  viikonpäivät sekä toistuva `.ics`-kalenteritiedosto
- oletuksena suljettu `VITE_ENABLE_WEB_PUSH`-feature flag, erillisestä painikkeesta
  pyydettävä lupa, laitekohtainen tilaus ja iPhone-kotisovellusohje
- VAPID-salaisuudet vain palvelinympäristössä, minuutin `pg_cron` + `pg_net` -ajo,
  toimituskuitti ja vanhentuneiden sekä 404/410-tilausten poisto
- kiinteä terveystiedoton näkyvä ilmoitusteksti sekä build-porttiin kuuluva
  vuotoskannaus
- vahvistettu tilin poisto järjestyksessä tietokanta, kuvat, push-tilaukset,
  Auth-käyttäjä, paikallinen IndexedDB/cache, push-unsubscribe ja uloskirjautuminen.

Paikallisesti testattu:

- `npm run check`: lint ilman varoituksia, format-check, TypeScript,
  67 yksikkötestiä, 7 integraatiotestiä, tietosuojaskannaus ja tuotantokäännös
- JSON-vienti/palautus säilyttää tavoitteet, suunnitelmaversiot ja historian;
  push-luvan epääminen ei estä sovelluksen käyttöä
- 14/14 pgTAP/RLS-testiä uuden cron- ja toimituskuittiskeeman jälkeen
- oikea paikallinen delete-account Edge Function poisti kertakäyttäjän tietokannan,
  yksityisen kuvan, push-tilauksen ja Auth-käyttäjän
- send-reminders Edge Function torjui virheellisen cron-kutsun 401:llä ja hyväksyi
  oikean salaisuuden; kutsu ei sisältänyt lähetettävää käyttäjädataa
- Pixel 7 -selainpolussa mittauksen poisto, JSON/CSV-lataukset ja `.ics`-lataus;
  kaikki peruspolut säilyivät Pixel 7-, iPhone 13 Mini- ja työpöytä-Chrome-ajossa
- vienti-, muistutus- ja yksityisten kuvien näkymät tarkistettu näkyvästi
  sovelluksen sisäisessä selaimessa.

Vaiheen 5 paikallinen hyväksyntäportti on suljettu. Web Push on edelleen
feature flagin takana. Pilvijulkaisua, hosted-migraatiota, Vault-salaisuuksia tai
hosted Edge Function -julkaisua ei ole tehty. Seuraava vaihe on vaihe 6:
julkaisuvalmius, staging-varmennus ja operointiohjeet.

## Vaihe 6 – paikallinen osuus valmis, tuotantoportti avoin

Toteutettu:

- näkyvä brändi, PWA-manifesti, ilmoitukset, kalenterit ja viennit käyttävät
  Haukkaria; kanoninen osoite ja Open Graph/Twitter-metatiedot käyttävät
  `https://haukkari.fi/`-osoitetta
- oma tarkistettu `og-haukkari.png`; IndexedDB/Auth/localStorage-nimiavaruudet
  säilyvät päivitysyhteensopivina ja vanha Treenikompassi-JSON-vienti palautuu
- manuaalinen synkronointitila ja `Synkronoi nyt` palautettiin reititettyyn
  Synkronointi-näkymään
- yleisen Playwright-ajon preview-palvelimen elinkaari siirrettiin samaan
  hallittuun käynnistys- ja pysäytyskääreeseen kuin PWA-ajo
- julkaisu-, Supabase-, varmuuskopiointi/palautus-, asennus- ja natiivin
  HealthKit/Health Connect -jatkovaiheen ohjeet.

Paikallisesti testattu puhtaan `db reset` -ajon jälkeen:

- lint, format-check, TypeScript, 71 yksikkötestiä, 7 integraatiotestiä,
  tietosuojaskannaus, normaali tuotantobuild sekä manifestin, 180/192/512 px:n
  asennuskuvakkeiden, maskattavan kuvakkeen, service workerin ja päivityskehotteen
  automaattinen PWA-build-portti
- 6/6 yleistä Playwright-testiä mobiili-Chromiumilla, mobiili-WebKitillä ja
  työpöytä-Chromiumilla
- PWA-matriisissa 5 läpäistyä testiä ja 4 tarkoituksellista laitekohtaista
  ohitusta; Androidin offline-service-worker-polku, iPhone-ydinpolku ja
  työpöydän näppäimistöpolku läpäisivät
- 14/14 pgTAP/RLS-testiä, kahden oikean Auth-käyttäjän REST/Storage-eristys,
  Supabase-synkronointi-integraatio ja kahden erillisen Chromium-kontekstin
  offline-, konflikti- ja tombstone-polku
- paikallinen tilinpoistofunktio poisti DB-, Storage-, Push- ja Auth-tiedot;
  muistutusfunktio varmisti cron-rajan ja vanhentuneen tilauksen tombstonen.

Viimeisessä briefiauditoinnissa lisättiin lisäksi kaikkien vaadittujen domain-
tietomallien TypeScript-sopimukset sekä erillinen
`docs/phase-completion-audit.md`, joka jäljittää testit 1–37 toteutukseen ja
paikalliseen varmennukseen.

Ei testattu eikä muutettu pilvessä:

- hosted Supabasen migraatiot, Auth, SMTP, Storage, Edge Functionit ja kahden
  fyysisen laitteen pilvisynkronointi
- VAPID/Vault/cron oikeassa push-palvelussa, iPhonen todellinen push-toimitus
- hosting, DNS, TLS tai `haukkari.fi`-osoitteen savukoe
- hallittu tietokanta- ja Storage-palautusharjoitus.

Tuotantojulkaisun hyväksyntäportti pysyy avoimena, kunnes staging-ympäristö,
hosting-palvelu, turvalliset tunnukset, rekisterinpitäjätiedot ja käyttäjän
erillinen julkaisulupa ovat käytettävissä. Mitään ei ole julkaistu.

## Harjoittelumoottori v2 – toteutushaara valmis paikalliseen beta-arvioon

Haara `codex/training-engine-v2` rakentaa yhteisen Prescription v2 -sopimuksen,
kerrostetun harjoittelumoottorin sekä sen päälle tavallisen kuntoilun, voiman,
juoksun ja aikuisten amatöörijääkiekon ensimmäisen lajimoduulin. Jääkiekko ei
korvaa yleisiä harjoittelupolkuja. Palautuspiste ennen uudistusta on tagi
`restore/pre-training-engine-v2-2026-08-25` (commit `2644e22`).

Toteutuksessa ovat mukana ehdoton päiväkohtainen aikabudjetti, todelliset
annostyypit, legacy-adapteri, väline- ja kuormayksiköt, kuormituksen oppiminen,
kaksivaiheinen kuntotarkistus, rakenteinen onboarding, suomenkielinen readiness,
PlannerEvent-kalenteri, tulevaisuuteen versioituvat muutokset, harjoitekirjasto,
historia- ja kehitysselitykset, mittausmuistutukset sekä turvallinen profiilin
nollaus ja käyttäjän vaihto.

Uudet beta-moduulit ovat oletuksena pois käytöstä. Ne avataan muuttujilla
`VITE_TRAINING_ENGINE_V2=true` ja jääkiekolle lisäksi `VITE_HOCKEY_BETA=true`.
Turvallisuus- ja aikabudjettikorjaukset pysyvät aina käytössä. Harjoitekirjaston
tarkistamattomia videolinkkejä ei näytetä; jokainen linkki julkaistaan vasta
sisältöarvion jälkeen.

Paikallinen `npm run check` läpäisi lintin, muotoilun, TypeScriptin, 138
yksikkötestiä, 8 integraatiotestiä, tietosuojaskannauksen, tuotantobuildin ja
PWA-portin. `npm run e2e:app` läpäisi 8 ajettua selainpolkua Android-, iPhone- ja
työpöytäprofiileilla; 10 testiä ohitettiin tarkoituksella niissä laiteprofiileissa,
joille kyseistä polkua ei ole määritetty.

Paikallinen tekninen hyväksyntä ei ole julkaisulupa. Suljettu beta edellyttää
vielä valmennuksellista sisältöarviota ja hosted-ympäristön varmennusta. Julkinen
julkaisu edellyttää lisäksi turvallisuus-, tietosuoja- ja tietoturva-arvioita.

## Evidence engine – aikuisten voimaharjoittelun pystyleikkaus

`adult-resistance-v1.0.0` on ensimmäinen yhdestä lähteestä generoitu,
muuttumaton sisäisen betan harjoitussisältöjulkaisu. Se sisältää 27 laadukkaasti
määriteltyä koti- ja saliharjoitetta, 18 evidence sourcea, kuusi teknisesti
validoitua mutta ihmisen tieteellistä arviota odottavaa aikuisten claimia, kaksi
draft-lajiclaimia ja kuusi sisäisessä betassa käytettävää prescription-sääntöä.

Aikuisten voimareitti käyttää sisältöjulkaisua päästä päähän: kelpoisuussuodatus,
deterministinen pisteytys, RIR:ää hyödyntävä capability, kalibrointi, annostelu,
sarjamukautus, progressio ja laaja decision trace. Supabase-seed generoidaan
samasta paketista. Julkaisukohtaiset harjoitemäärittelyt säilyvät muuttumattomina
erillisessä taulussa, vaikka nykyversion projektio päivittyy. Onboardingin alaraja
on 18 vuotta; alaikäinen, kliinisesti epäselvä tai korkean riskin terveysrajoite,
`SPORT`, `MATCH` ja tarkistamaton `SPEED_POWER` eivät saa väärää fallbackia.

Jääkiekkoarkkitehtuuri ja feature flag säilyvät, mutta Haukkaria ei kuvata tässä
vaiheessa julkaistuksi juniori-, nopeus-, laji- tai kilpailukauden
valmennusmoottoriksi. Tavallinen kipu- tai liikerajoite käsitellään harjoitteen
suodatuksessa eikä se yksin estä koko ohjelmaa. Tavallinen kuntoilu, juoksu,
kestävyys, liikkuvuus ja ravitsemus säilyvät nykyisinä erillisinä polkuina.
