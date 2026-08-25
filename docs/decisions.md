# Päätösloki

## ADR-001: PWA ennen natiivisovellusta

**Päätös:** React/Vite PWA yhdellä koodipohjalla.  
**Peruste:** briefin Android-, iPhone- ja työpöytätavoite sekä offline-käyttö.
Natiivi HealthKit/Health Connect jätetään myöhempään erikseen arvioitavaan vaiheeseen.

## ADR-002: PostgreSQL ensisijaisena lähteenä

**Päätös:** Supabase PostgreSQL on pysyvä lähde; IndexedDB on paikallinen
työskentelytietokanta ja synkronointijono.  
**Seuraus:** UI ei odota verkkopyyntöä, mutta synkronointi tarvitsee
idempotenssin, tombstonet ja eksplisiittisen konfliktimallin.

## ADR-003: RLS on pakollinen käyttöoikeusraja

**Päätös:** jokainen käyttäjätaulu käyttää neljää operaatiokohtaista RLS-käytäntöä
ehdolla `auth.uid() = user_id`.  
**Seuraus:** frontend-suodatus ei ole tietoturvakontrolli; pgTAP testaa suorat
API-oikeudet kahdella käyttäjällä.

## ADR-004: Suunnitelmat ovat versioita

**Päätös:** tavoitteen vaihto luo uuden `goal_period`- ja `plan_version`-rivin.
Aiempi suunnitelma säilyy.  
**Seuraus:** hiljaista last-write-wins-mallia ei käytetä ohjelmahistoriaan.

## ADR-005: Ei näennäistä terveystarkkuutta

**Päätös:** readiness palauttaa kategorian ja perustelut, ei keinotekoista
desimaalipistemäärää. Kaikki turvallisuusrajat ovat deterministisiä ja testattavia.

## ADR-006: Tilin poisto palvelinpuolella

**Päätös:** varmennettu Edge Function poistaa Storage-objektit ja Auth-käyttäjän.
Service role ei koskaan kulje selaimeen.

## ADR-007: Yksi paikallinen tietuevarasto, taulukohtainen identiteetti

**Päätös:** synkronoitavat tietueet säilytetään yhdessä Dexie-taulussa avaimella
`user_id + entity_table + id`; payload säilyttää palvelimen snake_case-muodon.  
**Peruste:** atominen outbox-transaktio, käyttäjäkohtainen tyhjennys ja yhteinen
synkronointialgoritmi voidaan testata kerran ilman 22 lähes samanlaista
paikallista repositoriota. Domain-moduulit saavat myöhemmin omat tyypitetyt
repository-sovittimensa tämän kerroksen päälle.

## ADR-008: Ei hiljaista last-write-wins-ratkaisua

**Päätös:** palvelimen version ylittäessä operaation `base_version` molemmat
snapshotit säilytetään ja käyttäjä ratkaisee ristiriidan.  
**Seuraus:** ratkaisupyyntö jonotetaan myös silloin, kun aiempi synkronointikierros
on juuri päättymässä; nopea käyttöliittymätoiminto ei voi kadota ajolukkoon.

## ADR-009: Selitettävä ja deterministinen valmennuspäätös

**Päätös:** jokainen domain-moottori palauttaa päätöksen lisäksi vakailla
sääntökoodeilla varustetut suomenkieliset perustelut ja varoitukset. Moottorit
ovat sivuvaikutuksettomia eivätkä käytä kielimallia päätöksentekoon.  
**Seuraus:** turvallisuus-, konflikti-, kuormitus- ja ravintosäännöt voidaan
toistaa samoilla syötteillä ja testata ilman käyttöliittymää.

## ADR-010: Vain testattu lajisovitin saa olla lajikohtainen

**Päätös:** juoksun, pyöräilyn ja voimanoston luetellut alalajit käyttävät täyttä
`SportAdapter`-moduulia. Kaikki muut lajit saavat `GENERAL_SPORT_SUPPORT`-tuen
ja näkyvän rajausvaroituksen.  
**Seuraus:** yleistä fysiikkaohjelmaa ei esitetä lajitekniikan, taktiikan tai
valmentajan työn korvaavana optimointina.

## ADR-011: Haukkari ja haukkari.fi ovat tuotantoidentiteetti

**Päätös:** käyttäjälle näkyvä nimi, PWA-manifesti, ilmoitukset, kalenteriviennit
ja tiedostonimet käyttävät Haukkaria. Kanoninen tuotanto-osoite on
`https://haukkari.fi/`.
**Yhteensopivuus:** IndexedDB:n, localStoragen, Supabase Authin ja
synkronointiharnessin vanhat `treenikompassi`-nimiavaruudet säilytetään, jotta
päivitys ei kadota paikallista dataa tai istuntoa. Uudet JSON-viennit käyttävät
`haukkari-data-export`-tunnistetta, mutta palautus hyväksyy myös vanhan
`treenikompassi-data-export`-tunnisteen.
