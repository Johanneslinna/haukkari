# Haukkarin evidence matrix – adult resistance v1

Sisältöjulkaisu: `adult-resistance-v1.0.0`

Kohderyhmä: terveet vähintään 18-vuotiaat aikuiset

Review uusitaan viimeistään: 25.8.2027 tai aiemmin uuden keskeisen katsauksen vuoksi.

Nykyinen tila: kaikki kuusi aikuisten claimia ovat sisäisen betan teknisesti
validoituja syötteitä (`PUBLISHED_INTERNAL`), mutta niiden tieteellinen tila on
`PENDING_HUMAN_REVIEW` ja `reviewedBy` on tyhjä. Taulukko ei ole väite
ulkopuolisen asiantuntijan hyväksynnästä.

| Claim                        | Keskeiset lähteet                                                           | Tuotantokäyttö                                                                        | Rajaus                                                    |
| ---------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `CLAIM-ADULT-RT-BASE-001`    | ACSM 2026 (PMID 41843416), Currier 2023 (37414459), Pelland 2026 (41343037) | Suurten liikesuuntien voimaharjoitus, tavoite- ja kokemussidonnainen 1–5 sarjan kehys | Ei kliininen resepti eikä sama kiinteä annos kaikille     |
| `CLAIM-ADULT-RT-EFFORT-001`  | Grgic 2021 (33497853), Bastos 2024 (38563729), ACSM 2026                    | Tavoite-RIR, ei rutiininomaista failurea, toteutuneen RIR:n kirjaus                   | RIR on subjektiivinen ja aloittelijalla epävarmempi       |
| `CLAIM-ADULT-RT-LOAD-001`    | Lopez 2021 (33433148), Currier 2023                                         | Tavoitteen mukainen toistoalue ja vain riittävällä historialla kuorma-alue            | e1RM on arvio; puutteellinen data käynnistää kalibroinnin |
| `CLAIM-ADULT-RT-ROM-001`     | Alizadeh 2023 (36622555)                                                    | Hallittu käytettävissä oleva liikerata ja alkuperäiset tekniikkavihjeet               | Kipua ei käytetä liikeradan pakottamiseen                 |
| `CLAIM-ADULT-PA-BASE-001`    | WHO 2020                                                                    | Yleisen liikunnan pitkän aikavälin konteksti                                          | Väestösuositus ei ole ensimmäisen viikon pakkoannos       |
| `CLAIM-ADULT-CONCURRENT-001` | Schumann 2022 (34757594)                                                    | Yhteisen viikkosuunnittelun arkkitehtuurivalmius                                      | Ei julkaistua lajikohtaista periodisointia                |

## Haukkarin tuotepolitiikat

| Rule                 | Perusta          | Käyttäytyminen                                                                                                           |
| -------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ADULT-ONLY-001`     | `PRODUCT_POLICY` | Vähintään 18 vuotta, terve aikuinen                                                                                      |
| `RT-BASE-DOSE-001`   | `EVIDENCE`       | Tavoite-, kokemus-, aika- ja väsymyssidonnainen annos claimin rajoissa                                                   |
| `RT-RIR-001`         | `EVIDENCE`       | Tavoite-RIR ja toteutuneen RIR:n käyttö                                                                                  |
| `RT-NO-FAILURE-001`  | `PRODUCT_POLICY` | Failure ei ole oletus                                                                                                    |
| `RT-CALIBRATION-001` | `PRODUCT_POLICY` | Alle kaksi vertailukelpoista RIR-sarjaa: ei tarkkaa kiloa                                                                |
| `RT-PROGRESSION-001` | `PRODUCT_POLICY` | Kaksi onnistumista, yksi muuttuja ja yksi todellinen painoporras; yli 5 % vain pienimmän portaan kirjattuna poikkeuksena |

Juniori- ja jääkiekkolähteet ovat lähderekisterissä vain draft-claimien pohjana.
Yksikään käytössä oleva sääntö ei viittaa niihin. Raskaus, synnytyksen jälkeinen
harjoittelu, kuntoutus ja sairauskohtainen ohjelmointi ovat eksplisiittisesti
tukemattomia tässä julkaisussa.
