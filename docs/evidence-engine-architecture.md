# Evidence engine -arkkitehtuuri

Päivitetty: 25.8.2026
Tuotantotuki tässä julkaisussa: terveiden, vähintään 18-vuotiaiden aikuisten voimaharjoittelu.

## Päätöskerrokset

```text
EvidenceSource -> EvidenceClaim -> PrescriptionRule
                                     |
AthleteContext -> SessionObjective -> eligibility -> scoring -> capability -> dose
                                                               |
                                                        DecisionTrace
```

Ulkoinen tutkimusnäyttö ja Haukkarin konservatiivinen tuotepolitiikka ovat eri
tietueita. Tutkimus ei muuta tuotantosääntöä automaattisesti. Sisäisen betan
säännöllä on pysyvä tunnus, semanttinen versio, käyttöön hyväksytyt
claim-viitteet ja `EVIDENCE`- tai `PRODUCT_POLICY`-perusta.

Moottori ei käytä kielimallia, satunnaisuutta tai verkkoyhteyttä harjoitteen,
kuorman tai turvallisuuspäätöksen muodostamiseen. Aika, sääntöversio ja
sisältöjulkaisu injektoidaan päätökseen. Sama syöte, sama aika ja sama julkaisu
tuottavat täsmälleen saman prescriptionin ja päätösjäljen.

## Jäljitettävyys

`DecisionTrace` tallentaa:

- moottori- ja sääntöversion sekä sisältöjulkaisun;
- rakenteisen päivän tavoitteen;
- käytetyt rule- ja evidence claim -tunnukset;
- valitut harjoitteet pistekomponentteineen;
- hylätyt harjoitteet reason codeineen;
- capability-arviot ja niiden epävarmuuden;
- sarjakohtaiset mukautukset alkuperäisen ja muutetun arvon kanssa.

Käyttäjälle näytetään suomenkielinen perustelu. Tekniset tunnukset säilyvät
avautuvissa teknisissä tiedoissa, viennissä ja auditoitavassa snapshotissa.

## Turvarajat

Julkaistu aikuisten moottori ei muodosta prescriptionia alaikäiselle,
selvittämättömään terveysrajoitteeseen, raskauteen/synnytyksen jälkeiseen
tilanteeseen, kuntoutukseen tai diagnosoidun sairauden hoitoon. `SPORT`, `MATCH`
ja tarkistamaton `SPEED_POWER` palauttavat eksplisiittisen `UNSUPPORTED`-tuloksen.

Jääkiekko- ja muun lajikuorman kalenteriarkkitehtuuri on olemassa feature flagin
takana, mutta tässä sisältöjulkaisussa ei ole julkaistua lajikohtaista
prescriptionia. Juniori- ja lajilähteet ovat vain draft-claimien lähteitä.

## Evidence review

Ensimmäiset claimit odottavat ihmisen tieteellistä arviota, eikä niille ole
kirjattu keksittyä arvioijaa. Ennen julkista betaa arviointiin tarvitaan vähintään
liikuntatieteellisen koulutuksen saanut henkilö ja kokenut voima- ja
fysiikkavalmentaja. Hyväksytyt claimit tarkistetaan tämän jälkeen vähintään 12
kuukauden välein, merkittävän uuden position standin tai systemaattisen
katsauksen ilmestyessä sekä aina ennen annosrajoja muuttavaa sisältöjulkaisua.
Tieteellinen arvio ei korvaa lääketieteellistä, tietosuoja- tai tietoturva-arviota.
