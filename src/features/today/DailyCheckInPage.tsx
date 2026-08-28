import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type {
  GoalType,
  ReadinessDecision,
  SafetySymptom,
  SessionKind,
} from '../../domain/coaching/types'
import { useAppData } from '../app-data/appDataContextValue'
import {
  activeGoalRecord,
  activeTrainingPlan,
  saveDailyCheckIn,
} from '../coaching/coachingActions'
import {
  booleanValue,
  calendarContextForProfile,
  objectValue,
  planSessions,
  readinessLabels,
  stringValue,
} from '../coaching/coachingData'

const stateShortLabels: Record<ReadinessDecision['state'], string> = {
  GREEN: 'Vihreä',
  YELLOW: 'Keltainen',
  ORANGE_RECOVERY: 'Oranssi',
  RED_STOP: 'Punainen',
}

const symptoms: Array<{ value: SafetySymptom; label: string }> = [
  { value: 'CHEST_PAIN', label: 'Rintakipu' },
  { value: 'FAINTING', label: 'Pyörtyminen' },
  { value: 'UNUSUAL_BREATHLESSNESS', label: 'Poikkeava hengitysvaikeus' },
  { value: 'NEW_NEUROLOGICAL_SYMPTOM', label: 'Uusi neurologinen oire' },
  { value: 'FEVER', label: 'Kuume' },
  { value: 'SIGNIFICANT_DEHYDRATION', label: 'Merkittävä kuivuminen' },
  { value: 'SEVERE_ACUTE_PAIN', label: 'Voimakas akuutti kipu' },
  { value: 'JOINT_GIVING_WAY', label: 'Nivel pettää alta' },
]

export function DailyCheckInPage() {
  const data = useAppData()
  const profile = data.latest('profiles')
  const clock = calendarContextForProfile(profile)
  const goal = stringValue(
    activeGoalRecord(data)?.data.primary_goal,
    'GENERAL_FITNESS',
  ) as GoalType
  const weekday = clock.weekday
  const planned = planSessions(activeTrainingPlan(data)).find(
    (session) => session.day === weekday,
  )
  const appSettings = objectValue(profile?.data.app_settings)
  const menstrualTrackingEnabled = booleanValue(appSettings.menstrualTrackingOptIn, false)
  const [sleep, setSleep] = useState<'POOR' | 'NORMAL' | 'GOOD'>('NORMAL')
  const [energy, setEnergy] = useState<'LOW' | 'NORMAL' | 'HIGH'>('NORMAL')
  const [stress, setStress] = useState<'LOW' | 'NORMAL' | 'HIGH'>('NORMAL')
  const [motivation, setMotivation] = useState<'LOW' | 'NORMAL' | 'HIGH'>('NORMAL')
  const [soreness, setSoreness] = useState<'LOW' | 'NORMAL' | 'HIGH'>('NORMAL')
  const [safetySymptoms, setSafetySymptoms] = useState<SafetySymptom[]>([])
  const [illnessSymptoms, setIllnessSymptoms] = useState(false)
  const [unilateralCalfSwelling, setUnilateralCalfSwelling] = useState(false)
  const [calfPainAtRest, setCalfPainAtRest] = useState(false)
  const [painLocation, setPainLocation] = useState('')
  const [painSeverity, setPainSeverity] = useState<'MILD' | 'MODERATE' | 'SEVERE'>('MILD')
  const [altersGait, setAltersGait] = useState(false)
  const [availableMinutes, setAvailableMinutes] = useState('45')
  const [wantedSession, setWantedSession] = useState<SessionKind>(
    planned?.kind ?? 'EASY_ENDURANCE',
  )
  const [menstrualPhase, setMenstrualPhase] = useState<
    'MENSTRUATION' | 'FOLLICULAR' | 'OVULATION' | 'LUTEAL' | 'UNSURE'
  >('UNSURE')
  const [menstrualImpact, setMenstrualImpact] = useState<
    'NONE' | 'MILD' | 'MODERATE' | 'HIGH'
  >('NONE')
  const [expanded, setExpanded] = useState(false)
  const [decision, setDecision] = useState<ReadinessDecision | null>(null)
  const [reasons, setReasons] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const toggleSymptom = (symptom: SafetySymptom) => {
    setSafetySymptoms((current) =>
      current.includes(symptom)
        ? current.filter((item) => item !== symptom)
        : [...current, symptom],
    )
  }

  const evaluate = async (detailed: boolean) => {
    const parsedAvailableMinutes = Number(availableMinutes)
    if (
      availableMinutes.trim() === '' ||
      !Number.isInteger(parsedAvailableMinutes) ||
      parsedAvailableMinutes < 0 ||
      parsedAvailableMinutes > 240
    ) {
      setError('Anna käytettävissä oleva aika kokonaislukuna väliltä 0–240 minuuttia.')
      return
    }
    setPending(true)
    setError('')
    try {
      const result = await saveDailyCheckIn(data, {
        goal,
        plannedSession: wantedSession,
        safetySymptoms: detailed ? safetySymptoms : [],
        sleep: detailed ? sleep : 'NORMAL',
        energy: detailed ? energy : 'NORMAL',
        stress: detailed ? stress : 'NORMAL',
        motivation: detailed ? motivation : 'NORMAL',
        soreness: detailed ? soreness : 'NORMAL',
        illnessSymptoms: detailed ? illnessSymptoms : false,
        vascularSymptoms: detailed
          ? {
              rapidlyIncreasingUnilateralCalfSwelling: unilateralCalfSwelling,
              painAtRest: calfPainAtRest,
            }
          : undefined,
        newPain:
          detailed && painLocation
            ? { location: painLocation, severity: painSeverity, altersGait }
            : undefined,
        availableMinutes: parsedAvailableMinutes,
        menstrualCycle:
          detailed && menstrualTrackingEnabled
            ? { phase: menstrualPhase, symptomsImpact: menstrualImpact }
            : undefined,
      })
      setDecision(result.decision)
      setReasons(result.reasons.map((reason) => reason.message))
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Kuntotarkistusta ei voitu tallentaa.',
      )
    } finally {
      setPending(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void evaluate(true)
  }

  if (decision) {
    const className =
      decision.state === 'YELLOW'
        ? 'yellow'
        : decision.state === 'ORANGE_RECOVERY'
          ? 'orange'
          : decision.state === 'RED_STOP'
            ? 'red'
            : ''
    return (
      <div className="page-stack narrow-page">
        <header className="section-heading">
          <div>
            <p className="eyebrow">Päivän päätös</p>
            <h1>{readinessLabels[decision.state]}</h1>
          </div>
          <span className={`state-pill ${className}`}>
            <span aria-hidden="true">✓</span> {stateShortLabels[decision.state]}
          </span>
        </header>
        <section className="surface-card decision-card" aria-live="polite">
          <h2>{decision.action}</h2>
          <ul>
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          {decision.compactVariantMinutes && (
            <p>Valittu kompakti versio: {decision.compactVariantMinutes} minuuttia.</p>
          )}
          <div className="button-row">
            {decision.state !== 'RED_STOP' && decision.allowedSession !== 'REST' && (
              <Link className="button button-primary" to="/harjoitus">
                Avaa päivän harjoitus
              </Link>
            )}
            <Link className="button button-secondary" to="/">
              Takaisin Tänään-näkymään
            </Link>
          </div>
        </section>
      </div>
    )
  }

  if (!expanded) {
    return (
      <div className="page-stack narrow-page">
        <header className="section-heading">
          <div>
            <p className="eyebrow">Päivän kuntotarkistus</p>
            <h1>Onko jokin tänään poikkeavaa?</h1>
            <p>
              Kerro tarkemmin vain, jos sinulla on turvallisuusoire, uusi kipu tai vamma,
              sairausoire tai selvästi tavallisesta poikkeava olo.
            </p>
          </div>
        </header>
        <section className="surface-card form page-stack compact-stack">
          <label className="field">
            <span>Käytettävissä oleva aika tänään (min)</span>
            <input
              type="number"
              min="0"
              max="240"
              value={availableMinutes}
              inputMode="numeric"
              onChange={(event) => setAvailableMinutes(event.target.value)}
            />
          </label>
          <p className="muted-copy">
            Jos mikään ei poikkea, käytämme tavallista oloasi vastaavia oletuksia.
            Ajanpuute lyhentää harjoitusta, mutta ei muuta terveydellistä valmiutta.
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
              disabled={pending}
              onClick={() => void evaluate(false)}
            >
              {pending ? 'Arvioidaan…' : 'Ei mitään poikkeavaa'}
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setExpanded(true)}
            >
              Haluan kertoa tarkemmin
            </button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <form className="page-stack narrow-page" onSubmit={submit}>
      <header className="section-heading">
        <div>
          <p className="eyebrow">Päivän kuntotarkistus</p>
          <h1>Miltä tänään tuntuu?</h1>
          <p>
            Vastaa suhteessa omaan tavalliseen oloosi. Ajanpuute ei muuta palautumistilaa.
          </p>
        </div>
      </header>
      <button className="back-link" type="button" onClick={() => setExpanded(false)}>
        Takaisin pikakysymykseen
      </button>
      <fieldset className="surface-card form">
        <legend>Turvallisuusoireet</legend>
        <p className="muted-copy">Valitse kaikki, jotka koskevat tätä hetkeä.</p>
        <div className="choice-grid">
          {symptoms.map((symptom) => (
            <label className="choice-card" key={symptom.value}>
              <input
                type="checkbox"
                checked={safetySymptoms.includes(symptom.value)}
                onChange={() => toggleSymptom(symptom.value)}
              />
              {symptom.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="surface-card form-grid">
        <label className="field">
          <span>Uni</span>
          <select
            value={sleep}
            onChange={(event) => setSleep(event.target.value as typeof sleep)}
          >
            <option value="POOR">Tavallista huonompi</option>
            <option value="NORMAL">Tavallinen</option>
            <option value="GOOD">Tavallista parempi</option>
          </select>
        </label>
        <label className="field">
          <span>Energia</span>
          <select
            value={energy}
            onChange={(event) => setEnergy(event.target.value as typeof energy)}
          >
            <option value="LOW">Matala</option>
            <option value="NORMAL">Tavallinen</option>
            <option value="HIGH">Korkea</option>
          </select>
        </label>
        <label className="field">
          <span>Stressi</span>
          <select
            value={stress}
            onChange={(event) => setStress(event.target.value as typeof stress)}
          >
            <option value="LOW">Matala</option>
            <option value="NORMAL">Tavallinen</option>
            <option value="HIGH">Korkea</option>
          </select>
        </label>
        <label className="field">
          <span>Motivaatio</span>
          <select
            value={motivation}
            onChange={(event) => setMotivation(event.target.value as typeof motivation)}
          >
            <option value="LOW">Matala</option>
            <option value="NORMAL">Tavallinen</option>
            <option value="HIGH">Korkea</option>
          </select>
        </label>
        <label className="field">
          <span>Lihasarkuus</span>
          <select
            value={soreness}
            onChange={(event) => setSoreness(event.target.value as typeof soreness)}
          >
            <option value="LOW">Vähäinen</option>
            <option value="NORMAL">Tavallinen</option>
            <option value="HIGH">Voimakas</option>
          </select>
        </label>
        <label className="field">
          <span>Käytettävissä oleva aika (min)</span>
          <input
            type="number"
            min="0"
            max="240"
            value={availableMinutes}
            inputMode="numeric"
            onChange={(event) => setAvailableMinutes(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Toivottu harjoitustyyppi</span>
          <select
            value={wantedSession}
            onChange={(event) => setWantedSession(event.target.value as SessionKind)}
          >
            <option value="STRENGTH">Voima</option>
            <option value="EASY_ENDURANCE">Helppo kestävyys</option>
            <option value="INTERVAL">Intervalli</option>
            <option value="MOBILITY">Liikkuvuus</option>
            <option value="RECOVERY">Palauttava</option>
          </select>
        </label>
        <label className="checkbox-field align-end">
          <input
            type="checkbox"
            checked={illnessSymptoms}
            onChange={(event) => setIllnessSymptoms(event.target.checked)}
          />
          <span>Minulla on muita sairausoireita (ei kuumetta).</span>
        </label>
      </div>
      <fieldset className="surface-card form">
        <legend>Uusi kipu tai vamma</legend>
        <div className="form-grid">
          <label className="field">
            <span>Sijainti (jätä tyhjäksi, jos ei kipua)</span>
            <input
              value={painLocation}
              onChange={(event) => setPainLocation(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Voimakkuus</span>
            <select
              value={painSeverity}
              onChange={(event) =>
                setPainSeverity(event.target.value as typeof painSeverity)
              }
            >
              <option value="MILD">Lievä</option>
              <option value="MODERATE">Kohtalainen</option>
              <option value="SEVERE">Voimakas</option>
            </select>
          </label>
        </div>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={altersGait}
            onChange={(event) => setAltersGait(event.target.checked)}
          />
          <span>Kipu muuttaa kävelyä tai askelta.</span>
        </label>
      </fieldset>
      <fieldset className="surface-card form">
        <legend>Pohkeen uusi turvotus</legend>
        <p className="muted-copy">
          Vastaa molempiin kohtiin. Yhdistelmä estää harjoittelun ja ohjaa arvioon; ilman
          rinta- tai hengitysoiretta sovellus ei anna automaattista 112-ohjetta.
        </p>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={unilateralCalfSwelling}
            onChange={(event) => setUnilateralCalfSwelling(event.target.checked)}
          />
          <span>Toisessa pohkeessa on uusi, nopeasti lisääntyvä turvotus.</span>
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={calfPainAtRest}
            onChange={(event) => setCalfPainAtRest(event.target.checked)}
          />
          <span>Samassa pohkeessa tuntuu kipua myös levossa.</span>
        </label>
      </fieldset>
      {menstrualTrackingEnabled && (
        <fieldset className="surface-card form">
          <legend>Kuukautiskiertoon liittyvät oireet (vapaaehtoinen)</legend>
          <p className="muted-copy">
            Kiertovaihe ei muuta harjoitusta automaattisesti. Vain ilmoittamasi oireiden
            vaikutus huomioidaan päivän palautumisarviossa.
          </p>
          <div className="form-grid">
            <label className="field">
              <span>Vaihe</span>
              <select
                value={menstrualPhase}
                onChange={(event) =>
                  setMenstrualPhase(event.target.value as typeof menstrualPhase)
                }
              >
                <option value="UNSURE">En tiedä / en halua määritellä</option>
                <option value="MENSTRUATION">Kuukautisvuoto</option>
                <option value="FOLLICULAR">Follikkelivaihe</option>
                <option value="OVULATION">Ovulaation vaihe</option>
                <option value="LUTEAL">Luteaalivaihe</option>
              </select>
            </label>
            <label className="field">
              <span>Oireiden vaikutus tämän päivän harjoitteluun</span>
              <select
                value={menstrualImpact}
                onChange={(event) =>
                  setMenstrualImpact(event.target.value as typeof menstrualImpact)
                }
              >
                <option value="NONE">Ei vaikutusta</option>
                <option value="MILD">Vähäinen</option>
                <option value="MODERATE">Kohtalainen</option>
                <option value="HIGH">Suuri</option>
              </select>
            </label>
          </div>
        </fieldset>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-primary" disabled={pending}>
        {pending ? 'Arvioidaan…' : 'Näytä päivän suositus'}
      </button>
    </form>
  )
}
