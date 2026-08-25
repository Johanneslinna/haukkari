# Natiivi HealthKit- ja Health Connect -jatkopolku

Nykyinen Haukkari on PWA eikä lue Apple HealthKit- tai Android Health Connect
-tietoja. Selain ei tarjoa näihin natiiveihin terveystietovarastoihin vastaavaa
suoraa rajapintaa, joten ominaisuutta ei pidä markkinoida nykyversion osaksi.

## Ehdotettu seuraava vaihe

1. Valitse natiivi iOS- ja Android-sovellus tai huolellisesti auditoitu
   natiivikuori PWA:n ympärille. Pelkkä webbuild ei riitä.
2. Aloita vain käyttäjälle näkyvistä vähimmäistyypeistä, esimerkiksi suoritetut
   harjoitukset ja askelmäärä. Älä pyydä sykettä, unta, painoa tai
   kuukautiskiertoa varmuuden vuoksi.
3. Pyydä jokainen luku- ja kirjoitusoikeus käyttökontekstissa ja erikseen. Näytä
   ennen järjestelmän lupapaneelia selkeä käyttötarkoitus, mutta älä jäljittele
   käyttöjärjestelmän lupapaneelia.
4. Tee tuonnista idempotentti. Säilytä lähteen tunniste, lähdetietueen tunniste,
   aikaväli, aikavyöhyke ja viimeisin muutosleima; estä duplikaatit sekä säilytä
   käyttäjän Haukkarissa tekemät korjaukset.
5. Käsittele oikeuden peruminen, lähteessä muuttunut tai poistunut tietue,
   osittainen historia ja usean laitteen päällekkäiset lähteet. Synkronoinnin on
   pysähdyttävä heti, kun oikeus ei enää riitä.
6. Lisää asetuksiin yhteyden tila, viimeisin onnistunut tuonti, keskeytä/jatka,
   hallitse oikeuksia ja poista tuodut tiedot. Pilveen vienti vaatii oman
   nimenomaisen suostumuksen ja päivitetyn tietosuojakuvauksen.
7. Testaa oikeilla laitteilla vähintään luvan epääminen/peruminen, osittainen
   historiapääsy, aikavyöhykkeen ja kesäajan vaihto, offline-tila, duplikaatit,
   lähdepoisto sekä tilin poisto.

## Apple HealthKit

HealthKit vaatii natiivin HealthKit capabilityn, erilliset luku- ja
kirjoituskäyttötarkoitustekstit sekä tietotyyppikohtaisen luvan. Apple suojaa
lukutietoja siten, ettei sovellus voi päätellä yksiselitteisesti, kielsikö
käyttäjä lukuoikeuden; puuttuva data on käsiteltävä normaalina rajatapauksena.

- [HealthKit](https://developer.apple.com/documentation/healthkit)
- [HealthKit-luvan pyytäminen](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)
- [HealthKitin yksityisyysperiaatteet](https://developer.apple.com/design/human-interface-guidelines/healthkit)

## Android Health Connect

Android 14:stä alkaen Health Connect kuuluu järjestelmään; vanhemmissa tuetuissa
Android-versioissa saatavuus tarkistetaan erikseen. Oikeudet ilmoitetaan sekä
manifestissa että Google Play Consolen Health apps -lomakkeella, ja sovelluksen
on tarkistettava oikeudet uudelleen ennen jokaista käyttöä. Julkaisupyynnössä
perustellaan vain ominaisuuden tarvitsemat vähimmäistietotyypit.

- [Health Connectin käyttöönotto](https://developer.android.com/health-and-fitness/health-connect/get-started)
- [Tietotyypit ja lisäoikeudet](https://developer.android.com/health-and-fitness/health-connect/data-types)
- [Julkaisu Google Playssa](https://developer.android.com/health-and-fitness/health-connect/publish)
- [Oikeuksien hallinnan käyttöliittymä](https://developer.android.com/health-and-fitness/health-connect/ui/permissions)

## Päätösportit ennen toteutusta

Tarvitaan käyttäjän päätös natiivitekniikasta, ensimmäisistä tietotyypeistä,
vain laitteessa tapahtuvan ja pilveen synkronoitavan käsittelyn rajasta sekä
App Store- ja Play Store -julkaisuvastuista. Ennen päätöksiä voidaan tehdä vain
rajapintasopimus ja uhkamallin laajennus, ei luvanpyyntöjä tai tuotantointegraatiota.
