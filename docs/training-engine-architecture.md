# Harjoittelumoottorin arkkitehtuuri

## Päätösputki

Haukkari käyttää determinististä putkea:

1. aloituskartoitus muodostaa tavoite-, kokemus-, aika-, väline-, arjen kuorma- ja rajoiteprofiilin;
2. `PlanGenerator` valitsee tavoitteeseen sopivan viikkorakenteen;
3. `TrainingPrescriptionEngine` muuttaa harjoitustyypin suoritettavaksi reseptiksi;
4. päivän kuntotarkistus valitsee täyden, kevennetyn, kompaktin, palauttavan tai estetyn toteutuksen;
5. aktiivinen harjoitus tallentaa sarjat, toistot ja kuormat offline-first-malliin;
6. loppupalaute tuottaa `WorkoutFeedbackEngine`-päätöksen seuraavalle harjoitukselle;
7. suunnitelma, toteuma, palaute ja versionumero näkyvät historiassa.

Sama syöte ja sama sääntöversio tuottavat saman reseptin. Generatiivinen tekoäly ei ole kuorman tai turvallisuuden päätöksentekijä.

## Keskeiset tietotyypit

- `PrescribedSession`: lämmittely, järjestetty liikelista, sarjat/toistot tai kesto, palautus, tavoite-RPE/RIR, kuorman valinta, loppuverryttely ja progressio.
- `ExercisePrescription`: liikkeen toteutusohje, välineet, keskeytysehto ja vaihtoehdot.
- `DecisionTrace`: sääntöversio, syötteiden yhteenveto, puuttuvat tiedot, turvallisuustulos ja jokainen lauennut sääntö.
- `WorkoutFeedback`: toteuma, koko harjoituksen RPE, vaikeus, kipu, olo harjoituksen jälkeen ja vapaa muistiinpano.
- `WorkoutProgressionDecision`: ylläpidä, lisää yhtä volyymimuuttujaa, kevennä, palaudu tai ohjaa arvioon.

## Tallennus ja jäljitettävyys

- `training_plans.plan` sisältää versionoidun viikkosuunnitelman ja reseptit.
- `workouts.prescription` on harjoituksen aloitushetken muuttumaton reseptisnapshot.
- `workouts.decision_trace` kertoo, miksi kyseinen versio valittiin.
- `workout_exercises.prescription` säilyttää liikkeen suunnitellun annoksen.
- `exercise_set_logs` säilyttää toteutuneet sarjat, toistot, kuormat ja valmistilan.
- `workout_logs.feedback` ja `completion_status` säilyttävät loppupalautteen.

Kaikki käyttäjäkohtaiset taulut käyttävät olemassa olevaa paikallista outboxia, versiointia, tombstone-poistoa ja Supabasen RLS-eristystä.

## Progression invariantit

- väliin jäänyttä harjoitusta ei siirretä tuplakuormana;
- tavoite ei vaihdu päivän valmiuden tai yksittäisen palautteen perusteella;
- yhdessä progression päätöksessä muuttuu vain yksi päämuuttuja;
- voimakas kipu ei koskaan johda kuorman nostoon;
- keltainen valmius laskee sarjamäärää ja tavoite-RPE:tä;
- oranssi valmius tai haitallinen edellinen vaste vaihtaa palauttavaan harjoitukseen;
- kompakti versio säilyttää avainliikkeet ennen tukiliikkeitä.

## Nykyinen kattavuus

Ensimmäinen tuotantokelpoinen pystyleikkaus kattaa yleiskunnon, voiman/lihasmassan perusrakenteen, helpon kestävyyden, hallitun intervallin, liikkuvuuden ja palauttavan harjoituksen. Lajisovittimet säilyvät viikkotasolla. Raskaus, synnytyksen jälkeinen paluu, nuoret, diagnosoidut sairaudet, kuntoutus ja täysi kilpaurheilun ohjelmointi on tarkoituksella rajattu erillisiin asiantuntija- ja validointimoduuleihin.
