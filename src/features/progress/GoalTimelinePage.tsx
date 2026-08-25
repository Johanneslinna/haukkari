import type { GoalType } from '../../domain/coaching/types'
import { useAppData } from '../app-data/appDataContextValue'
import { fiDate, goalLabels, objectValue, stringValue } from '../coaching/coachingData'

export function GoalTimelinePage() {
  const data = useAppData()
  const periods = [...data.list('goal_periods')].reverse()
  return (
    <div className="page-stack">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Historia säilyy</p>
          <h1>Tavoitejaksot</h1>
          <p>Jokainen vaihto luo uuden muuttumattoman suunnitelmaversion.</p>
        </div>
      </header>
      <ol className="timeline list-reset">
        {periods.map((record) => {
          const summary = objectValue(record.data.summary)
          const goal = objectValue(summary.goal)
          const primary = stringValue(goal.primary, 'GENERAL_FITNESS') as GoalType
          return (
            <li className="surface-card timeline-item" key={record.id}>
              <div className="timeline-dot" />
              <div>
                <span className="pill">{stringValue(record.data.status)}</span>
                <h2>{goalLabels[primary]}</h2>
                <p>
                  {fiDate(stringValue(record.data.starts_on))}
                  {record.data.ends_on
                    ? ` – ${fiDate(stringValue(record.data.ends_on))}`
                    : ' – nykyhetki'}
                </p>
                <small>
                  PlanVersion {stringValue(summary.plan_version_id).slice(0, 8) || '—'}
                </small>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
