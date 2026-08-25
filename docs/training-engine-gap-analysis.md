# Harjoittelumoottorin auditointi ja jatkokehitys

Päiväys: 25.8.2026

## Lähtötilan auditointi

Ennen tätä toteutusta sovellus osasi muodostaa tavoitekohtaisen viikkorakenteen, optimoida kiinteitä harjoituksia, tehdä päivän kuntotarkistuksen ja tallentaa yksinkertaisen harjoituslokin. Harjoituksen `prescription` oli kuitenkin lista yleisiä tekstivihjeitä. Aloituskartoituksen välineet, fyysinen työkuorma, mieltymykset ja rajoitteet eivät vaikuttaneet liikevalintoihin. Aktiivinen harjoitus ei kirjannut sarjoja, eikä historia yhdistänyt suunnitelmaa, toteumaa ja palautetta.

Pyynnössä mainittuja tiedostoja `motivational-daily-flow.png` ja `motivational-progress-flow.png` ei löytynyt täsmälleen näillä nimillä. Visuaalisena lähteenä käytettiin lähimpiä olemassa olevia referenssejä `haukkari-mobile-daily-flow.png.png` ja `haukkari-desktop-dashboard.png.png`.

## Tässä vaiheessa valmistunut pystyleikkaus

- aloituskartoituksen tavoite, kokemus, aika, välineet, fyysinen kuorma, mieltymykset ja rajoitteet välittyvät reseptimoottorille;
- viikkosuunnitelma sisältää konkreettiset liikkeet, sarjat, toistot/ajan, palautukset, RPE/RIR-tavoitteet, ohjeet, keskeytysehdot ja vaihtoehdot;
- päivän valmius ja valittu aikaversio tuottavat jäljitettävän harjoitussnapshotin;
- aktiivinen harjoitus etenee liike kerrallaan, sisältää sarjalokin ja palautusajastimen;
- kesken harjoituksen voi keskeyttää ja ilmoittaa oireen; voimakas kipu estää progression ja tuottaa ammattilaiselle ohjaavan `REFER`-päätöksen;
- RPE selitetään suomeksi;
- loppupalaute tallentaa toteuman, vaikeuden, kivun ja harjoituksen jälkeisen olon;
- historia näyttää suunnitelman ja toteuman rinnakkain sekä palautteen vaikutuksen seuraavaan harjoitukseen;
- vahingollinen vaste keventää tai vaihtaa palauttavaan harjoitukseen, kaksi vertailukelpoista liian helppoa onnistumista voi lisätä yhden sarjan yhteen avainliikkeeseen;
- päätöksillä on versioitu `DecisionTrace` ja kultaiset käyttäjäprofiilit.

## Priorisoitu jatkolista

1. **Kliiniset ja elämänvaiheen moduulit:** raskaus/synnytyksen jälkeinen harjoittelu, nuoret, ikääntyneet, krooniset sairaudet ja vamman jälkeinen paluu vain asiantuntijavalidoituina erillisinä polkuina.
2. **Laajempi harjoitekirjasto:** liikerajoitekohtaiset regressiot/progressiot, välinekohtaiset videot ja järjestelmällinen sisältöauditointi.
3. **Tavoitekohtainen periodisointi:** 8–24 viikon mesosyklit, testiviikot, tapahtumataperointi ja lajikohtaiset volyymi-intensiteettimallit.
4. **Kestävyysdatan tarkennus:** matka, vauhti, intervallitoistot ja syke vain silloin, kun maksimi-/kynnyssyke tai lääkitys on luotettavasti huomioitu.
5. **Progression taustapalvelu:** uuden plan-version muodostaminen päätöksestä, hyväksyntänäkymä ja turvallinen rollback aiempaan versioon.
6. **Sisältöhallinta:** liike- ja sääntöversiot tietokantaan, asiantuntijahyväksynnät ja audit trail julkaistuille muutoksille.
7. **Saavutettavuus ja laitetestaus:** ruudunlukijan koko aktiivipolku, Landscape/320 px, hidas Android ja virransäästötilan ajastin.
8. **Analytiikka:** vain suostumuksellinen, minimidatainen tapahtumamalli, joka ei sisällä terveystekstiä tai muistiinpanoja.
