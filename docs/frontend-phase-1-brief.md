# Haukkari – frontendin viimeistelty vaihe 1

Tämä 24.8.2026 hyväksytty toteutusbriefi korvaa alkuperäisen käskyn epäselvät kohdat. Tavoitteena on toteuttaa nykyiseen React/Vite-sovellukseen Haukkarin yhtenäinen visuaalinen perusta ja täysin responsiivinen Tänään-näkymä. Liiketoiminta-, valmennus- ja turvallisuuslogiikkaa ei muuteta.

## Visuaaliset referenssit

- `docs/ui-reference/haukkari-logo-system.png.png`
- `docs/ui-reference/haukkari-mobile-daily-flow.png.png`
- `docs/ui-reference/haukkari-desktop-dashboard.png.png`

Referenssit ohjaavat identiteettiä, hierarkiaa ja tunnelmaa, eivät pikselintarkkaa toteutusta. Generoitujen kuvien teksti- ja käyttöliittymävirheitä ei kopioida. Ensisijainen logo on desktop-referenssin kulmikas H-siipimerkki; pehmeää lehtimerkkiä tai kompassia ei käytetä päätunnuksena.

## Toteutuksen rajaus

- Täydennä nykyistä design-token- ja komponenttikerrosta. Toteuta vain Tänään-näkymän ja AppShellin tässä vaiheessa käyttämät perustat; älä rakenna irrallista tai käyttämätöntä komponenttikatalogia.
- Säilytä projektin nykyinen arkkitehtuuri, reititys, data- ja tilanhallinta, testausratkaisut sekä kaikki domain-käsitteet.
- Muut reitit saavat periä turvalliset token- ja primitive-muutokset, mutta niiden asettelua ei uudisteta eikä toiminnallisuutta heikennetä.
- Projektissa jo oleva tumma teema säilytetään toimivana. Vaalea teema on tämän vaiheen ensisijainen visuaalinen kohde, mutta tummaa teemaa ei poisteta tai suunnitella alusta.
- `lucide-react` voidaan lisätä nykyiseen riippuvuusrakenteeseen tavallisia käyttöliittymäkuvakkeita varten. H-siipimerkki toteutetaan erillisenä väliaikaisena SVG-brändiassetina.
- Kompassibrändi korvataan johdonmukaisesti sovelluksen näkyvissä tunnuksissa: AppShellissä, favicon/PWA-kuvakkeessa ja OG-kortissa.
- Kehitys- ja E2E-fixturet pidetään testihakemistossa ja pois tavallisesta tuotantokäännöksestä. Tuotantokäyttöliittymään ei lisätä tilanvaihdinta.
- Ei harjoituksen suoritus- tai valmistumisnäkymän, Ravinnon, Tavoitteiden tai laajan Edistymisen uudistusta. Ei analytiikkaa, commitia, pushia tai julkaisua.

## Brändi ja visuaalinen perusta

Käyttäjälle näkyvä nimi on **Haukkari** ja ensisijainen wordmark **HAUKKARI**. Ilme on energinen mutta rauhallinen, pohjoismainen, lämmin, ihmisläheinen ja määrätietoinen. Haukkateema näkyy hillitysti H-siipimerkissä, horisontissa, lentoradassa ja eteenpäin kulkevissa muodoissa – ei maskottina tai aggressiivisena urheilujoukkuetunnuksena.

Värien lähtökohdat:

- forest `#103F35`
- active-green `#197A58`
- lime-sage `#BFE47A`
- warm-cream `#F8F3E8`
- charcoal `#17231F`
- sunrise-amber `#F2AD49`
- warning-coral `#E87362`

Johda värit semanttisista tokeneista (tausta, pinta, teksti, raja, ensisijainen/sekundaarinen toiminto, fokus, onnistuminen, varoitus, vaara ja disabled). Määritä käytössä olevat typografiaroolit, välit, sisältöleveydet, breakpointit, pyöristykset, varjot, painikkeet, kortit, tilaviestit, badget, skeletonit, navigaatiot sekä näkyvä näppäimistöfokus. Varmista WCAG AA ja `prefers-reduced-motion`.

## Tänään-näkymä

Näkymän pitää vastata muutamassa sekunnissa:

1. Mitä teen tänään?
2. Miksi tämä sopii juuri tähän päivään?
3. Miten aloitan heti?

Mobiilissa näytetään logo, käyttäjän tervehdys, päivän tilanne, harjoituksen nimi, todellinen kesto ja liikkeiden/rakenneosien määrä, perustelu, suuri ensisijainen toiminto, 10 minuutin pikatreeni, viikon toteutumisrytmi, synkronointitila ja alapalkki. Ensisijainen toiminto näkyy koossa 375 × 667 ilman vieritystä. Jos kuntotarkistus puuttuu, toiminto saa johdattaa kuntotarkistukseen, mutta aloittamisen tavoite ja seuraava askel kerrotaan selvästi.

Tietokoneella käytetään leveää tilaa tarkoituksenmukaisesti: H-siipimerkillä varustettu sivuvalikko, hallitseva päivän harjoitus, päivän tila ilman keksittyä pistemäärää, viikon rytmi, oikeisiin tietoihin perustuva tavoitekohtainen edistymisalue ja seuraavan viikon lyhyt esikatselu.

Toteuta nykyisen domain-mallin avulla tilat: normaali, kevennetty (`YELLOW`), palauttava (`ORANGE_RECOVERY`), harjoittelu estetty (`RED_STOP`), offline, synkronointivirhe, lataus, suunnitelma puuttuu ja harjoitus tehty. Väri ei saa olla tilan ainoa ilmaisin. `RED_STOP`-tilassa ei näytetä tavallista Aloita treeni -toimintoa; viesti on vakava, ymmärrettävä ja ohjaa turvalliseen seuraavaan toimintaan ilman diagnoosia.

## Responsiivisuus ja saavutettavuus

Varmista puhelimet 320–430 px, suuret puhelimet 431–767 px, tabletit 768–1023 px ja tietokoneet ≥1024 px. Tekstit eivät leikkaannu, pitkät suomen sanat rivittyvät, sisältö ei vuoda vaakasuunnassa, kosketuskohteet ovat vähintään 44 × 44 px ja navigaatio pysyy käytettävänä.

Käytä semanttista HTML:ää, loogista otsikkohierarkiaa, ymmärrettäviä ruudunlukijanimiä, toimivaa näppäimistökäyttöä, tekstimuotoisia tila- ja virheviestejä, `aria-live`-alueita sekä koriste-elementtien asianmukaista piilottamista.

## Varmennus ja valmiuskriteerit

Aja lint, format-check, typecheck, muuttuneeseen toiminnallisuuteen liittyvät testit, Playwright-testit ja tuotantokäännös. Tarkista sovellus oikeassa selaimessa ja tallenna kuvat hakemistoon `docs/ui-validation/haukkari-today/` seuraavista koista:

- 375 × 667
- 390 × 844
- 412 × 915
- 768 × 1024
- 1440 × 1000

Tallenna lisäksi mobiilikuvat palauttavasta päivästä, `RED_STOP`-, offline-, synkronointivirhe-, lataus- ja valmis-tilasta. Korjaa havaitut leikkautumiset, ylivuodot, kontrasti- ja hierarkiaongelmat ennen lopettamista. Kuvien tulee osoittaa, että tärkein toiminto näkyy heti ja turvallisuusviesti säilyttää vakavuutensa.

Loppuraportissa kerrotaan muutetut tiedostot, tokenit, väliaikaisen logoassetin toteutus, tilat, responsiivisuus, saavutettavuus, tarkistusten tulokset, kuvien tarkat sijainnit, kehityspalvelimen osoite, poikkeamat referensseistä, olennaiset oletukset ja rajauksen ulkopuolelle jätetyt asiat.
