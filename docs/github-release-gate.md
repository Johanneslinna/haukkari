# GitHubin julkaisuportti ja `main`-haaran suojaus

## Automaattinen CI

Workflow `.github/workflows/ci.yml` käynnistyy jokaisesta `main`-haaraan
kohdistuvasta pull requestista, `main`-pushista, merge queue -ajosta ja
manuaalisesta käynnistyksestä. Se ei käytä tuotanto- tai staging-salaisuuksia eikä
julkaise mitään.

Workflow ajaa kolme toisistaan riippumatonta porttia:

1. **Quality gate**: sisältövalidointi, E2E-ohitusten auditointi, lint,
   format-check, TypeScript, yksikkö- ja integraatiotestit, tietosuojaskannaus,
   tuotantobuild ja PWA-portti.
2. **Browser E2E**: yleiset Playwright-regressiot sekä sovellus- ja PWA-polut
   Chromiumilla ja WebKitillä.
3. **Database, sync, and Edge Functions**: puhdas paikallinen Supabase,
   migraatiot ja seed, pgTAP/RLS, Auth/REST/Storage-eristys, synkronointi,
   kahden selainkontekstin E2E, tilin poisto ja muistutusfunktio.

Lopuksi aina ajettava **Release gate** epäonnistuu, jos yksikin edellisistä
porteista epäonnistuu tai jää suorittamatta. GitHubin rulesetiin asetetaan vain
tämä vakaa jobin nimi. Workflowssa ei käytetä polkusuodatuksia, joten required
check ei jää odottamaan raportoimatonta tulosta dokumentaatiomuutoksissakaan.

## Required checkin käyttöönotto

### Nykyinen GitHub-rajoite

GitHubin read-only-API-tarkistus 27.8.2026 palautti sekä repository rulesetille
että `main`-haaran branch protectionille vastauksen `403`: yksityisen repositoryn
ominaisuus vaatii nykyisellä tilillä GitHub Pro -tason tai julkisen repositoryn.
Workflow voidaan silti ajaa PR:issä, mutta `Release gate` ei ole vielä GitHubin
pakottama required check. Repositoryn näkyvyyttä tai tilausta ei muuteta osana
tätä toteutusta. Kun ominaisuus on käytettävissä, toimi seuraavasti.

Tee tämä vasta, kun workflow on ajettu onnistuneesti GitHubissa vähintään kerran:

1. Avaa repositoryn **Settings → Rules → Rulesets**.
2. Luo branch ruleset, jonka kohde on default branch `main`.
3. Ota käyttöön **Require a pull request before merging**.
4. Vaadi vähintään yksi hyväksyvä katselmointi ja keskustelujen ratkaiseminen.
5. Ota käyttöön **Require status checks to pass** ja valitse täsmälleen
   `Release gate` GitHub Actions -lähteestä.
6. Ota käyttöön **Require branches to be up to date before merging**.
7. Estä force pushit ja `main`-haaran poistaminen.
8. Älä anna ylläpitäjille tai automaatioille yleistä bypass-oikeutta. Mahdollinen
   hätäpoikkeus dokumentoidaan tapauskohtaisesti.

GitHub tunnistaa tavallisen workflow-jobin required checkin sen `name`-arvolla.
Jos jobin nimi muutetaan, myös rulesetin vaatimus pitää päivittää. Merge queue on
huomioitu `merge_group`-triggerillä, vaikka sitä ei otettaisi heti käyttöön.

## PR #1:n katselmointi

PR:ää `Training engine v2: versioned adult resistance beta` ei poisteta
draft-tilasta pelkän vihreän CI-ajon perusteella. Suositeltu katselmointijärjestys:

1. **Luottamusrajat ja sisältöjulkaisu**
   - `training-content/v1/release.json`
   - `training-content/v1/evidence-claims.json`
   - varmista `INTERNAL_BETA`, tyhjä `reviewedBy` ja ihmisen arvion odotustila.
2. **Turvallisuus ja ehdottomat rajoitteet**
   - `src/domain/coaching/AdultResistanceEngine.ts`
   - `src/domain/coaching/TrainingPrescriptionEngine.ts`
   - varmista ikäraja, kipu- ja terveysrajat, välineet ja ehdoton aikabudjetti.
3. **Capability, annostelu ja progressio**
   - varmista, ettei kehonpainoa tai vastuskuminauhaa käsitellä kilogrammoina;
   - varmista RIR:n, kalibroinnin, historiadatan ja yhden kuormaportaan rajat.
4. **Tietokanta ja historia**
   - tarkista migraatiot `20260825000300` ja `20260825000400`;
   - varmista immutable-julkaisut, RLS ja vanhojen snapshotien luettavuus.
5. **Käyttäjäpolut ja regressiot**
   - tavallinen liikkuja, voimaharjoittelija ja juoksija;
   - kuntotarkistus, harjoituksen lyhennys, vaihtoehtoinen liike, oire,
     palaute, historia ja profiilin puhdas aloitus;
   - jääkiekkolippu ei saa muuttaa yleisiä polkuja.

PR #1 voidaan siirtää pois draftista vasta, kun:

- `Release gate` on vihreä uusimmalla commitilla;
- vähintään yksi tekninen katselmoija on hyväksynyt muutokset;
- valmennuksellisen sisällön nimetty ihmisarvio ja sen rajaus on dokumentoitu;
- avoimet turvallisuus-, tietosuoja- ja datakysymykset on ratkaistu tai kirjattu
  selvästi myöhempään julkaisuporttiin;
- hosted staging -varmennuksen puuttuminen näkyy edelleen julkaisun estävänä
  kohtana.

CI tai katselmointi ei itsessään anna lupaa yhdistää PR:ää, muuttaa hosted
Supabasea tai julkaista Haukkaria.

## Viralliset GitHub-ohjeet

- [Ruleseteissä käytettävät säännöt](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- [Required status checkien vianmääritys](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/troubleshooting-rules)
- [Pull requestien ja suojausten standardointi](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/getting-started/managing-and-standardizing-pull-requests)
