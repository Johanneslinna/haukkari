import { createServer } from '../../node_modules/vite/dist/node/index.js'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const server = await createServer({
  root: repoRoot,
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

const generatedAt = '2026-08-27T08:00:00.000Z'

function compact(value) {
  return JSON.stringify(value)
}

try {
  const engine = await server.ssrLoadModule('/src/domain/coaching/index.ts')
  const {
    adaptNextSet,
    decideInterSessionProgression,
    evaluateReadiness,
    evaluateWorkoutFeedback,
    prescriptionDurationSeconds,
    publishedExerciseCatalog,
    resolvePrescription,
  } = engine

  function profile(patch = {}) {
    return {
      goal: 'GENERAL_FITNESS',
      experience: 'BEGINNER',
      equipment: ['Kehonpaino'],
      physicalLoad: 'MODERATE',
      minutesPerSession: 45,
      age: 35,
      generatedAt,
      readiness: 'GREEN',
      ...patch,
    }
  }

  function resolveStrength(patch = {}, durationMinutes) {
    const value = profile(patch)
    const minutes = durationMinutes ?? value.minutesPerSession
    return resolvePrescription({
      sessionId: `audit-${value.age}-${value.experience}-${value.goal}-${minutes}`,
      title: 'Auditointiharjoitus',
      kind: 'STRENGTH',
      durationMinutes: minutes,
      profile: value,
    })
  }

  function prescription(result) {
    return result.status === 'SUPPORTED' ? result.prescription : null
  }

  function hasPreciseKg(item) {
    return /\d+(?:[.,]\d+)?[–-]\d+(?:[.,]\d+)? kg/u.test(item.loadGuidance)
  }

  function selected(result) {
    return prescription(result)?.exercises.map((item) => item.code) ?? []
  }

  function totalSets(result) {
    return (
      prescription(result)?.exercises.reduce((sum, item) => sum + item.sets, 0) ?? 0
    )
  }

  function completedFeedback(patch = {}) {
    return {
      completionStatus: 'COMPLETED',
      sessionRpe: 6,
      difficulty: 'RIGHT',
      pain: 'NONE',
      painLocation: '',
      felt: 'SAME',
      notes: '',
      ...patch,
    }
  }

  const cases = []
  function record(id, status, severity, observed) {
    cases.push({ id, status, severity, observed })
  }

  const c1 = resolveStrength({ age: 18, minutesPerSession: 20 }, 20)
  const c1p = prescription(c1)
  record(
    1,
    c1p &&
      c1p.exercises.length >= 3 &&
      totalSets(c1) >= 5 &&
      c1p.exercises.every((item) => !hasPreciseKg(item))
      ? 'PASS'
      : 'FAIL',
    'P1',
    c1p
      ? `${selected(c1).join(', ')}; ${totalSets(c1)} sarjaa; ${c1p.durationMinutes}/20 min; ei tarkkaa kg:ta`
      : c1.reasonCode,
  )
  record(2, 'NOT_IMPLEMENTED', 'P1', 'Viikkopäivien liikejärjestys ja hypertrofiavolyymin ramppi eivät ole prescription-API:n syötteitä.')
  record(3, 'NOT_IMPLEMENTED', 'P1', 'RETURNING-luokkaa tai 10 viikon taukosääntöä ei ole.')

  const c4 = resolveStrength({
    age: 39,
    experience: 'BEGINNER',
    goal: 'MAX_STRENGTH',
    equipment: ['Kehonpaino', 'Käsipainot', 'Kuntosalilaitteet'],
    minutesPerSession: 45,
  })
  const c4p = prescription(c4)
  record(
    4,
    c4p?.exercises.every((item) => item.repetitions !== '4–6') ? 'PASS' : 'FAIL',
    'P1',
    c4p ? `Toistoalueet: ${[...new Set(c4p.exercises.map((item) => item.repetitions))].join(', ')}` : c4.reasonCode,
  )
  record(5, 'NOT_IMPLEMENTED', 'P1', 'Kolmen päivän pääliikekiertoa ei muodosteta eikä auditoida tässä moottorissa.')
  record(6, 'NOT_IMPLEMENTED', 'P1', 'Neljän päivän ylä-/alavartalojakoa ja 2 altistusta/liike/vko ei muodosteta.')

  const age45 = prescription(resolveStrength({ age: 45, experience: 'INTERMEDIATE' }))
  const age64 = prescription(resolveStrength({ age: 64, experience: 'INTERMEDIATE' }))
  const ageComparable = (value) =>
    value?.exercises.map(({ id: _id, ...item }) => item) ?? []
  record(
    7,
    compact(ageComparable(age45)) === compact(ageComparable(age64)) ? 'PASS' : 'FAIL',
    'P1',
    '64 vuoden ikä ei yksin muuttanut liikkeitä tai annosta.',
  )

  const c8 = resolveStrength({ age: 17, minutesPerSession: 20 })
  record(8, c8.status === 'UNSUPPORTED' ? 'PASS' : 'FAIL', 'P0', c8.status === 'UNSUPPORTED' ? c8.reasonCode : 'Prescription syntyi.')
  const c9 = resolveStrength({ age: 65, experience: 'INTERMEDIATE' })
  record(9, c9.status === 'UNSUPPORTED' ? 'PASS' : 'FAIL', 'P0', c9.status === 'SUPPORTED' ? `Prescription syntyi: ${selected(c9).join(', ')}` : c9.reasonCode)

  const c10 = resolveStrength({ age: 28, minutesPerSession: 10 }, 10)
  record(10, 'NOT_IMPLEMENTED', 'P1', `Yksi 10 min tuloste syntyi (${selected(c10).join(', ')}, ${totalSets(c10)} sarjaa), mutta A/B-viikkokiertoa ei ole.`)
  record(11, 'NOT_IMPLEMENTED', 'P1', '8–12 viikkosarjan jakamista neljälle 20 min päivälle ei mallinneta.')
  const c12 = resolveStrength({ age: 41, experience: 'INTERMEDIATE', minutesPerSession: 30 }, 30)
  const c12p = prescription(c12)
  record(12, c12p && c12p.exercises.length >= 4 && totalSets(c12) <= 10 ? 'PASS' : 'FAIL', 'P1', c12p ? `${c12p.exercises.length} liikettä, ${totalSets(c12)} sarjaa, ${c12p.durationMinutes}/30 min` : c12.reasonCode)

  const c13 = resolveStrength({
    age: 47,
    experience: 'ADVANCED',
    goal: 'MUSCLE_GAIN',
    equipment: ['Kehonpaino', 'Käsipainot', 'Kuntosalilaitteet', 'Levytanko ja painot'],
    minutesPerSession: 90,
  })
  const c13p = prescription(c13)
  record(13, c13p && c13p.exercises.length <= 8 && totalSets(c13) <= 24 && c13p.durationMinutes < 90 ? 'PASS' : 'FAIL', 'P1', c13p ? `${c13p.exercises.length} liikettä, ${totalSets(c13)} sarjaa, ${c13p.durationMinutes}/90 min` : c13.reasonCode)
  record(14, 'NOT_IMPLEMENTED', 'P1', 'Beta-vaiheen 3/4 päivän frekvenssikattoa ei ole prescription-sopimuksessa.')

  const c15 = resolveStrength({ age: 30, equipment: ['Kehonpaino', 'Vastuskuminauhat'] })
  const c15Band = prescription(c15)?.exercises.filter((item) => item.loadType === 'BAND') ?? []
  record(15, c15Band.length > 0 && c15Band.every((item) => !hasPreciseKg(item)) ? 'PASS' : 'FAIL', 'P0', `${c15Band.map((item) => item.code).join(', ') || 'ei nauhaliikettä'}; ei kg-tulostetta`)

  const otherVariantHistory = [
    { exerciseCode: 'ONE_ARM_ROW', loadKg: 24, repetitions: 10, rir: 3, completedAt: '2026-08-20T08:00:00.000Z', pain: false, techniqueOk: true },
    { exerciseCode: 'ONE_ARM_ROW', loadKg: 26, repetitions: 10, rir: 3, completedAt: '2026-08-24T08:00:00.000Z', pain: false, techniqueOk: true },
  ]
  const c16 = resolveStrength({ age: 33, equipment: ['Kehonpaino', 'Käsipainot'], strengthHistory: otherVariantHistory })
  const c16Other = prescription(c16)?.exercises.filter((item) => item.code !== 'ONE_ARM_ROW') ?? []
  record(16, c16Other.every((item) => !hasPreciseKg(item)) ? 'PASS' : 'FAIL', 'P0', 'Toisen liikevariantin historia ei tuottanut tarkkaa kg-arviota muille liikkeille.')

  const c17 = decideInterSessionProgression({
    comparableSessions: [
      { loadKg: 5, repetitions: 10, rir: 3, pain: false, techniqueOk: true },
      { loadKg: 5, repetitions: 10, rir: 3, pain: false, techniqueOk: true },
    ],
    targetRir: [2, 3],
    loadIncrementKg: 1,
  })
  record(17, c17.nextLoadKg !== undefined && c17.nextLoadKg / 5 <= 1.1 ? 'PASS' : 'FAIL', 'P0', `${c17.action}: 5 -> ${c17.nextLoadKg} kg (${c17.nextLoadKg ? Math.round((c17.nextLoadKg / 5 - 1) * 100) : 0} %)`)

  const c18 = decideInterSessionProgression({
    comparableSessions: [{ loadKg: 40, repetitions: 8, rir: 3, pain: false, techniqueOk: true }],
    targetRir: [2, 3],
    loadIncrementKg: 2.5,
  })
  record(18, c18.action === 'MAINTAIN_AND_COLLECT_MORE_DATA' ? 'PARTIAL' : 'FAIL', 'P1', `${c18.action}; toistoa ei lisätä alueen sisällä.`)
  record(19, 'PASS', 'P1', 'Puuttuva RIR ei kelpaa capability- tai progressiodataksi; kuormannosto estyy.')

  const c20 = adaptNextSet({
    prescribedLoadKg: 40,
    prescribedRepetitions: 8,
    targetRir: [2, 3],
    completedLoadKg: 40,
    completedRepetitions: 5,
    completedRir: 0,
    pain: 'NONE',
    techniqueOk: true,
    experience: 'INTERMEDIATE',
    loadIncrementKg: 2.5,
  })
  record(20, c20.action === 'DECREASE_ONE_INCREMENT' ? 'PASS' : 'FAIL', 'P1', `${c20.action}; seuraava kuorma ${c20.adjustedLoadKg} kg.`)

  const c21 = evaluateWorkoutFeedback([
    completedFeedback({ difficulty: 'TOO_HARD', sessionRpe: 9 }),
    completedFeedback({ difficulty: 'TOO_HARD', sessionRpe: 9 }),
  ])
  record(21, c21.decision.action === 'REDUCE_LOAD' ? 'PASS' : 'FAIL', 'P1', `${c21.decision.action}; setDelta ${c21.decision.setDelta}, targetRpeDelta ${c21.decision.targetRpeDelta}`)
  record(22, 'NOT_IMPLEMENTED', 'P1', 'Hypertrofian viikkovolyymiin ei ole +1 sarja/päälihas -progressiota.')
  record(23, 'FAIL', 'P0', '16 sarjan kovaa viikkokattoa ei ole; annos pienenee yhdellä vasta 12 vertailusarjan jälkeen ilman lihaskohtaista summaa.')
  record(24, 'PASS', 'P1', 'ScheduleOptimizer poistaa väliin jääneen harjoituksen eikä kasaa kuormaa; olemassa oleva regressiotesti kattaa tämän.')
  record(25, 'NOT_IMPLEMENTED', 'P1', '8–14 vuorokauden taukosääntöä ei ole.')
  record(26, 'NOT_IMPLEMENTED', 'P1', '15–27 vuorokauden taukosääntöä ei ole.')
  record(27, 'NOT_IMPLEMENTED', 'P1', '28–55 vuorokauden kaksiviikkoista paluublokkia ei ole.')
  record(28, 'NOT_IMPLEMENTED', 'P1', '56+ vuorokauden RETURNING-luokkaa ei ole; capability kyllä estää tarkan kg-arvion, jos viimeisin vertailusarja on yli 90 päivää vanha.')

  const readiness29 = evaluateReadiness({
    goal: 'GENERAL_FITNESS', plannedSession: 'STRENGTH', safetySymptoms: [],
    sleep: 'POOR', energy: 'NORMAL', stress: 'HIGH', motivation: 'NORMAL',
    soreness: 'NORMAL', illnessSymptoms: false, availableMinutes: 45,
  })
  record(29, readiness29.decision.state === 'YELLOW' && readiness29.decision.volumeMultiplier <= 0.8 ? 'PASS' : 'FAIL', 'P1', `${readiness29.decision.state}; kerroin ${readiness29.decision.volumeMultiplier}`)
  record(30, 'NOT_IMPLEMENTED', 'P2', 'Lievää DOMS 2/10 -tasoa ei voi syöttää; soreness on LOW/NORMAL/HIGH.')
  const readiness31 = evaluateReadiness({
    goal: 'GENERAL_FITNESS', plannedSession: 'STRENGTH', safetySymptoms: [],
    sleep: 'NORMAL', energy: 'NORMAL', stress: 'NORMAL', motivation: 'NORMAL',
    soreness: 'HIGH', illnessSymptoms: false, availableMinutes: 45,
  })
  record(31, readiness31.decision.volumeMultiplier <= 0.6 || readiness31.decision.allowedSession === 'RECOVERY' ? 'PASS' : 'FAIL', 'P1', `${readiness31.decision.state}; kerroin ${readiness31.decision.volumeMultiplier}`)

  record(32, 'FAIL', 'P0', 'Sarjakohtainen mukautus saa UI:sta aina pain=NONE ja techniqueOk=true; vaihtoehtoon vaihtaminen estetään ensimmäisen kirjatun sarjan jälkeen.')
  const severePain = adaptNextSet({ prescribedRepetitions: 8, targetRir: [2, 3], completedRepetitions: 1, pain: 'SEVERE', techniqueOk: false, experience: 'BEGINNER', loadIncrementKg: 2.5 })
  record(33, 'FAIL', 'P0', `${severePain.action} domainissa; aktiivisen harjoituksen UI ei välitä kipua sarjapäätökseen eikä lukitse paluuta harjoitukseen.`)

  for (const [id, symptom, expected] of [
    [34, 'CHEST_PAIN', 'RED_STOP'],
    [35, 'FAINTING', 'RED_STOP'],
    [36, 'UNUSUAL_BREATHLESSNESS', 'RED_STOP'],
    [37, 'FEVER', 'RED_STOP'],
    [38, 'NEW_NEUROLOGICAL_SYMPTOM', 'RED_STOP'],
  ]) {
    const decision = evaluateReadiness({
      goal: 'GENERAL_FITNESS', plannedSession: 'STRENGTH', safetySymptoms: [symptom],
      sleep: 'NORMAL', energy: 'NORMAL', stress: 'NORMAL', motivation: 'NORMAL',
      soreness: 'NORMAL', illnessSymptoms: false, availableMinutes: 45,
    })
    const direct112 = decision.decision.action.includes('112')
    const status =
      decision.decision.state !== expected
        ? 'FAIL'
        : id === 37 || direct112
          ? 'PASS'
          : 'PARTIAL'
    record(id, status, 'P0', `${decision.decision.state}; ${decision.decision.action}`)
  }
  record(39, 'NOT_IMPLEMENTED', 'P0', 'Yksipuolinen pohjeturvotus/leposärky ei ole daily check-inin oirevalikoimassa.')
  const c40 = resolveStrength({
    age: 39,
    experience: 'INTERMEDIATE',
    equipment: ['Kehonpaino', 'Vastuskuminauhat', 'Kuntosalilaitteet'],
    likes: 'Ylätalja',
    limitations: 'Pystyveto aiheuttaa kipua',
  })
  const c40Codes = selected(c40)
  record(40, 'FAIL', 'P0', `Valitut liikkeet eivät tällä kertaa sisältäneet pystyvetoa (${c40Codes.join(', ')}), mutta vapaa teksti ei tuottanut OVERHEAD_RESTRICTION-tagia; kielto ei ole hard constraint.`)

  const exercises = publishedExerciseCatalog.listExercises()
  const movementCoverage = Object.fromEntries(
    [...new Set(exercises.flatMap((item) => item.movementPatterns))]
      .sort()
      .map((pattern) => [pattern, exercises.filter((item) => item.movementPatterns.includes(pattern)).length]),
  )
  const catalogAudit = {
    count: exercises.length,
    movementCoverage,
    missingExpectedFamilies: ['CARRY', 'SIDE_PLANK', 'LATERAL_RAISE', 'FLOOR_PRESS', 'CHEST_SUPPORTED_ROW'].filter(
      (expected) => !exercises.some((item) => item.code.includes(expected) || item.movementPatterns.includes(expected)),
    ),
    allHaveSubstitutions: exercises.every((item) => item.substitutionCodes.length > 0),
    allPublished: exercises.every((item) => item.status === 'PUBLISHED'),
  }

  let rngState = 0x48a2c17d
  function random() {
    rngState ^= rngState << 13
    rngState ^= rngState >>> 17
    rngState ^= rngState << 5
    return (rngState >>> 0) / 0x1_0000_0000
  }
  function pick(values) {
    return values[Math.floor(random() * values.length)]
  }

  const violationCounts = {}
  const violationSamples = {}
  function violation(code, sample) {
    violationCounts[code] = (violationCounts[code] ?? 0) + 1
    if (!violationSamples[code]) violationSamples[code] = sample
  }

  const ages = [17, 18, 64, 65]
  const experiences = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']
  const goals = ['GENERAL_FITNESS', 'MAX_STRENGTH', 'MUSCLE_GAIN']
  const minutes = [10, 20, 30, 45, 60, 90]
  const equipmentProfiles = [
    ['Kehonpaino'],
    ['Kehonpaino', 'Vastuskuminauhat'],
    ['Kehonpaino', 'Käsipainot'],
    ['Kehonpaino', 'Kahvakuula'],
    ['Kehonpaino', 'Käsipainot', 'Kuntosalilaitteet', 'Levytanko ja painot'],
  ]
  const readinessStates = ['GREEN', 'YELLOW', 'ORANGE_RECOVERY', 'RED_STOP']
  const limitations = ['', 'Akuutti polvikipu', 'Akuutti selkäkipu', 'Akuutti olkapääkipu']
  const limitationTag = {
    'Akuutti polvikipu': 'ACUTE_KNEE_PAIN',
    'Akuutti selkäkipu': 'ACUTE_BACK_PAIN',
    'Akuutti olkapääkipu': 'ACUTE_SHOULDER_PAIN',
  }

  const propertyCases = 50_000
  for (let index = 0; index < propertyCases; index += 1) {
    const age = pick(ages)
    const experience = pick(experiences)
    const goal = pick(goals)
    const budget = pick(minutes)
    const equipment = pick(equipmentProfiles)
    const readiness = pick(readinessStates)
    const limitation = pick(limitations)
    const healthBlocked = random() < 0.125
    const input = {
      sessionId: `property-${index}`,
      title: 'Property audit',
      kind: 'STRENGTH',
      durationMinutes: budget,
      profile: profile({
        age,
        experience,
        goal,
        equipment,
        readiness,
        limitations: limitation,
        healthBlocked,
        minutesPerSession: budget,
      }),
    }
    const first = resolvePrescription(input)
    const second = resolvePrescription(input)
    if (compact(first) !== compact(second)) violation('NON_DETERMINISTIC', { index, input })
    if (age < 18 && first.status !== 'UNSUPPORTED') violation('AGE_UNDER_18_ALLOWED', { index, age })
    if (healthBlocked && first.status !== 'UNSUPPORTED') violation('HEALTH_BLOCK_IGNORED', { index })
    if (age >= 65 && !healthBlocked && first.status !== 'UNSUPPORTED') violation('AGE_65_BETA_SCOPE_IGNORED', { index, age })
    if ((readiness === 'RED_STOP' || readiness === 'ORANGE_RECOVERY') && !healthBlocked && age >= 18 && first.status === 'SUPPORTED') {
      violation(readiness === 'RED_STOP' ? 'RED_STOP_API_RETURNS_STRENGTH' : 'ORANGE_API_RETURNS_STRENGTH', { index, age, budget })
    }
    if (first.status !== 'SUPPORTED') continue
    const item = first.prescription
    if (prescriptionDurationSeconds(item) > budget * 60) {
      const sample = {
        index,
        age,
        experience,
        goal,
        budget,
        equipment,
        readiness,
        limitation,
        duration: prescriptionDurationSeconds(item),
        selected: item.exercises.map((exercise) => ({
          code: exercise.code,
          sets: exercise.sets,
          restSeconds: exercise.restSeconds,
        })),
      }
      violation('TIME_BUDGET_EXCEEDED', sample)
      if (age <= 64 && (readiness === 'GREEN' || readiness === 'YELLOW')) {
        violation('TIME_BUDGET_EXCEEDED_SUPPORTED_SCOPE', sample)
      }
    }
    if ((item.warmupMinutes ?? 0) <= 0 || item.warmup.length === 0) violation('WARMUP_MISSING', { index, budget })
    if (item.exercises.length === 0 || item.exercises.some((exercise) => exercise.sets < 1)) violation('EMPTY_OR_ZERO_WORK', { index, budget, equipment })
    if (item.exercises.some((exercise) => exercise.targetRir !== undefined && exercise.targetRir <= 0)) violation('FAILURE_OR_RIR_ZERO_PRESCRIBED', { index })
    if (item.exercises.some((exercise) => exercise.loadType === 'BAND' && (hasPreciseKg(exercise) || /kg/u.test(exercise.loadLabelFi)))) violation('BAND_KG_OUTPUT', { index })
    if (item.exercises.some((exercise) => hasPreciseKg(exercise))) violation('PRECISE_KG_WITHOUT_HISTORY', { index })
    if (item.exercises.some((exercise) => !exercise.equipment.some((entry) => equipment.includes(entry)))) violation('UNAVAILABLE_EQUIPMENT_SELECTED', { index, equipment, selected: item.exercises.map((exercise) => exercise.code) })
    const tag = limitationTag[limitation]
    if (tag && item.exercises.some((exercise) => publishedExerciseCatalog.getExercise(exercise.code)?.contraindicationTags.includes(tag))) violation('CONTRAINDICATED_EXERCISE_SELECTED', { index, limitation, selected: item.exercises.map((exercise) => exercise.code) })
    if (budget <= 20 && item.exercises.some((exercise) => exercise.restSeconds < 60)) violation('SHORT_SESSION_REST_BELOW_60', { index, budget })
  }

  const acceptanceSummary = cases.reduce((summary, item) => {
    summary[item.status] = (summary[item.status] ?? 0) + 1
    return summary
  }, {})
  const severitySummary = cases
    .filter((item) => item.status !== 'PASS')
    .reduce((summary, item) => {
      summary[item.severity] = (summary[item.severity] ?? 0) + 1
      return summary
    }, {})

  process.stdout.write(
    `${JSON.stringify(
      {
        auditTarget: {
          branch: 'codex/training-engine-v2',
          remoteHead: '31204a7ef2e2685712a5396b7f1a67cc197d3e9c',
          engineAndContentBaseline: 'cf14c7cea42be939b7fd2cec550af501208676ec',
          engineVersion: 'adult-resistance-1.0.0',
          contentRelease: 'adult-resistance-v1.0.0',
        },
        acceptance: { summary: acceptanceSummary, nonPassBySeverity: severitySummary, cases },
        catalog: catalogAudit,
        property: {
          seedHex: '0x48a2c17d',
          generatedCases: propertyCases,
          violationCounts,
          violationSamples,
        },
      },
      null,
      2,
    )}\n`,
  )
} finally {
  await server.close()
}
