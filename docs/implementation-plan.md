# Toteutussuunnitelma

## Hyväksyntäportit

1. **Vaihe 0 – perusta:** työkaluketju, arkkitehtuuri, tietomalli, uhkamalli,
   päätösloki ja tarkistuskomennot.
2. **Vaihe 1 – käyttäjäeristys:** PostgreSQL-skeema, migraatiot, seed,
   generoitavat tyypit, RLS, autentikointi ja tilinhallinta.
3. **Vaihe 2 – offline-first:** Dexie, outbox, idempotenssi, tombstonet,
   vakaa kursori, versioristiriidat ja synkronointitilat.
4. **Vaihe 3 – domain-moottorit:** tavoitteet, konfliktit, lajiadapterit,
   suunnitelmat, kuormitus, readiness, progressio, ravinto ja arviointi.
5. **Vaihe 4 – mobiili-PWA:** kaikki ydinnäkymät, saavutettavuus, teemat,
   asennus, päivitysilmoitus ja offline-E2E.
6. **Vaihe 5 – tietosuoja:** viennit, poistot, kuvat, muistutukset, ICS ja
   feature flagin takainen Web Push.
7. **Vaihe 6 – julkaisuvalmius:** koko testimatriisi, pilvivarmennus,
   varmuuskopiointi- ja julkaisuohjeet.

Jokainen vaihe jättää sovelluksen käännettäväksi ja testattavaksi. Vaihetta ei
merkitä pilvessä testatuksi ilman oikeaa testiympäristöä ja tunnuksia.

## Vaiheen 1 valmis-määritelmä

- Kaikki käyttäjäkohtaiset taulut käyttävät UUID-avainta, `user_id`:tä,
  aikaleimoja, pehmeää poistoa ja versiota.
- Jokaisessa taulussa on RLS ja erilliset select/insert/update/delete-käytännöt.
- Omistajuutta ei voi vaihtaa API-päivityksellä.
- Rekisteröityminen, sähköpostivahvistus, salasana-kirjautuminen,
  palautus, vaihto ja uloskirjautuminen on toteutettu.
- Tilin poistava Edge Function varmistaa JWT:n ja käyttää service rolea vain
  palvelinpuolella.
- Kahden käyttäjän RLS-testit ovat ajettavissa paikallisella Supabasella.

## Vaiheen 2 valmis-määritelmä

- Käyttäjän kirjoitus tallentaa tietueen ja outbox-operaation atomisesti
  IndexedDB:hen ennen verkkopyyntöä.
- Operaation UUID ja tietueen asiakas-UUID tekevät uudelleenlähetyksestä
  idempotentin.
- Pull käyttää taulukohtaista `(updated_at, id)`-kursoria ja välittää tombstonet.
- Epäonnistunut operaatio jää jonoon eksponentiaalisella uusintaviiveellä.
- Versioristiriita säilyttää paikallisen ja pilven snapshotin ja vaatii valinnan.
- Käynnistys-, kirjautumis-, online-, etualallepaluu- ja manuaalitriggerit toimivat.
- Uudelleenlataus, verkkokatko, kaksi selainkontekstia, konflikti ja poiston
  välittyminen on testattu oikealla IndexedDB:llä ja paikallisella Supabasella.

## Vaiheen 3 valmis-määritelmä

- Kaikki yhdeksän tavoitetta ovat erillisiä `GoalStrategy`-moduuleja.
- Tavoitteen vaihto vaatii esikatselun, vahvistuksen ja konfliktien valinnat;
  vanha historia ja muuttumattomat suunnitelmaversiot säilyvät.
- Juoksun, pyöräilyn ja voimanoston luetellut alalajit käyttävät täyttä sovitinta;
  tuntematon laji rajautuu näkyvästi yleiseen fysiikkatukeen.
- Päivän valmius, viikkokuorma, progressio, ravinto ja edistymisen arviointi ovat
  puhtaita, selitettäviä ja deterministisiä domain-päätöksiä.
- Briefin valmennuslogiikan testit 16–31 sekä kaikki luetellut RED_STOP-oireet
  läpäisevät yksikkötestit.

## Vaiheen 4 valmis-määritelmä

- Onboarding, Tänään, kuntotarkistus, harjoitus, viikko, tavoitteet,
  tavoitteen vaihto ja esikatselu, laji, ravinto, edistyminen, tavoitejaksot,
  historia, synkronointi, muistutukset, asetukset, asennus ja tietojen hallinta
  ovat reititettyjä suomenkielisiä näkymiä.
- Onboarding kysyy briefin koko lähtökartoituksen ja tallentaa tavoiteajan,
  nykykuorman, taustat, välineet, mieltymykset, terveysrajat, vapaaehtoisen
  kuukautisseurannan sekä valitut mittarit. Arkaluonteisten tietojen suostumus
  ei ole esivalittu.
- Readiness-, tavoite-, ohjelma-, ravinto- ja progressiopäätökset kutsuvat
  Reactin ulkopuolisia domain-moottoreita ja paikalliset kirjoitukset kulkevat
  Dexien atomisen outbox-polun kautta.
- Sovelluskehys tukee mobiilin alavalikkoa, työpöydän sivupalkkia, safe area
  -reunoja, vaaleaa/tummaa/laitteen teemaa, näppäimistöfokusta ja vähennettyä
  liikettä.
- Manifesti, oma kuvake, asennusohje, päivityskehote, sovelluskuoren precache ja
  aktiivisen harjoituksen offline-uudelleenlataus toimivat tuotantokäännöksessä.
- Build-portti varmistaa Androidin 192/512 px -kuvakkeet, erillisen maskattavan
  kuvakkeen, iPhonen 180 px apple-touch-iconin, manifestin, service workerin ja
  sen päivityskehotteen.
- Pixel 7-, iPhone 13 Mini- ja työpöytä-Chrome-polut sekä desktopin skip-link ja
  Androidin offline-reload läpäisevät Playwright-testit.

## Vaiheen 5 valmis-määritelmä

- Kaikki aktiiviset käyttäjätietueet voi viedä versiona JSON-muodossa ja
  taulukoittain CSV:nä; validoitu palautus säilyttää tavoitteet,
  suunnitelmaversiot ja historian.
- Yksittäinen kehomittaus ja yksityinen kuva voidaan poistaa. Tilin poisto
  varmistaa aktiivisen istunnon ja poistaa tietokannan, kuvat, push-tilaukset,
  Auth-käyttäjän sekä nykyisen laitteen paikallistiedot.
- Kehityskuvat vaativat erillisen valinnan, tallentuvat yksityiseen
  käyttäjäpolkuun ja avautuvat vain lyhytikäisellä allekirjoitetulla URL:lla.
- Sovelluksen sisäinen muistutus voidaan poistaa käytöstä ja ladata toistuvana,
  aikavyöhykkeellisenä `.ics`-tiedostona.
- Web Push on oletuksena suljetun feature flagin takana, pyytää luvan vain
  erillisestä käyttäjätoiminnosta, säilyttää tilauksen laitekohtaisesti ja käyttää
  aina terveystiedotonta näkyvää tekstiä.
- Ajastus käyttää Edge Functionia, pg_cronia, pg_netia ja Vault-salaisuutta.
  VAPIDin yksityinen avain ja service role eivät ole frontendissä.
- Testit 15, 36 ja 37 sekä ilmoitus-/loki-/analytiikkavuodon skannaus läpäisevät.

## Vaiheen 6 valmis-määritelmä

- Haukkarin näkyvä brändi, PWA-manifesti, metatiedot ja kanoninen
  `https://haukkari.fi/`-osoite ovat yhtenäiset; vanhat paikallisdata-avaimet ja
  JSON-viennit säilyvät yhteensopivina.
- Migraatiot ajautuvat puhtaaseen paikalliseen tietokantaan ja lint, format,
  TypeScript, unit-, integraatio-, tietosuoja-, pgTAP/RLS-, oikea API-,
  synkronointi-, Edge Function-, Playwright- ja tuotantobuild-portit läpäisevät.
- Julkaisu-, Supabase-, varmuuskopiointi/palautus- ja PWA-asennusohjeet ovat
  toistettavia. HealthKit/Health Connect on rajattu erilliseksi natiivivaiheeksi.
- Hosted Supabase, oikea SMTP, DNS, TLS, aidot push-palvelut ja palautusharjoitus
  merkitään avoimiksi, kunnes turvallinen staging ja tarvittavat tunnukset ovat
  käytettävissä. Paikallinen valmius ei sulje tuotantojulkaisun hyväksyntäporttia.

## Testistrategia

- **Unit:** validointi ja puhdas sovelluslogiikka.
- **Integration:** Reactin autentikointipolut, oikea IndexedDB sekä SyncEngine
  hallitulla etäyhdyskäytävällä.
- **Database/RLS:** pgTAP paikallisen Supabasen todellista Auth/RLS-ketjua
  vasten; tätä ei korvata yksikkötestillä.
- **E2E:** Playwright mobiili-Chromiumilla, WebKitillä ja työpöytä-Chromiumilla;
  paikallinen synkronointiskenaario käyttää kahta erillistä selainkontekstia.
- **Build:** TypeScript project references ja Viten tuotantokäännös.
