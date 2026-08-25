import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import type { GoalConflictCode, SessionKind } from '../../domain/coaching/types'
import { useAppData } from '../app-data/appDataContextValue'
import { activateGoalDraft } from '../coaching/coachingActions'
import { fiDate, goalLabels, sessionLabels } from '../coaching/coachingData'

export function GoalPreviewPage() {
  const data = useAppData()
  const navigate = useNavigate()
  const draft = data.goalChangeDraft
  const [choices, setChoices] = useState<Partial<Record<GoalConflictCode, string>>>({})
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  if (!draft) return <Navigate to="/tavoitteet/vaihda" replace />

  const comparison = draft.preview.comparison
  const confirm = async () => {
    setPending(true)
    setError('')
    try {
      await activateGoalDraft(data, draft, choices)
      data.setGoalChangeDraft(null)
      navigate('/tavoitteet', { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Tavoitetta ei voitu vaihtaa.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="page-stack">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Muutosten esikatselu</p>
          <h1>{goalLabels[draft.profile.primary]}</h1>
          <p>
            Alkaa {fiDate(draft.preview.startsOn)}
            {draft.preview.transitionWeek ? ' siirtymäviikolla.' : '.'}
          </p>
        </div>
      </header>
      <section className="comparison-grid">
        <article className="surface-card">
          <p className="eyebrow">Nykyinen</p>
          <h2>
            {draft.preview.currentGoal
              ? goalLabels[draft.preview.currentGoal]
              : 'Ei aiempaa tavoitetta'}
          </h2>
          <p>{comparison.currentNutritionFocus ?? 'Ei ravintopainotusta'}</p>
        </article>
        <article className="surface-card comparison-new">
          <p className="eyebrow">Uusi</p>
          <h2>{goalLabels[draft.profile.primary]}</h2>
          <p>{comparison.proposedNutritionFocus}</p>
        </article>
      </section>
      <section className="surface-card">
        <p className="eyebrow">Uusi viikkorakenne</p>
        <ul className="list-reset stack-list">
          {Object.entries(comparison.proposedWeeklyStructure).map(([kind, range]) => (
            <li key={kind}>
              <strong>{sessionLabels[kind as SessionKind]}</strong>
              <span>
                {range?.min}–{range?.max} kertaa
              </span>
            </li>
          ))}
        </ul>
      </section>
      {draft.preview.conflicts.map((conflict) => (
        <fieldset className="surface-card conflict-warning" key={conflict.code}>
          <legend>Valinta tarvitaan</legend>
          <h2>{conflict.message}</h2>
          <div className="choice-grid">
            {conflict.choices.map((choice) => (
              <label className="choice-card" key={choice}>
                <input
                  type="radio"
                  name={conflict.code}
                  checked={choices[conflict.code] === choice}
                  onChange={() => setChoices({ ...choices, [conflict.code]: choice })}
                />
                {choice}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <section className="surface-card">
        <p>
          <strong>Vanha historia säilyy.</strong> Vahvistus luo uuden muuttumattoman
          suunnitelmaversion.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="button-row">
          <button
            className="button button-primary"
            type="button"
            onClick={() => void confirm()}
            disabled={pending}
          >
            {pending ? 'Vaihdetaan…' : 'Vahvista uusi tavoite'}
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => navigate(-1)}
          >
            Takaisin
          </button>
        </div>
      </section>
    </div>
  )
}
