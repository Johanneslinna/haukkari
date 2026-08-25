import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { goalStrategies } from '../../domain/coaching'
import type { GoalType } from '../../domain/coaching/types'
import { useAppData } from '../app-data/appDataContextValue'
import {
  completeOnboarding,
  hasMeaningfulRestrictionText,
} from '../coaching/coachingActions'
import { goalLabels } from '../coaching/coachingData'
import {
  hasSensitiveHealthData,
  onboardingSchema,
  type OnboardingForm,
} from './onboardingSchema'
import { HaukkariLogo } from '../../app/HaukkariLogo'

const weekdays = [
  { value: 1, label: 'Ma' },
  { value: 2, label: 'Ti' },
  { value: 3, label: 'Ke' },
  { value: 4, label: 'To' },
  { value: 5, label: 'Pe' },
  { value: 6, label: 'La' },
  { value: 7, label: 'Su' },
]

const equipmentOptions = [
  'Kehonpaino',
  'Käsipainot',
  'Levytanko ja painot',
  'Kahvakuula',
  'Vastuskuminauhat',
  'Kuntosalilaitteet',
  'Juoksumatto',
  'Polkupyörä, kuntopyörä tai pyörätraineri',
]

const equipmentPresets = [
  { label: 'Ei välineitä', equipment: ['Kehonpaino'] },
  {
    label: 'Koti',
    equipment: ['Kehonpaino', 'Käsipainot', 'Kahvakuula', 'Vastuskuminauhat'],
  },
  { label: 'Kuntosali', equipment: equipmentOptions },
] as const

const metricOptions = [
  'Harjoitusten toteuma',
  'Voimatasot',
  'Kestävyyskunto',
  'Juoksutulos',
  'Nopeus ja hyppy',
  'Liikkuvuus ja toimintakyky',
  'Paino',
  'Vyötärönympärys',
  'Koettu energia ja palautuminen',
  'Kipuvapaat harjoitukset',
]

const dataControllerName =
  import.meta.env.VITE_DATA_CONTROLLER_NAME?.trim() ||
  'Rekisterinpitäjän virallinen nimi puuttuu kehitysversiosta'
const privacyContact =
  import.meta.env.VITE_PRIVACY_CONTACT?.trim() || 'yhteystieto puuttuu kehitysversiosta'

const initialForm: OnboardingForm = {
  displayName: '',
  age: 30,
  heightCm: 168,
  weightKg: 60,
  primaryGoal: 'GENERAL_FITNESS',
  secondaryGoals: ['BODY_RECOMPOSITION'],
  targetDate: '',
  experience: 'BEGINNER',
  availableDays: [1, 3, 5],
  minutesPerSession: 45,
  minutesByDay: {
    '1': 45,
    '2': 45,
    '3': 45,
    '4': 45,
    '5': 45,
    '6': 45,
    '7': 45,
  },
  currentEnduranceMinutes: 90,
  weeklyActivities: [],
  currentWeeklyTraining: '',
  enduranceSportBackground: '',
  physicalLoad: 'MODERATE',
  equipment: ['Kehonpaino'],
  likes: '',
  dislikes: '',
  sleepHours: 7.5,
  dietRestrictions: '',
  trackingMode: 'PORTIONS',
  healthConcern: false,
  healthNotes: '',
  medicationAffectsHeartRate: false,
  pregnancyStatus: 'NOT_APPLICABLE',
  doctorRestrictions: '',
  currentInjuries: '',
  pelvicFloorSymptoms: '',
  exertionWarningSymptoms: false,
  eatingDisorderHistory: false,
  menstrualTrackingOptIn: false,
  desiredMetrics: ['Harjoitusten toteuma', 'Koettu energia ja palautuminen'],
  sensitiveConsent: false,
}

export function OnboardingPage() {
  const data = useAppData()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<OnboardingForm>(initialForm)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const toggleNumber = (field: 'availableDays', value: number) => {
    setForm((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value].sort(),
    }))
  }

  const toggleSecondary = (goal: GoalType) => {
    setForm((current) => ({
      ...current,
      secondaryGoals: current.secondaryGoals.includes(goal)
        ? current.secondaryGoals.filter((item) => item !== goal)
        : current.secondaryGoals.length < 2
          ? [...current.secondaryGoals, goal]
          : current.secondaryGoals,
    }))
  }

  const toggleString = (field: 'equipment' | 'desiredMetrics', value: string) => {
    setForm((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value],
    }))
  }

  const addWeeklyActivity = () => {
    const day = form.availableDays[0] ?? 1
    setForm((current) => ({
      ...current,
      weeklyActivities: [
        ...current.weeklyActivities,
        {
          id: crypto.randomUUID(),
          kind: 'SPORT',
          day,
          durationMinutes: 60,
          intensity: 'MODERATE',
        },
      ],
    }))
  }

  const updateWeeklyActivity = (
    id: string,
    patch: Partial<OnboardingForm['weeklyActivities'][number]>,
  ) => {
    setForm((current) => ({
      ...current,
      weeklyActivities: current.weeklyActivities.map((activity) =>
        activity.id === id ? { ...activity, ...patch } : activity,
      ),
    }))
  }

  const next = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setStep((current) => Math.min(4, current + 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const parsed = onboardingSchema.safeParse(form)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Tarkista kartoituksen tiedot.')
      return
    }
    setPending(true)
    setError('')
    try {
      await completeOnboarding(data, parsed.data)
      navigate('/', { replace: true })
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Suunnitelmaa ei voitu tallentaa.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <div className="app-brand compact">
          <HaukkariLogo compact />
        </div>
        <span>Vaihe {step}/4</span>
      </header>
      <div className="onboarding-progress" aria-label={`Kartoitus ${step}/4`}>
        <span style={{ width: `${(step / 4) * 100}%` }} />
      </div>
      <form className="onboarding-content" onSubmit={step === 4 ? submit : next}>
        {step === 1 && (
          <section className="page-stack" aria-labelledby="onboarding-basics">
            <header className="section-heading">
              <div>
                <p className="eyebrow">Aloituskartoitus</p>
                <h1 id="onboarding-basics">Sinun lähtökohtasi</h1>
                <p>Muokkaamme viikkorakenteen tavoitteen, taustan ja ajan mukaan.</p>
              </div>
            </header>
            <div className="surface-card form-grid">
              <label className="field">
                <span>Etunimi tai kutsumanimi</span>
                <input
                  autoComplete="given-name"
                  value={form.displayName}
                  onChange={(event) =>
                    setForm({ ...form, displayName: event.target.value })
                  }
                  required
                />
              </label>
              <label className="field">
                <span>Ikä</span>
                <ClearableNumberInput
                  inputMode="numeric"
                  min="18"
                  max="100"
                  value={form.age}
                  onValueChange={(age) => setForm({ ...form, age })}
                />
                <small>
                  Automaattinen ohjelmointi on tässä versiossa tarkoitettu vähintään
                  18-vuotiaille. Junioriohjelmointi ei ole vielä käytössä.
                </small>
              </label>
              <label className="field">
                <span>Pituus (cm)</span>
                <ClearableNumberInput
                  inputMode="decimal"
                  min="80"
                  max="250"
                  value={form.heightCm}
                  onValueChange={(heightCm) => setForm({ ...form, heightCm })}
                />
              </label>
              <label className="field">
                <span>Paino (kg)</span>
                <ClearableNumberInput
                  inputMode="decimal"
                  step="0.1"
                  min="20"
                  max="400"
                  value={form.weightKg}
                  onValueChange={(weightKg) => setForm({ ...form, weightKg })}
                />
              </label>
              <label className="field">
                <span>Tavoitepäivä tai kilpailupäivä (valinnainen)</span>
                <input
                  type="date"
                  value={form.targetDate}
                  onChange={(event) =>
                    setForm({ ...form, targetDate: event.target.value })
                  }
                />
              </label>
            </div>
            <fieldset className="surface-card form">
              <legend>Nykyiset säännölliset harjoitukset</legend>
              <p className="muted-copy">
                Nämä lasketaan viikkokuormaan kiinteinä tapahtumina. Vapaa tekstikenttä
                jää niiden alle vain lisätietoja varten.
              </p>
              {form.weeklyActivities.length === 0 ? (
                <p className="empty-state">Ei lisättyjä säännöllisiä tapahtumia.</p>
              ) : (
                <div className="page-stack compact-stack">
                  {form.weeklyActivities.map((activity) => (
                    <div className="surface-card form-grid" key={activity.id}>
                      <label className="field">
                        <span>Harjoitustyyppi</span>
                        <select
                          value={activity.kind}
                          onChange={(event) =>
                            updateWeeklyActivity(activity.id, {
                              kind: event.target.value as typeof activity.kind,
                            })
                          }
                        >
                          <option value="RUNNING">Juoksu tai kestävyys</option>
                          <option value="STRENGTH">Voimaharjoittelu</option>
                          <option value="SPORT">Lajiharjoitus</option>
                          <option value="OTHER">Muu liikunta</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Viikonpäivä</span>
                        <select
                          value={activity.day}
                          onChange={(event) =>
                            updateWeeklyActivity(activity.id, {
                              day: Number(event.target.value),
                            })
                          }
                        >
                          {weekdays.map((day) => (
                            <option value={day.value} key={day.value}>
                              {day.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Kesto (min)</span>
                        <ClearableNumberInput
                          min="10"
                          max="300"
                          value={activity.durationMinutes}
                          onValueChange={(durationMinutes) =>
                            updateWeeklyActivity(activity.id, { durationMinutes })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Kuormittavuus</span>
                        <select
                          value={activity.intensity}
                          onChange={(event) =>
                            updateWeeklyActivity(activity.id, {
                              intensity: event.target.value as typeof activity.intensity,
                            })
                          }
                        >
                          <option value="EASY">Kevyt</option>
                          <option value="MODERATE">Kohtalainen</option>
                          <option value="HARD">Kova</option>
                        </select>
                      </label>
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            weeklyActivities: current.weeklyActivities.filter(
                              (item) => item.id !== activity.id,
                            ),
                          }))
                        }
                      >
                        Poista tapahtuma
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                className="button button-secondary"
                type="button"
                onClick={addWeeklyActivity}
              >
                Lisää säännöllinen harjoitus
              </button>
            </fieldset>
            <fieldset className="surface-card form">
              <legend>Päätavoite</legend>
              <div className="choice-grid">
                {(Object.keys(goalStrategies) as GoalType[]).map((goal) => (
                  <label className="choice-card" key={goal}>
                    <input
                      type="radio"
                      name="primary-goal"
                      checked={form.primaryGoal === goal}
                      onChange={() =>
                        setForm({
                          ...form,
                          primaryGoal: goal,
                          secondaryGoals: form.secondaryGoals.filter(
                            (item) => item !== goal,
                          ),
                        })
                      }
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
                  .filter((goal) => goal !== form.primaryGoal)
                  .map((goal) => (
                    <label className="choice-card" key={goal}>
                      <input
                        type="checkbox"
                        checked={form.secondaryGoals.includes(goal)}
                        onChange={() => toggleSecondary(goal)}
                      />
                      {goalLabels[goal]}
                    </label>
                  ))}
              </div>
            </fieldset>
          </section>
        )}

        {step === 2 && (
          <section className="page-stack" aria-labelledby="onboarding-week">
            <header className="section-heading">
              <div>
                <p className="eyebrow">Arki ja tausta</p>
                <h1 id="onboarding-week">Toteutettava viikko</h1>
                <p>
                  Ohjelma rakennetaan nykyisestä määrästä, ei oletetusta ihanneviikosta.
                </p>
              </div>
            </header>
            <div className="surface-card form-grid">
              <label className="field">
                <span>Voimaharjoittelukokemus</span>
                <select
                  value={form.experience}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      experience: event.target.value as OnboardingForm['experience'],
                    })
                  }
                >
                  <option value="BEGINNER">Aloittelija</option>
                  <option value="INTERMEDIATE">Jonkin verran kokemusta</option>
                  <option value="ADVANCED">Kokenut</option>
                </select>
                <FieldHelp>
                  Kokemustaso määrittää voimaharjoituksen lähtösarjat, toistoalueet,
                  tavoite-RPE:n ja palautusajat. Aloittelijalle ei määrätä maksimitestejä.
                </FieldHelp>
              </label>
              <label className="field">
                <span>Oletusaika uusille harjoituspäiville (min)</span>
                <ClearableNumberInput
                  min="10"
                  max="240"
                  value={form.minutesPerSession}
                  onValueChange={(minutesPerSession) =>
                    setForm({ ...form, minutesPerSession })
                  }
                />
                <FieldHelp>
                  Tätä käytetään uutena päiväkohtaisena enimmäisaikana. Moottori
                  suosittelee varsinaisen keston tavoitteen ja harjoitustyypin mukaan,
                  eikä täytä aikaa vain siksi, että sitä on käytettävissä.
                </FieldHelp>
              </label>
              <label className="field">
                <span>Nykyinen kestävyysmäärä (min/vko)</span>
                <ClearableNumberInput
                  min="0"
                  max="2000"
                  value={form.currentEnduranceMinutes}
                  onValueChange={(currentEnduranceMinutes) =>
                    setForm({ ...form, currentEnduranceMinutes })
                  }
                />
                <FieldHelp>
                  Laske mukaan tavallinen kävely-, juoksu-, pyöräily- ja muu
                  kestävyysharjoittelu. Lähtömäärä rajoittaa erityisesti
                  kestävyystavoitteen ensimmäistä viikkoa.
                </FieldHelp>
              </label>
              <label className="field">
                <span>Työn ja arjen fyysinen kuormitus</span>
                <select
                  value={form.physicalLoad}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      physicalLoad: event.target.value as OnboardingForm['physicalLoad'],
                    })
                  }
                >
                  <option value="LOW">Pääosin kevyt</option>
                  <option value="MODERATE">Kohtalainen</option>
                  <option value="HIGH">Fyysisesti raskas</option>
                </select>
                <FieldHelp>
                  Fyysisesti raskas arki vähentää voimaharjoitusten sarjoja ja laskee
                  tavoite-RPE:tä. Valintaa käytetään ohjelmamoottorissa suoraan.
                </FieldHelp>
              </label>
              <label className="field">
                <span>Tavallinen uni (h/yö)</span>
                <ClearableNumberInput
                  inputMode="decimal"
                  step="0.5"
                  min="0"
                  max="16"
                  value={form.sleepHours}
                  onValueChange={(sleepHours) => setForm({ ...form, sleepHours })}
                />
                <FieldHelp>
                  Tämä määrittää oman tavallisen unesi vertailutason. Päivän
                  kuntotarkistuksessa arvioit, oliko uni tavallista huonompaa vai
                  parempaa; yksittäinen tuntimäärä ei yksin muuta ohjelmaa.
                </FieldHelp>
              </label>
              <label className="field">
                <span>Nykyinen viikoittainen harjoittelu</span>
                <textarea
                  rows={3}
                  placeholder="Esim. 2 salitreeniä ja 2 juoksulenkkiä"
                  value={form.currentWeeklyTraining}
                  onChange={(event) =>
                    setForm({ ...form, currentWeeklyTraining: event.target.value })
                  }
                />
                <FieldHelp>
                  Tämä tallennetaan taustatiedoksi ja näkyy omissa tiedoissasi. Moottori
                  ei yritä tulkita vapaata tekstiä automaattisesti; ohjelman määrään
                  vaikuttavat yllä oleva kestävyysmäärä, kokemustaso ja valitut päivät.
                </FieldHelp>
              </label>
              <label className="field">
                <span>Kestävyys- ja lajiharjoittelutausta</span>
                <textarea
                  rows={3}
                  placeholder="Lajit, taso ja harjoitusvuodet"
                  value={form.enduranceSportBackground}
                  onChange={(event) =>
                    setForm({ ...form, enduranceSportBackground: event.target.value })
                  }
                />
                <FieldHelp>
                  Tausta tallennetaan myöhempää lajikohtaista suunnittelua varten. Tämän
                  version automaattiseen viikkoon vaikuttavat kokemustaso ja nykyinen
                  kestävyysmäärä, eivät vapaan tekstin yksityiskohdat.
                </FieldHelp>
              </label>
            </div>
            <fieldset className="surface-card form">
              <legend>Käytettävissä olevat päivät</legend>
              <div className="choice-grid compact-choices">
                {weekdays.map((day) => (
                  <label className="choice-card" key={day.value}>
                    <input
                      type="checkbox"
                      checked={form.availableDays.includes(day.value)}
                      onChange={() => toggleNumber('availableDays', day.value)}
                    />
                    {day.label}
                  </label>
                ))}
              </div>
              <div className="day-minute-grid">
                {weekdays
                  .filter((day) => form.availableDays.includes(day.value))
                  .map((day) => (
                    <label className="field" key={`minutes-${day.value}`}>
                      <span>{day.label}: enimmäisaika (min)</span>
                      <ClearableNumberInput
                        min="10"
                        max="240"
                        value={
                          form.minutesByDay[String(day.value)] ?? form.minutesPerSession
                        }
                        onValueChange={(minutes) =>
                          setForm({
                            ...form,
                            minutesByDay: {
                              ...form.minutesByDay,
                              [String(day.value)]: minutes,
                            },
                          })
                        }
                      />
                    </label>
                  ))}
              </div>
            </fieldset>
            <fieldset className="surface-card form">
              <legend>Käytettävissä olevat välineet</legend>
              <p className="muted-copy">
                Valitse vain välineet, joita voit käyttää tavallisella treenikerralla.
                Liikkeet ja niiden korvaavat vaihtoehdot rajataan näiden mukaan.
              </p>
              <div className="button-row" aria-label="Välineiden esivalinnat">
                {equipmentPresets.map((preset) => (
                  <button
                    className="button button-secondary"
                    type="button"
                    key={preset.label}
                    onClick={() => setForm({ ...form, equipment: [...preset.equipment] })}
                  >
                    {preset.label}
                  </button>
                ))}
                <span className="muted-copy">Oma valinta: muokkaa ruutuja alta.</span>
              </div>
              <div className="choice-grid">
                {equipmentOptions.map((equipment) => (
                  <label className="choice-card" key={equipment}>
                    <input
                      type="checkbox"
                      checked={form.equipment.includes(equipment)}
                      onChange={() => toggleString('equipment', equipment)}
                    />
                    {equipment}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="surface-card form-grid">
              <label className="field">
                <span>Mieluisat harjoitukset</span>
                <textarea
                  rows={3}
                  value={form.likes}
                  onChange={(event) => setForm({ ...form, likes: event.target.value })}
                />
                <FieldHelp>
                  Moottori suosii näitä etenkin kestävyyslajin valinnassa ja käyttää niitä
                  valintojen perusteluna.
                </FieldHelp>
              </label>
              <label className="field">
                <span>Vältettävät harjoitukset</span>
                <textarea
                  rows={3}
                  value={form.dislikes}
                  onChange={(event) => setForm({ ...form, dislikes: event.target.value })}
                />
                <FieldHelp>
                  Näitä nimiä ja liiketyyppejä vältetään liikevalinnoissa silloin, kun
                  käytettävissä on turvallinen saman liikemallin vaihtoehto.
                </FieldHelp>
              </label>
              <label className="field">
                <span>Ruokavaliorajoitteet ja allergiat</span>
                <textarea
                  rows={3}
                  value={form.dietRestrictions}
                  onChange={(event) =>
                    setForm({ ...form, dietRestrictions: event.target.value })
                  }
                />
                <FieldHelp>
                  Tiedot tallennetaan ravinto-ohjauksen yhteyteen. Sovellus ei vielä
                  muodosta ruokalistoja, joten rajoitteet eivät muuta harjoitusliikkeitä.
                </FieldHelp>
              </label>
              <label className="field">
                <span>Ravinnon seurantatapa</span>
                <select
                  value={form.trackingMode}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      trackingMode: event.target.value as OnboardingForm['trackingMode'],
                    })
                  }
                >
                  <option value="PORTIONS">Annosmalli</option>
                  <option value="CALORIES">Kalorit ja makrot</option>
                </select>
                <FieldHelp>
                  Valinta avaa ravintonäkymään joko annosmallin tai kalori- ja
                  makrokirjauksen. Syömishäiriöhistoriassa käytetään aina annosmallia.
                </FieldHelp>
              </label>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="page-stack" aria-labelledby="onboarding-safety">
            <header className="section-heading">
              <div>
                <p className="eyebrow">Turvallisuus</p>
                <h1 id="onboarding-safety">Harjoitteluun vaikuttavat tiedot</h1>
                <p>
                  Sovellus ei tee diagnooseja. Selvittämätön tai rasitukseen liittyvä
                  varoitusoire estää harjoittelun, kunnes oire on arvioitu.
                </p>
              </div>
            </header>
            <fieldset className="surface-card form">
              <legend>Terveyteen vaikuttavat tiedot</legend>
              <label className="field">
                <span>Raskaus, imetys tai synnytyksen jälkeinen vaihe</span>
                <select
                  value={form.pregnancyStatus}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      pregnancyStatus: event.target
                        .value as OnboardingForm['pregnancyStatus'],
                    })
                  }
                >
                  <option value="NOT_APPLICABLE">Ei koske minua</option>
                  <option value="PREGNANT">Raskaus</option>
                  <option value="BREASTFEEDING">Imetys</option>
                  <option value="POSTPARTUM">Synnytyksen jälkeinen vaihe</option>
                  <option value="PREFER_NOT_TO_SAY">En halua kertoa</option>
                </select>
                <FieldHelp>
                  Raskaus ja varhainen synnytyksen jälkeinen vaihe poistavat kovatehoisen
                  aloituksen. Imetys tallennetaan taustatiedoksi, mutta ei yksin muuta
                  harjoitusta. Päivän oireet arvioidaan aina erikseen.
                </FieldHelp>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={form.healthConcern}
                  onChange={(event) =>
                    setForm({ ...form, healthConcern: event.target.checked })
                  }
                />
                <span>
                  Minulla on merkittävä selvittämätön terveysoire, joka voi vaikuttaa
                  turvalliseen harjoitteluun.
                </span>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={form.exertionWarningSymptoms}
                  onChange={(event) =>
                    setForm({ ...form, exertionWarningSymptoms: event.target.checked })
                  }
                />
                <span>
                  Minulla on rasitukseen liittyviä varoitusoireita, kuten rintakipua,
                  pyörtymistä tai poikkeavaa hengitysvaikeutta.
                </span>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={form.medicationAffectsHeartRate}
                  onChange={(event) =>
                    setForm({ ...form, medicationAffectsHeartRate: event.target.checked })
                  }
                />
                <span>
                  Lääkitys vaikuttaa sykkeen käyttäytymiseen. Tällöin kestävyyden tehoa
                  ohjataan RPE:llä ja puhetestillä, ei oletetulla sykealueella.
                </span>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={form.eatingDisorderHistory}
                  onChange={(event) =>
                    setForm({ ...form, eatingDisorderHistory: event.target.checked })
                  }
                />
                <span>
                  Minulla on häiriintyneen syömisen tai syömishäiriön historia. Valinta
                  poistaa automaattisen energiavajeohjauksen ja käyttää annosmallia.
                </span>
              </label>
              <label className="field">
                <span>Sairaudet ja lääkärin liikuntarajoitukset</span>
                <textarea
                  rows={3}
                  placeholder="Kirjaa vain harjoitteluun vaikuttavat tiedot"
                  value={form.doctorRestrictions}
                  onChange={(event) =>
                    setForm({ ...form, doctorRestrictions: event.target.value })
                  }
                />
                <FieldHelp>
                  Kirjattu lääkärin rajoitus poistaa kovatehoiset harjoitukset. Sovellus
                  ei tulkitse diagnoosia, joten kirjoita myös ammattilaisen antama
                  käytännön rajoitus, jos tiedät sen.
                </FieldHelp>
              </label>
              <label className="field">
                <span>Kivut, vammat, leikkaukset ja liikerajoitteet</span>
                <textarea
                  rows={3}
                  value={form.currentInjuries}
                  onChange={(event) =>
                    setForm({ ...form, currentInjuries: event.target.value })
                  }
                />
                <FieldHelp>
                  Tieto välitetään liikevalinnan rajoitteeksi ja kovatehoinen aloitus
                  poistetaan. Päivän kuntotarkistuksessa uusi kipu voi vielä keventää tai
                  estää harjoituksen.
                </FieldHelp>
              </label>
              <label className="field">
                <span>Lantionpohjan oireet (valinnainen)</span>
                <textarea
                  rows={3}
                  value={form.pelvicFloorSymptoms}
                  onChange={(event) =>
                    setForm({ ...form, pelvicFloorSymptoms: event.target.value })
                  }
                />
                <FieldHelp>
                  Oire poistaa kovatehoisen aloituksen. Sovellus ei päättele turvallisia
                  liikkeitä vapaasta tekstistä, joten hyödynnä ammattilaisen ohjeita.
                </FieldHelp>
              </label>
              <label className="field">
                <span>Lisätiedot ja ammattilaisen ohjeet (valinnainen)</span>
                <textarea
                  rows={4}
                  value={form.healthNotes}
                  onChange={(event) =>
                    setForm({ ...form, healthNotes: event.target.value })
                  }
                />
                <FieldHelp>
                  Tämä tallennetaan terveyskartoitukseen ja omaan tietovientiisi. Vapaan
                  tekstin sisältöä ei tulkita diagnoosiksi, automaattiseksi hoito-ohjeeksi
                  tai liikevalinnaksi.
                </FieldHelp>
              </label>
            </fieldset>
            <label className="surface-card checkbox-field">
              <input
                type="checkbox"
                checked={form.menstrualTrackingOptIn}
                onChange={(event) =>
                  setForm({ ...form, menstrualTrackingOptIn: event.target.checked })
                }
              />
              <span>
                Haluan seurata kuukautiskiertoon liittyviä oireita vapaaehtoisesti.
                Valinta avaa oireseurannan päivän kuntotarkistukseen. Kierron vaihe ei
                yksin muuta harjoitusta, mutta ilmoittamasi oireiden vaikutus voi keventää
                päivän suositusta.
              </span>
            </label>
          </section>
        )}

        {step === 4 && (
          <section className="page-stack" aria-labelledby="onboarding-confirmation">
            <header className="section-heading">
              <div>
                <p className="eyebrow">Seuranta ja vahvistus</p>
                <h1 id="onboarding-confirmation">Valitse sinulle hyödylliset mittarit</h1>
                <p>
                  Voit muuttaa valintoja myöhemmin. Painon tai mittojen seuraaminen ei ole
                  sovelluksen käytön edellytys.
                </p>
              </div>
            </header>
            <fieldset className="surface-card form">
              <legend>Halutut kehitysmittarit</legend>
              <div className="choice-grid">
                {metricOptions.map((metric) => (
                  <label className="choice-card" key={metric}>
                    <input
                      type="checkbox"
                      checked={form.desiredMetrics.includes(metric)}
                      onChange={() => toggleString('desiredMetrics', metric)}
                    />
                    {metric}
                  </label>
                ))}
              </div>
            </fieldset>
            <section className="surface-card">
              <p className="eyebrow">Suunnitelman yhteenveto</p>
              <h2>{goalLabels[form.primaryGoal]}</h2>
              <p>
                {form.availableDays.length} mahdollista harjoituspäivää. Päiväkohtaiset
                enimmäisajat:{' '}
                {weekdays
                  .filter((day) => form.availableDays.includes(day.value))
                  .map(
                    (day) =>
                      `${day.label} ${form.minutesByDay[String(day.value)] ?? form.minutesPerSession} min`,
                  )
                  .join(', ')}
                . Moottori suosittelee kullekin harjoitukselle tavoitteen mukaisen keston
                näiden rajojen sisällä. Uusi jakso alkaa seuraavan viikon alusta.
              </p>
              {(form.healthConcern || form.exertionWarningSymptoms) && (
                <p className="form-error">
                  Harjoittelun aloitus estetään, kunnes varoitusoire on arvioitu.
                </p>
              )}
              {!form.healthConcern &&
                !form.exertionWarningSymptoms &&
                (hasMeaningfulRestrictionText(form.doctorRestrictions) ||
                  hasMeaningfulRestrictionText(form.currentInjuries) ||
                  hasMeaningfulRestrictionText(form.pelvicFloorSymptoms) ||
                  form.pregnancyStatus === 'PREGNANT' ||
                  form.pregnancyStatus === 'POSTPARTUM') && (
                  <p className="form-note">
                    Kovatehoinen aloitus poistetaan ja ohjelma huomioi ilmoitetut
                    rajoitteet konservatiivisesti.
                  </p>
                )}
            </section>
            {hasSensitiveHealthData(form) ? (
              <section className="surface-card consent-card">
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={form.sensitiveConsent}
                    onChange={(event) =>
                      setForm({ ...form, sensitiveConsent: event.target.checked })
                    }
                  />
                  <span>
                    Annan nimenomaisen suostumukseni siihen, että antamiani
                    terveysseulonta-, vamma-, rajoite- ja palautumistietoja käsitellään
                    turvallisen ja yksilöllisen harjoitusohjelman muodostamiseksi.
                  </span>
                </label>
                <p className="muted-copy">
                  Rekisterinpitäjä: {dataControllerName}. Tietosuoja-asioiden yhteys:{' '}
                  {privacyContact}. Suostumus on vapaaehtoinen ja sen voi perua sekä
                  tiedot poistaa Omat tiedot -näkymässä. Peruuttaminen ei vaikuta ennen
                  peruuttamista tehdyn käsittelyn lainmukaisuuteen. Lue myös{' '}
                  <Link to="/tietosuoja">tietojen käsittelyn kuvaus</Link>.
                </p>
                {!import.meta.env.VITE_DATA_CONTROLLER_NAME && (
                  <p className="form-error">
                    Julkaisun esto: rekisterinpitäjän virallinen nimi ja yhteystieto on
                    määritettävä ympäristöasetuksiin ennen tuotantokäyttöä.
                  </p>
                )}
              </section>
            ) : (
              <p className="surface-card muted-copy">
                Et antanut vapaaehtoisia terveystietoja, joten erillistä terveystietojen
                käsittelysuostumusta ei pyydetä. Saat yleisen ohjelman muiden valintojesi
                perusteella.
              </p>
            )}
          </section>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <footer className="onboarding-actions">
          {step > 1 && (
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setStep(step - 1)}
            >
              Takaisin
            </button>
          )}
          <button className="button button-primary" disabled={pending || !data.deviceId}>
            {pending
              ? 'Luodaan suunnitelmaa…'
              : step === 4
                ? 'Vahvista ja luo suunnitelma'
                : 'Jatka'}
          </button>
        </footer>
      </form>
    </main>
  )
}

function FieldHelp({ children }: { children: ReactNode }) {
  return (
    <details className="field-help">
      <summary>Mitä tämä tarkoittaa?</summary>
      <p>{children}</p>
    </details>
  )
}

function ClearableNumberInput({
  value,
  onValueChange,
  inputMode = 'numeric',
  min,
  max,
  step,
}: {
  value: number
  onValueChange: (value: number) => void
  inputMode?: 'numeric' | 'decimal'
  min?: string
  max?: string
  step?: string
}) {
  const [draft, setDraft] = useState(String(value))

  return (
    <input
      inputMode={inputMode}
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      onChange={(event) => {
        const next = event.target.value
        setDraft(next)
        if (next.trim() === '') return
        const parsed = Number(next)
        if (Number.isFinite(parsed)) onValueChange(parsed)
      }}
      onBlur={() => {
        if (draft.trim() === '') setDraft(String(value))
      }}
    />
  )
}
