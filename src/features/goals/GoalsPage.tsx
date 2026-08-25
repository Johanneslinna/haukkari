import { Link, useNavigate } from 'react-router-dom'
import type { GoalType, SessionKind } from '../../domain/coaching/types'
import { getGoalStrategy } from '../../domain/coaching'
import { useAppData } from '../app-data/appDataContextValue'
import {
  activeGoalRecord,
  createPreviousGoalRestoreDraft,
} from '../coaching/coachingActions'
import {
  arrayValue,
  goalLabels,
  sessionLabels,
  stringValue,
} from '../coaching/coachingData'

export function GoalsPage() {
  const data = useAppData()
  const navigate = useNavigate()
  const record = activeGoalRecord(data)
  const primary = stringValue(record?.data.primary_goal, 'GENERAL_FITNESS') as GoalType
  const secondary = arrayValue(record?.data.secondary_goals).filter(
    (value): value is GoalType => typeof value === 'string',
  )
  const strategy = getGoalStrategy(primary)
  const canRestore = data.list('goal_periods').length > 1

  const restore = () => {
    try {
      data.setGoalChangeDraft(createPreviousGoalRestoreDraft(data))
      navigate('/tavoitteet/esikatselu')
    } catch {
      return
    }
  }

  return (
    <div className="page-stack">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Nykyinen tavoitejakso</p>
          <h1>{goalLabels[primary]}</h1>
          <p>Yksi päätavoite ohjaa ohjelmaa. Sivutavoitteet saavat ylläpitoannoksen.</p>
        </div>
        <div className="button-row">
          {canRestore && (
            <button className="button button-secondary" type="button" onClick={restore}>
              Palauta edellinen
            </button>
          )}
          <Link className="button button-primary" to="/tavoitteet/vaihda">
            Vaihda tavoitetta
          </Link>
        </div>
      </header>

      <section className="two-column-grid">
        <article className="surface-card">
          <p className="eyebrow">Viikkorakenne</p>
          <ul className="list-reset stack-list">
            {Object.entries(strategy.weeklyStructure).map(([kind, range]) => (
              <li key={kind}>
                <strong>{sessionLabels[kind as SessionKind]}</strong>
                <span>
                  {range?.min}–{range?.max} kertaa viikossa
                </span>
              </li>
            ))}
          </ul>
        </article>
        <article className="surface-card">
          <p className="eyebrow">Sivutavoitteet</p>
          {secondary.length ? (
            <ul className="list-reset stack-list">
              {secondary.map((goal) => (
                <li key={goal}>{goalLabels[goal]}</li>
              ))}
            </ul>
          ) : (
            <p className="muted-copy">Ei sivutavoitteita tässä jaksossa.</p>
          )}
        </article>
      </section>

      <section className="surface-card">
        <p className="eyebrow">Mitä seurataan</p>
        <div className="tag-list">
          {strategy.metrics.map((metric) => (
            <span className="pill" key={metric}>
              {metric}
            </span>
          ))}
        </div>
      </section>
      <section className="surface-card">
        <p className="eyebrow">Ravintopainotus</p>
        <h2>
          {strategy.nutrition.energyFocus === 'MAINTENANCE'
            ? 'Ylläpitoenergia'
            : strategy.nutrition.energyFocus === 'PERFORMANCE_FUELING'
              ? 'Suorituskyvyn tankkaus'
              : strategy.nutrition.energyFocus === 'ADEQUATE_ENERGY'
                ? 'Riittävä energiansaanti'
                : 'Käyttäjän hyväksymä energiamuutos'}
        </h2>
        <ul>
          {strategy.nutrition.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
