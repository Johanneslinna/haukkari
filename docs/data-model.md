# Tietomalli

Kaikilla käyttäjäkohtaisilla tauluilla on yhteinen runko: `id`, `user_id`,
`created_at`, `updated_at`, `deleted_at` ja `version`. Muuttumattomia
`plan_versions`-rivejä ei päivitetä normaalissa käyttöpolussa.

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : owns
  AUTH_USERS ||--o{ HEALTH_SCREENINGS : owns
  AUTH_USERS ||--o{ GOAL_PROFILES : owns
  GOAL_PROFILES ||--o{ GOAL_PERIODS : defines
  GOAL_PERIODS ||--o{ PLAN_VERSIONS : versions
  PLAN_VERSIONS ||--|| TRAINING_PLANS : contains
  TRAINING_PLANS ||--o{ WORKOUTS : schedules
  WORKOUT_TEMPLATES ||--o{ WORKOUTS : instantiates
  WORKOUTS ||--o{ WORKOUT_EXERCISES : contains
  WORKOUTS ||--o{ WORKOUT_LOGS : logs
  WORKOUT_LOGS ||--o{ EXERCISE_SET_LOGS : contains
  WORKOUT_LOGS ||--o| RUN_LOGS : details
  AUTH_USERS ||--o{ DAILY_CHECKINS : records
  AUTH_USERS ||--o{ NUTRITION_LOGS : records
  AUTH_USERS ||--o{ BODY_METRICS : records
  AUTH_USERS ||--o{ SPORT_PROFILES : owns
  SPORT_PROFILES ||--o{ FIXED_SPORT_SESSIONS : schedules
  SPORT_PROFILES ||--o{ COMPETITION_EVENTS : targets
  AUTH_USERS ||--o{ BASELINE_TESTS : records
  AUTH_USERS ||--o{ REASSESSMENTS : records
  AUTH_USERS ||--o{ REMINDERS : configures
  AUTH_USERS ||--o{ PUSH_SUBSCRIPTIONS : authorizes
  REMINDERS ||--o{ PUSH_DELIVERY_RECEIPTS : deduplicates
  PUSH_SUBSCRIPTIONS ||--o{ PUSH_DELIVERY_RECEIPTS : receives
  AUTH_USERS ||--o{ SYNC_DEVICES : registers
  AUTH_USERS ||--o{ SYNC_CONFLICTS : resolves
  AUTH_USERS ||--o{ SYNC_OPERATIONS : submits
```

Yhteinen liikehakemisto (`exercises`) ei sisällä käyttäjädataa. Se on
kirjautuneille luettavissa ja vain ylläpidon muokattavissa.

## Versionhallinta ja poistot

- Client lähettää nykyisen `version`-arvon; tietokanta kasvattaa arvon
  onnistuneessa päivityksessä.
- `user_id`:n vaihtaminen estetään triggerillä RLS:n lisäksi.
- Poisto merkitään ensin `deleted_at`-tombstoneksi. Fyysinen poisto on erillinen
  ylläpitotoimi.
- Vanhentunut tai push-palvelun hylkäämä laitetilaus saa tombstonen. Vain
  aktiivisen tilauksen `(user_id, endpoint)` on yksikäsitteinen, joten laite voi
  myöhemmin luoda uuden tilauksen.
- `push_delivery_receipts` on vain service rolen käsittelemä tekninen
  deduplikointitaulu eikä sisällä näkyvää ilmoitustekstiä tai terveystietoa.
- Synkronointikursori on pari `(updated_at, id)`, ei pelkkä aikaleima.
