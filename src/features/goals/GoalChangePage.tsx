import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { goalStrategies } from '../../domain/coaching'
import type { GoalType } from '../../domain/coaching/types'
import { useAppData } from '../app-data/appDataContextValue'
import { createGoalChangeDraft } from '../coaching/coachingActions'
import { goalLabels } from '../coaching/coachingData'

export function GoalChangePage() {
  const data = useAppData()
  const navigate = useNavigate()
  const [primary, setPrimary] = useState<GoalType>('GENERAL_FITNESS')
  const [secondary, setSecondary] = useState<GoalType[]>([])
  const [targetDate, setTargetDate] = useState('')
  const [error, setError] = useState('')

  const toggleSecondary = (goal: GoalType) => {
    setSecondary((current) =>
      current.includes(goal)
        ? current.filter((item) => item !== goal)
        : current.length < 2
          ? [...current, goal]
          : current,
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      const draft = createGoalChangeDraft(data, {
        primary,
        secondary,
        inputs: { targetDate },
      })
      data.setGoalChangeDraft(draft)
      navigate('/tavoitteet/esikatselu')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Esikatselua ei voitu luoda.')
    }
  }

  return (
    <form className="page-stack" onSubmit={submit}>
      <header className="section-heading">
        <div>
          <p className="eyebrow">Ohjattu tavoitteen vaihto</p>
          <h1>Valitse uusi suunta</h1>
          <p>
            Nykyinen historia säilyy. Uusi tavoite alkaa oletuksena seuraavan viikon
            alusta.
          </p>
        </div>
      </header>
      <fieldset className="surface-card form">
        <legend>Uusi päätavoite</legend>
        <div className="choice-grid">
          {(Object.keys(goalStrategies) as GoalType[]).map((goal) => (
            <label className="choice-card" key={goal}>
              <input
                type="radio"
                name="new-primary-goal"
                checked={primary === goal}
                onChange={() => {
                  setPrimary(goal)
                  setSecondary((current) => current.filter((item) => item !== goal))
                }}
              />
              {goalLabels[goal]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="surface-card form">
        <legend>Sivutavoitteet (enintään 2)</legend>
        <div className="choice-grid">
          {(Object.keys(goalStrategies) as GoalType[])
            .filter((goal) => goal !== primary)
            .map((goal) => (
              <label className="choice-card" key={goal}>
                <input
                  type="checkbox"
                  checked={secondary.includes(goal)}
                  onChange={() => toggleSecondary(goal)}
                />
                {goalLabels[goal]}
              </label>
            ))}
        </div>
      </fieldset>
      <label className="surface-card field">
        <span>Tavoitepäivä tai kilpailu (valinnainen)</span>
        <input
          type="date"
          value={targetDate}
          onChange={(event) => setTargetDate(event.target.value)}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row">
        <button className="button button-primary">Esikatsele muutokset</button>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => navigate(-1)}
        >
          Peruuta
        </button>
      </div>
    </form>
  )
}
