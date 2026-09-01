## Muutos

Kuvaa käyttäjälle tai järjestelmälle näkyvä lopputulos.

## Rajaus

- [ ] Muutos ei sisällä ilmoittamattomia ominaisuuksia tai refaktorointia.
- [ ] Harjoittelumoottorin, terveystietojen tai tietokannan vaikutus on kuvattu.
- [ ] Migraatiot ovat additiivisia ja vanha historia säilyy luettavana, tai kohta ei sovellu.

## Varmennus

- [ ] `Release gate` on vihreä PR:n uusimmalla commitilla.
- [ ] Käyttäjäpolku on tarkistettu selaimessa, tai muutos ei koske käyttöliittymää.
- [ ] Uudet testiohitukset on perusteltu `docs/e2e-skip-audit.md`-tiedostossa.
- [ ] PR ei sisällä salaisuuksia, tuotantotunnuksia tai henkilötietoja.

## Katselmointi

- [ ] Riskialttein päätös ja siihen liittyvä tiedosto on nimetty.
- [ ] Käyttäjälle näkyvät tekstit ja tekniset päätöslokit on erotettu toisistaan.
- [ ] Tieteellistä tai lääketieteellistä hyväksyntää ei väitetä ilman nimettyä arvioijaa.

## Julkaisu

- [ ] Tämä PR ei julkaise palvelua tai muuta hosted-ympäristöä.
- [ ] Erillinen julkaisu- ja palautussuunnitelma on kirjattu, tai julkaisu ei kuulu PR:ään.
