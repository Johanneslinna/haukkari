# Offline-first-synkronointi

## Paikallinen kirjoituspolku

`LocalWriteService` validoi kirjoituspyynnön ja suorittaa tietueen sekä
outbox-operaation tallennuksen samassa Dexie-transaktiossa. Tietue saa UUID:n
laitteella, käyttöliittymä voi käyttää sitä välittömästi eikä verkkopyyntöä
odoteta.

Poisto muuttaa tietueen `deleted_at`-tombstoneksi. Tietue ja poistotieto
säilyvät paikallisesti ja pilvessä, kunnes erillinen myöhempi ylläpitotoiminto
siivoaa vanhat tombstonet.

Uloskirjautuminen poistaa kyseisen käyttäjän tietueet, outboxin, kursorit,
ristiriidat ja laitetiedon selaimen IndexedDB:stä. Toisen käyttäjän paikallisia
tietoja ei poisteta.

## Push ja idempotenssi

Jokaisella operaatiolla on oma UUID. `SupabaseSyncGateway` tallentaa UUID:n
`sync_operations`-tauluun ennen varsinaista muutosta. Lisäksi uusi tietue käyttää
asiakkaalla luotua UUID-pääavainta. Jos kuittaus katkeaa muutoksen jälkeen,
uusinta löytää saman operaation tai saman tietueen ja vertaa aiottuja kenttiä;
se ei luo kaksoiskappaletta.

Epäonnistunutta operaatiota ei poisteta. Se saa eksponentiaalisen, enintään
viiden minuutin uusintaviiveen. Manuaalinen **Synkronoi nyt** ohittaa viiveen.

## Pull ja vakaa kursori

Jokaisella synkronoitavalla taululla on oma `(updated_at, id)`-kursori. Sivun
viimeinen pari tallennetaan vasta käsittelyn jälkeen. Näin kaksi samalla
aikaleimalla muuttunutta tietuetta eivät peitä toisiaan.

Pull sisältää myös tombstonet. Synkronointi käynnistyy kirjautumisen,
sovelluksen käynnistyksen, etualalle paluun ja verkkoyhteyden palautumisen
yhteydessä sekä käyttäjän pyynnöstä.

## Optimistinen versio ja ristiriita

Päivitys lähetetään palvelimelle viimeksi tunnetulla `version`-arvolla.
PostgreSQL hyväksyy sen vain, jos arvo vastaa palvelimen versiota, ja kasvattaa
version onnistuneessa päivityksessä.

Jos palvelin on jo muuttunut, paikallinen ja pilven snapshot tallennetaan
erikseen. Käyttäjä voi säilyttää paikallisen version, pilviversion tai muokata
yhdistettyä JSON-versiota. Ratkaisu luo uuden versiollisen operaation; kumpaakaan
alkuperäistä snapshotia ei hävitetä ennen valintaa.

## Testit

```sh
npm run unit
npm run integration
npm run db:test-sync
npm run db:test-sync-e2e
```

Kaksi viimeistä komentoa vaativat käynnissä olevan paikallisen Supabasen.
Selain-E2E rakentaa erillisen testibundlen, jossa
`VITE_E2E_SYNC_HARNESS=true`. Testiharness ei ole käytössä normaalissa
tuotantokäännöksessä.
