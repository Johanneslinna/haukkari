# E2E-skip-auditointi

Playwrightin sovellusmatriisissa on kolme projektia: `android-small`,
`iphone-small` ja `desktop-keyboard`. Viisi testitapausta ajetaan tarkoituksella
vain yhdellä edustavalla Chromium-projektilla. Tästä syntyy raporttiin kymmenen
skipattua projektitapausta, ei kymmentä testaamatonta ominaisuutta.

| Testi                                                               | Ajettava projekti | Skipatut projektit             | Miksi                                                                                                                    | Pysyvä                | Poistoehto                                                                    |
| ------------------------------------------------------------------- | ----------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | --------------------- | ----------------------------------------------------------------------------- |
| Käynnissä oleva harjoitus säilyy offline-latauksessa                | android-small     | iphone-small, desktop-keyboard | Offline- ja service worker -polku varmennetaan kohdeympäristön Chromium-mobiililla                                       | Matriisitasolla kyllä | Ajetaan kaikilla projekteilla, jos selainkohtainen offline-riski tunnistetaan |
| Kartoituksesta syntynyt harjoitus, RIR/toteuma, palaute ja historia | android-small     | iphone-small, desktop-keyboard | Pitkä aktiivisen harjoituksen semanttinen polku ajetaan kerran; responsiivisuus testataan erikseen kaikilla projekteilla | Matriisitasolla kyllä | Laajennetaan, jos suorituspolusta löytyy selainkohtainen ero                  |
| Voimakkaan kivun keskeytys ja progression esto                      | android-small     | iphone-small, desktop-keyboard | Turvallisuuspolku ajetaan kerran kohdeympäristössä ja sääntölogiikka lisäksi yksikkötesteissä                            | Matriisitasolla kyllä | Laajennetaan, jos selainkohtainen lomake- tai tallennusriski tunnistetaan     |
| Tietosuojavienti, mittauksen poisto ja ICS                          | android-small     | iphone-small, desktop-keyboard | Latausrajapintojen semanttinen polku ajetaan kerran Chromiumilla                                                         | Matriisitasolla kyllä | Laajennetaan WebKit-tiedostolatausten erilliseen regressioon tarvittaessa     |
| Tänään-näkymän kuvakaappauspaketti                                  | desktop-keyboard  | android-small, iphone-small    | Sama testi vaihtaa itse kaikki dokumentoidut viewportit; kolminkertainen projektiajo tuottaisi identtiset kuvat          | Kyllä                 | Poistetaan vain, jos kuvapaketit erotetaan projektikohtaisiksi                |

Onboardingin peruspolku, responsiivisuus ja näppäimistöfokus ajetaan kaikissa
kolmessa projektissa. Aikuisten voimamoottorin kalibrointi, RIR-mukautuminen,
progressio, aikabudjetti, kuormayksiköt ja snapshot-yhteensopivuus kuuluvat lisäksi
deterministisiin yksikkö- ja integraatiotesteihin.

`npm run test:skip-audit` estää uusien `test.skip`, `describe.skip`, `it.skip`,
`test.fixme` ja `.only`-merkintöjen lisäämisen ilman tämän allowlistan tietoista
päivitystä.
