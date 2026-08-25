import { useState, type FormEvent } from 'react'
import type {
  ExplainableDecision,
  GoalType,
  LowEnergySign,
  NutritionDecision,
} from '../../domain/coaching/types'
import { useAppData } from '../app-data/appDataContextValue'
import {
  activeGoalRecord,
  approveNutritionProposal,
  logNutrition,
} from '../coaching/coachingActions'
import {
  booleanValue,
  numberValue,
  objectValue,
  stringValue,
} from '../coaching/coachingData'

const lowEnergyOptions: Array<{ value: LowEnergySign; label: string }> = [
  { value: 'MENSTRUAL_CHANGE', label: 'Kuukautiskierto on muuttunut' },
  { value: 'DECLINING_PERFORMANCE', label: 'Suorituskyky laskee jatkuvasti' },
  { value: 'PERSISTENT_FATIGUE_OR_COLD', label: 'Jatkuva väsymys tai kylmyys' },
  {
    value: 'REPEATED_ILLNESS_OR_STRESS_INJURY',
    label: 'Toistuvat sairastelut tai rasitusvammat',
  },
  { value: 'CONCERNING_EATING_BEHAVIOUR', label: 'Syömiskäyttäytyminen huolestuttaa' },
]

export function NutritionPage() {
  const data = useAppData()
  const goal = stringValue(
    activeGoalRecord(data)?.data.primary_goal,
    'GENERAL_FITNESS',
  ) as GoalType
  const profile = data.latest('profiles')
  const settings = profile?.data.app_settings
  const trackingMode =
    settings &&
    typeof settings === 'object' &&
    !Array.isArray(settings) &&
    settings.trackingMode === 'CALORIES'
      ? 'CALORIES'
      : 'PORTIONS'
  const screeningAnswers = objectValue(data.latest('health_screenings')?.data.answers)
  const eatingDisorderHistory = Boolean(
    booleanValue(screeningAnswers.eating_disorder_history) ||
    (settings &&
      typeof settings === 'object' &&
      !Array.isArray(settings) &&
      settings.eatingDisorderHistory === true),
  )
  const dietRestrictions =
    settings &&
    typeof settings === 'object' &&
    !Array.isArray(settings) &&
    typeof settings.dietRestrictions === 'string'
      ? settings.dietRestrictions.trim()
      : ''
  const effectiveTrackingMode = eatingDisorderHistory ? 'PORTIONS' : trackingMode
  const [mode, setMode] = useState<'PORTIONS' | 'CALORIES'>(effectiveTrackingMode)
  const [energyKcal, setEnergyKcal] = useState<number | undefined>()
  const [proteinG, setProteinG] = useState<number | undefined>()
  const [meals, setMeals] = useState('Aamiainen\nLounas\nPäivällinen')
  const [lowEnergySigns, setLowEnergySigns] = useState<LowEnergySign[]>([])
  const [policy, setPolicy] = useState<ExplainableDecision<NutritionDecision> | null>(
    null,
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [renderedAt] = useState(() => Date.now())
  const weightTrend = data
    .list('body_metrics')
    .map((record) => numberValue(record.data.weight_kg, Number.NaN))
    .filter(Number.isFinite)
    .slice(-3)
  const competitions = data.list('competition_events')
  const nearestCompetitionDays = competitions.length
    ? Math.min(
        ...competitions.map((record) =>
          Math.ceil(
            (new Date(stringValue(record.data.starts_at)).getTime() - renderedAt) /
              86_400_000,
          ),
        ),
      )
    : undefined

  const toggleSign = (sign: LowEnergySign) => {
    setLowEnergySigns((current) =>
      current.includes(sign)
        ? current.filter((item) => item !== sign)
        : [...current, sign],
    )
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const result = await logNutrition(data, {
        goal,
        weightKg: numberValue(profile?.data.weight_kg) || undefined,
        reliableWeeklyWeightTrend: weightTrend,
        lowEnergySigns,
        competitionDaysUntil: nearestCompetitionDays,
        eatingDisorderHistory,
        trackingMode: mode,
        energyKcal,
        proteinG,
        meals: meals
          .split('\n')
          .map((meal) => meal.trim())
          .filter(Boolean),
      })
      setPolicy(result)
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Ravintomerkintää ei voitu tallentaa.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="page-stack">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Riittävä energia ensin</p>
          <h1>Ravinto</h1>
          <p>
            Yksittäinen painolukema ei muuta ohjausta. Energiaan vaikuttava ehdotus vaatii
            hyväksyntäsi.
          </p>
        </div>
      </header>
      <section className="two-column-grid align-start">
        <form className="surface-card form" onSubmit={submit}>
          <p className="eyebrow">Päivän merkintä</p>
          <h2>Kirjaa ateriat</h2>
          <label className="field">
            <span>Seurantatapa</span>
            <select
              value={mode}
              disabled={eatingDisorderHistory}
              onChange={(event) => setMode(event.target.value as typeof mode)}
            >
              <option value="PORTIONS">Annosmalli</option>
              <option value="CALORIES">Kalorit ja makrot</option>
            </select>
          </label>
          {eatingDisorderHistory && (
            <p className="form-note">
              Aloituskartoituksen perusteella käytössä on annosmalli. Automaattista
              energiavajeohjausta ei anneta.
            </p>
          )}
          {dietRestrictions && (
            <p className="form-note">
              <strong>Omat ruokavaliorajoitteesi:</strong> {dietRestrictions}
            </p>
          )}
          <label className="field">
            <span>Ateriat, yksi riville</span>
            <textarea
              rows={5}
              value={meals}
              onChange={(event) => setMeals(event.target.value)}
            />
          </label>
          {mode === 'CALORIES' && (
            <div className="form-grid">
              <label className="field">
                <span>Energia (kcal)</span>
                <input
                  type="number"
                  min="0"
                  value={energyKcal ?? ''}
                  onChange={(event) =>
                    setEnergyKcal(
                      event.target.value ? Number(event.target.value) : undefined,
                    )
                  }
                />
              </label>
              <label className="field">
                <span>Proteiini (g)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={proteinG ?? ''}
                  onChange={(event) =>
                    setProteinG(
                      event.target.value ? Number(event.target.value) : undefined,
                    )
                  }
                />
              </label>
            </div>
          )}
          <button className="button button-primary" disabled={pending}>
            {pending ? 'Tallennetaan…' : 'Tallenna ravintomerkintä'}
          </button>
        </form>
        <section className="surface-card">
          <p className="eyebrow">Turvarajat</p>
          <h2>Matalan energiansaatavuuden merkit</h2>
          <p className="muted-copy">
            Valitse oireet vain, jos ne ovat uusia tai toistuvia. Sovellus ei tee
            diagnoosia.
          </p>
          <div className="form">
            {lowEnergyOptions.map((option) => (
              <label className="checkbox-field" key={option.value}>
                <input
                  type="checkbox"
                  checked={lowEnergySigns.includes(option.value)}
                  onChange={() => toggleSign(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </section>
      </section>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {policy && (
        <section
          className={`surface-card nutrition-decision ${policy.decision.fatLossGuidanceActive ? '' : 'stop'}`}
          aria-live="polite"
        >
          <p className="eyebrow">Tämänhetkinen ohjaus</p>
          <h2>
            {policy.decision.energyAction === 'MAINTAIN'
              ? 'Pidä energiansaanti ennallaan'
              : policy.decision.energyAction === 'SUSPEND_DEFICIT'
                ? 'Painonpudotusohjaus on pysäytetty'
                : policy.decision.energyAction === 'PROPOSE_SMALL_SURPLUS'
                  ? 'Pieni energiaylijäämä voidaan ottaa harkintaan'
                  : 'Maltillinen energiavaje voidaan ottaa harkintaan'}
          </h2>
          <ul>
            {policy.reasons.map((reason) => (
              <li key={reason.code}>{reason.message}</li>
            ))}
          </ul>
          <ul>
            {policy.decision.guidance.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {policy.warnings.map((warning) => (
            <p className="form-error" key={warning}>
              {warning}
            </p>
          ))}
          {policy.decision.requiresUserApproval && !policy.decision.approved && (
            <div className="button-row">
              <button
                className="button button-primary"
                type="button"
                onClick={() => setPolicy(approveNutritionProposal(policy, true))}
              >
                Hyväksyn ehdotuksen
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setPolicy(approveNutritionProposal(policy, false))}
              >
                Pidä nykyinen
              </button>
            </div>
          )}
          {policy.decision.approved && policy.decision.requiresUserApproval && (
            <p className="success-message">
              Ehdotus hyväksytty. Muutos otetaan huomioon seuraavassa
              suunnitelmaversiossa.
            </p>
          )}
        </section>
      )}
      <section className="surface-card">
        <p className="eyebrow">Viimeisimmät merkinnät</p>
        <p>
          {data.list('nutrition_logs').length} ravintomerkintää tallennettuna tällä
          laitteella.
        </p>
      </section>
    </div>
  )
}
