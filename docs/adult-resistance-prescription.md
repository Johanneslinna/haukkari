# Aikuisten voimaharjoittelun prescription v1

Kohderyhmä on terve, vähintään 18-vuotias aikuinen. Ensimmäinen pystyleikkaus
kattaa tavoitteen, kokemuksen, ajan, välineet, ympäristön, arjen fyysisen kuorman,
readinessin, kivun/rajoitteet, mieltymykset ja toteutuneen kuorma–toistot–RIR-
historian.

## Muodostusjärjestys

1. Planneri tuottaa rakenteisen `SessionObjective`-tavoitteen.
2. `filterEligibleExercises` soveltaa hard constraintit ennen pisteytystä.
3. `scoreExerciseCandidates` tallentaa 13 determinististä pistekomponenttia ja
   ratkaisee tasapisteen harjoitekoodilla.
4. `estimateAdultResistanceCapability` arvioi liikkeen kapasiteetin tuoreista,
   kivuttomista ja teknisesti hyväksytyistä sarjoista käyttäen kuormaa, toistoja
   ja RIR:ää.
5. `prescribeResistanceDose` muodostaa sarjat, toistoalueen, kuorma-alueen,
   tavoite-RIR:n ja palautuksen.
6. Aikabudjetti tarkistaa lämmittelyn, työosuudet, sarjapalautukset ja
   jäähdyttelyn.
7. Prescription ja koko päätösjälki tallennetaan harjoituksen aloituksessa.

## Epävarmuus ja kalibrointi

Alle kahdesta vertailukelpoisesta RIR-sarjasta confidence on `LOW`.
Kilogrammamäärää ei tällöin teeskennellä, vaan käyttäjä tekee konservatiivisen
kalibroivan sarjan. Riittävä data tuottaa pyöristetyn työkuorma-alueen; e1RM on
arvio, ei mitattu maksimi. Arvio hyväksyy vain saman harjoitekoodin 1–15 toiston
ulkoisen kilogrammakuorman ja tuoreen RIR-datan. Kehonpainoa tai vastuskuminauhaa
ei muuteta kilogrammoiksi, laitekuorman luottamus ei nouse korkeaksi ilman
laite-identiteettiä ja yli 90 päivää vanha viimeisin vertailusarja käynnistää
uuden kalibroinnin.

## Mukautuminen

Sarjan jälkeinen mukautus voi säilyttää annoksen, muuttaa kuormaa yhden portaan,
vähentää toistoja, poistaa jäljellä olevan sarjan, pysäyttää liikkeen tai ohjata
turvallisuusarvioon. Kipu ja tekniikan pettäminen estävät kuorman noston.

Harjoituksesta toiseen progressio vaatii vähintään kaksi vertailukelpoista,
kivutonta, teknisesti onnistunutta ja tavoite-RIR:ään osunutta toteumaa. Vain
yksi päämuuttuja muuttuu. Ulkoista kuormaa nostetaan yksi todellinen käytettävä
painoporras. Jos pienin porras ylittää viisi prosenttia, poikkeus sallitaan vain
samojen kipu-, tekniikka- ja tavoite-RIR-ehtojen täyttyessä ja kirjataan erillisellä
reason codella. Kehonpainoliikkeessä lisätään yksi toisto. Muuten tulos on
`MAINTAIN_AND_COLLECT_MORE_DATA`.

## Aikarajoite

20 minuutin versio muodostetaan samasta tavoitteesta uudelleen: se säilyttää
ensisijaisen adaptaation ja tasapainottaa liikesuunnat. Se ei ole täyden
harjoituksen listan lopusta katkaistu osa. Arvioitu kesto ei saa ylittää käyttäjän
päiväkohtaista enimmäisaikaa.

## Ei vielä tuettu

Juniorit, raskaus/synnytyksen jälkeinen harjoittelu, kuntoutus, diagnosoidut
sairaudet, lajikohtainen ohjelmointi, `MATCH` ja tarkistamaton `SPEED_POWER` eivät
käytä tätä moottoria. Ravitsemus, juoksu ja yleinen kestävyys säilyvät nykyisinä
erillisinä polkuina, eikä aikuisten voimasisältö muuta niiden sääntöjä.
