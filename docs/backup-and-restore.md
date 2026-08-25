# Varmuuskopiointi ja palautus

Haukkarissa tietokanta ja yksityiset kehityskuvat varmistetaan erikseen.
Supabasen tietokantavarmuuskopio sisältää Storage-metadatan, mutta ei itse
Storage-objekteja. S3-yhteensopiva Storage ei myöskään tue objektiversiointia,
joten poistettua kuvaa ei voi palauttaa ilman erillistä objektikopiota.

## Tuotantopolitiikka ennen julkaisua

1. Valitse vähintään Supabasen maksullinen suunnitelma, jossa päivittäiset
   tietokantavarmuuskopiot ovat käytössä, tai ota käyttöön PITR. PITR korvaa
   päivittäiset varmuuskopiot ja antaa tarkemman palautuspisteen.
2. Hyväksytä palvelun omistajalla RPO ja RTO. Ilman PITR:ää enimmäistietohäviö
   voi olla lähes vuorokausi; palautus aiheuttaa huoltokatkon.
3. Kopioi `progress-photos` joka yö päivättyyn, salattuun ja eri tilillä tai eri
   palvelussa olevaan objektivarastoon. Käytä `rclone copy` -toimintoa, älä
   `sync --delete` -toimintoa, jotta lähteen poisto ei poista varmuuskopiota.
4. Säilytä migraatiot, frontend-artifactit ja Edge Function -lähde samassa
   julkaisutunnisteessa. Salaisuuksia ei sisällytetä varmuuskopioon.

Supabasen ajantasaiset kuvaukset:

- [Database Backups](https://supabase.com/docs/guides/platform/backups)
- [CLI backup and restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Storage-objektien lataaminen](https://supabase.com/docs/guides/storage/management/download-objects)
- [S3-yhteensopivuus](https://supabase.com/docs/guides/storage/s3/compatibility)

## Manuaalinen tietokantavarmistus

Tee lisävarmistus ennen jokaista tuotantomigraatiota ja säännöllisesti
suojatussa ajoalustassa. Yhteysosoite injektoidaan salaisuusvarastosta
`HAUKKARI_DB_URL`-ympäristömuuttujaan; sitä ei kirjoiteta komentohistoriaan tai
tiedostoon.

```powershell
$backupDate = Get-Date -Format 'yyyy-MM-dd-HHmmss'
$backupRoot = Join-Path 'D:\HaukkariBackups' $backupDate
New-Item -ItemType Directory -Path $backupRoot
npx supabase db dump --db-url $env:HAUKKARI_DB_URL -f (Join-Path $backupRoot 'roles.sql') --role-only
npx supabase db dump --db-url $env:HAUKKARI_DB_URL -f (Join-Path $backupRoot 'schema.sql')
npx supabase db dump --db-url $env:HAUKKARI_DB_URL -f (Join-Path $backupRoot 'data.sql') --use-copy --data-only
Get-FileHash (Join-Path $backupRoot '*.sql') -Algorithm SHA256
```

`D:\HaukkariBackups` on esimerkki erillisestä suojatusta asemasta, ei
repositoryn hakemisto. Salaa paketti, siirrä se off-site-säilytykseen ja tallenna
tarkistussummat muuttamattomaan operointilokiin.

## Storage-objektien varmistus

Ota Supabasen Storage-asetuksissa S3-protokolla käyttöön ja luo palvelinpuolen
S3-avaimet. Avaimet ohittavat RLS:n, joten säilytä ne vain varmistusjärjestelmän
secret-varastossa. Määritä `rclone`-etäyhteydet virallisen Storage-ohjeen mukaan
ja kopioi päivättyyn kohteeseen:

```powershell
$backupDate = Get-Date -Format 'yyyy-MM-dd-HHmmss'
rclone copy haukkari-production:progress-photos "haukkari-backup:progress-photos/$backupDate" --checksum
rclone check haukkari-production:progress-photos "haukkari-backup:progress-photos/$backupDate" --one-way
```

## Palautusharjoitus

Harjoittele neljännesvuosittain uuteen, tyhjään EU-alueen Supabase-projektiin:

1. Tallenna alkutilan backup-tunniste, tarkistussummat ja objektimäärä.
2. Seuraa Supabasen virallista CLI restore -ohjetta ja palauta `roles.sql`,
   `schema.sql` ja `data.sql` uuteen projektiin. Älä harjoittele tuotantoon.
3. Luo yksityinen `progress-photos`-bucket migraatioilla ja kopioi valitun
   päivämäärän objektit S3-kohteesta palautusprojektiin.
4. Aja `npm run db:test`, `npm run db:test-api` ja kahden käyttäjän
   synkronointiskenaario palautettua projektia vasten.
5. Varmista käyttäjien, rivimäärien, kuvien, allekirjoitettujen URLien ja
   tilinpoiston toiminta. Dokumentoi toteutunut RPO/RTO.

Tuotantopalautuksessa laita sovellus huoltotilaan, ota ennen palautusta uusi
forensiikka-/turvakopio, palauta Dashboardin valitusta päivittäisestä tai PITR-
pisteestä ja palauta samaan pisteeseen kuuluva Storage-snapshot. Supabase-projekti
ei ole käytettävissä tietokantapalautuksen aikana.
