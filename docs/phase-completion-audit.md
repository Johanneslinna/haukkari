# Haukkari – vaiheiden 0–6 valmistumisauditointi

Päivitetty 24.8.2026. Tämä asiakirja erottaa paikallisesti todennetun
julkaisuvalmiuden pilvessä ja fyysisillä laitteilla tehtävästä varmennuksesta.

## Yhteenveto

| Vaihe                                    | Toteutus                 | Paikallinen varmennus    | Pilvivarmennus                                          |
| ---------------------------------------- | ------------------------ | ------------------------ | ------------------------------------------------------- |
| 0 – kartoitus ja perusta                 | valmis                   | valmis                   | ei sovellu                                              |
| 1 – tietokanta, Auth ja RLS              | valmis                   | valmis                   | odottaa stagingia                                       |
| 2 – offline-first ja synkronointi        | valmis                   | valmis                   | odottaa stagingia ja fyysisiä laitteita                 |
| 3 – valmennus ja ravinto                 | valmis                   | valmis                   | ei edellytä pilveä                                      |
| 4 – mobiilikäyttöliittymä ja PWA         | valmis                   | valmis selainmatriisissa | fyysinen iPhone/Android-asennus odottaa HTTPS-julkaisua |
| 5 – tietosuoja, viennit ja muistutukset  | valmis                   | valmis                   | aito Web Push odottaa VAPID/Vault-ympäristöä            |
| 6 – kokonaisvarmennus ja julkaisuvalmius | paikallinen osuus valmis | valmis                   | tuotantoportti on tarkoituksella avoin                  |

## Vaihekohtainen näyttö

### Vaihe 0

- Arkkitehtuuri, tietomalli, uhkamalli, päätösloki, oletukset ja toteutussuunnitelma
  ovat versionhallittavissa `docs/`-asiakirjoissa.
- `package.json` sisältää dev-, lint-, format-check-, typecheck-, unit-,
  integration-, e2e-, PWA- ja build-komennot. Lockfile on mukana.
- `.env.example`, `.gitignore`, `SECURITY.md` ja bundle-/tietosuojaskannaus
  rajaavat palvelinsalaisuudet pois frontendistä.

### Vaihe 1

- 25 käyttäjäkohtaista PostgreSQL-taulua, yhteinen liikehakemisto, migraatiot,
  seed, generoidut tyypit, RLS/FORCE RLS, Storage-politiikat ja varmennettu
  tilinpoisto-Edge Function on toteutettu.
- Puhdas `supabase db reset` läpäisee kaikki neljä migraatiota ja seedin.
- 14/14 pgTAP/RLS-testiä sekä kahden oikean Auth-käyttäjän REST- ja
  Storage-eristystesti läpäisevät paikallisen Supabase-pinon.
- Rekisteröityminen, sähköpostivahvistuscallback, salasana-kirjautuminen,
  palautus, vaihto, istunto, uloskirjautuminen, vienti ja tilin poisto ovat
  reititettyjä ja testattavia polkuja.

### Vaihe 2

- Dexie, atominen paikallinen kirjoitus ja outbox, idempotenssi, eksponentiaalinen
  uudelleenyritys, `(updated_at, id)`-kursori, tombstonet, optimistiset versiot ja
  säilyttävä konfliktinratkaisu sijaitsevat käyttöliittymästä erillisissä
  moduuleissa.
- Unit- ja integraatiotestit kattavat kannan sulkemisen/avaamisen, verkkokatkon,
  kuittauksen katoamisen, retry-jonon, vakaan kursorin ja konfliktit.
- Oikea paikallinen Supabase-yhdyskäytävä sekä kaksi erillistä Chromium-
  kontekstia läpäisevät offline-uudelleenkäynnistyksen, kahdensuuntaisen
  synkronoinnin, konfliktin ja tombstonen välittymisen.

### Vaihe 3

- Yhdeksän `GoalStrategy`-moduulia sekä `GoalEngine`, `ConflictEngine`,
  `SportAdapterRegistry`, `PlanGenerator`, `ScheduleOptimizer`,
  `ReadinessEngine`, `ProgressionEngine`, `NutritionPolicyEngine` ja
  `ProgressEvaluator` ovat puhtaita TypeScript-moduuleja.
- Juoksun, pyöräilyn ja voimanoston kaikki briefissä nimetyt alalajit käyttävät
  täyttä adapteria. Tuntematon laji rajataan näkyvästi yleiseksi tueksi.
- Testit 16–31 sekä kaikki nimetyt RED_STOP-oireet, kevennys-, kuormitus-,
  konflikti- ja ravintosäännöt läpäisevät deterministiset testit.
- `src/domain/models.ts` määrittää briefin vähimmäistietomallit ja yhteisen
  versioidun käyttäjätietueen sopimuksen.

### Vaihe 4

- Kaikki briefin 18 näkymää ovat reititettyjä suomenkielisiä näkymiä. Lisäksi
  mukana ovat erilliset kehityskuva-, asennus- ja tilisivut.
- Nelivaiheinen aloituskartoitus kysyy tavoiteajan, harjoitustaustan, nykykuorman,
  välineet, mieltymykset, arjen kuorman, ravintotavan, terveysrajat,
  vapaaehtoisen kuukautisseurannan ja halutut mittarit. Terveystietojen suostumus
  vaatii aktiivisen valinnan.
- Android-, iPhone- ja työpöytäprojektit läpäisevät ydinkulun; työpöytätesti
  varmistaa näppäimistön skip-linkin ja Android-testi aktiivisen harjoituksen
  oikean service worker -offline-uudelleenlatauksen.
- PWA-build-portti varmistaa manifestin, standalone-tilan, 180/192/512 px:n
  kuvakkeet, erillisen maskattavan kuvakkeen, service workerin precachen,
  navigointifallbackin ja päivityskehotteen.

### Vaihe 5

- Versioitu JSON-vienti ja validoitu palautus, taulukohtainen CSV, mittauksen ja
  yksityisen kuvan poisto, tilin kokonaispoisto, sovelluksen sisäiset muistutukset
  ja aikavyöhykkeellinen ICS on toteutettu.
- Kehityskuva vaatii erillisen valinnan, pakataan selaimessa, tallennetaan
  yksityiseen käyttäjäpolkuun ja avataan viiden minuutin allekirjoitetulla URL:lla.
- Web Push on oletuksena suljetun feature flagin takana. Lupa pyydetään vain
  käyttäjän toiminnosta ja näkyvä ilmoitus on aina terveystiedoton.
- Paikallinen tilinpoistotesti läpäisee DB-, Storage-, Push- ja Auth-poiston.
  Muistutustesti läpäisee cron-salaisuuden rajan ja vanhentuneen tilauksen
  tombstonen. Tietosuojaskannaus tarkistaa näkyvän push-tekstin ja lokikiellon.

### Vaihe 6

- Koko paikallinen ketju sisältää lintin, Prettier-tarkistuksen, TypeScriptin,
  71 yksikkötestiä, 7 integraatiotestiä, tietosuojaskannauksen, tuotantobuildin,
  PWA-build-portin, yleisen Playwright-matriisin, sovelluksen PWA-matriisin,
  pgTAP/RLS:n, oikeat API-testit, Supabase-synkronoinnin, kahden kontekstin E2E:n
  sekä molemmat Edge Function -testit.
- Käynnistys-, Supabase-, offline-, Web Push-, asennus-, varmuuskopiointi-,
  julkaisu- ja natiivin HealthKit/Health Connect -jatkovaiheen ohjeet ovat
  `README.md`- ja `docs/`-asiakirjoissa.

## Briefin automatisoidut testit 1–37

| Testit    | Todennus                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------- |
| 1–5       | pgTAP/RLS, kahden Auth-käyttäjän REST/Storage-testi ja tuotantobundlen salaisuusskannaus          |
| 6–14      | Dexie/SyncEngine-unit- ja integraatiotestit sekä kahden selainkontekstin paikallinen Supabase-E2E |
| 15        | paikallinen `delete-account` Edge Function: DB, Storage, Push ja Auth                             |
| 16–19     | `GoalEngine.unit.test.ts`                                                                         |
| 20, 30–31 | `NutritionProgression.unit.test.ts`                                                               |
| 21–25, 29 | `PlanningEngines.unit.test.ts`                                                                    |
| 26–28     | `ReadinessEngine.unit.test.ts`                                                                    |
| 32–35     | PWA-build-portti sekä Android/iPhone/desktop Playwright-matriisi ja Androidin offline-reload      |
| 36–37     | data portability- ja Web Push -unit-testit sekä selaimen vientipolku                              |

## Ulkoista ympäristöä vaativat portit

Seuraavia ei ole väitetty testatuiksi eikä niitä tehdä ilman erillistä lupaa ja
turvallisia tunnuksia:

- hosted Supabase EU -stagingin migraatiot, SMTP, Auth, Storage ja Edge Functionit
- VAPID/Vault/cron oikeassa push-palvelussa ja fyysisen iPhonen push-toimitus
- kahden fyysisen laitteen pilvisynkronointi internetin yli
- hosting, DNS, TLS ja `https://haukkari.fi/`-savukoe
- hallittu pilvitietokannan ja Storagen palautusharjoitus
- rekisterinpitäjän lopulliset yhteystiedot ja oikeudellisesti hyväksytty
  tietosuojaseloste.

Julkaisua, commitointia tai pushia ei ole tehty.
