# Valmennus- ja ravintologiikan turvallisuusrajat

Haukkari ei tee diagnooseja eikä korvaa lääkäriä, fysioterapeuttia,
ravitsemusterapeuttia tai lajivalmentajaa. Domain-moottorit toteuttavat briefissä
määritellyt konservatiiviset rajat deterministisinä tuotepolitiikkoina. Oireen
perusteella annetaan toimintaohje, ei sairauden nimeä tai todennäköisyyttä.

## Lähteisiin sidotut rajat

- WHO:n liikuntasuositus tukee yleiskunto-ohjelman vähintään kahta
  lihaskuntoharjoituspäivää ja säännöllistä aerobista liikuntaa. Yksilöllinen
  ohjelma alkaa silti käyttäjän nykyisestä tasosta ja terveydellisistä rajoista:
  [WHO guidelines on physical activity and sedentary behaviour](https://www.who.int/publications/i/item/9789240015128).
- Äkillinen rintakipu, merkittävä hengitysvaikeus, tajunnan häiriö ja uusi
  neurologinen oire käsitellään harjoittelun pysäyttävinä oireina. Kiireellisessä
  tilanteessa sovellus ohjaa päivystysarvioon ja henkeä uhkaavassa tilanteessa
  numeroon 112:
  [Terveyskirjasto – hengityksen, verenkierron ja tajunnan häiriöt](https://www.terveyskirjasto.fi/spr00005) ja
  [Terveyskirjasto – rintakipu](https://www.terveyskirjasto.fi/dlk00324).
- Pitkittynyt tai vakava matala energiansaatavuus voi heikentää terveyttä ja
  suorituskykyä. Siksi briefin luettelemat merkit pysäyttävät automaattisen
  painonpudotusohjauksen ja ohjaavat ammattilaisen arvioon:
  [IOC:n vuoden 2023 REDs-konsensus](https://bjsm.bmj.com/content/57/17/1073).

## Tuotepolitiikat

- `RED_STOP` estää harjoituksen; hätäoireiden teksti ei yritä erotusdiagnostiikkaa.
- Kävelyä muuttava kipu estää juoksun ja ohjaa oireen arvioon.
- Huono uni, energia, stressi, lihasarkuus tai kohtalainen uusi kipu voi keventää
  päivän määrää 35 %, mutta ei vaihda käyttäjän tavoitetta.
- Kuume ja muut briefissä luetellut turvallisuusoireet ohittavat tavoitteen.
- Painonpudotusohjaus keskeytyy matalan energiansaatavuuden merkkien yhteydessä.
- Yksittäinen painomittaus ei muuta ravintosuositusta. Energiaan vaikuttava
  ehdotus pysyy ehdotuksena, kunnes käyttäjä hyväksyy sen.

Harjoitusmäärien tarkemmat vaihteluvälit, tavoitekonfliktit ja kevennyskynnykset
ovat briefin tuotemäärittelyä. Niitä ei esitetä yleispätevinä lääketieteellisinä
raja-arvoina.
