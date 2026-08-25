import type { ExercisePrescription, ExperienceLevel } from './types'

export type ExerciseDifficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
export type ExerciseFatigueCost = 'LOW' | 'MODERATE' | 'HIGH'
export type TechniqueReviewStatus = 'VERIFIED' | 'PENDING_REVIEW'

export type ExerciseTemplate = Omit<
  ExercisePrescription,
  | 'id'
  | 'sets'
  | 'repetitions'
  | 'durationSeconds'
  | 'restSeconds'
  | 'targetRpe'
  | 'targetRir'
  | 'loadGuidance'
  | 'loadType'
  | 'loadLabelFi'
  | 'loadOptions'
  | 'keyExercise'
  | 'dose'
> & {
  difficulty: ExerciseDifficulty
  trainingEffects: string[]
  fatigueCost: ExerciseFatigueCost
  contraindications: string[]
  techniqueReviewStatus: TechniqueReviewStatus
}

type ExerciseInput = Pick<
  ExerciseTemplate,
  | 'code'
  | 'nameFi'
  | 'category'
  | 'equipment'
  | 'instructionsFi'
  | 'substitutions'
> &
  Partial<
    Pick<
      ExerciseTemplate,
      | 'stopCondition'
      | 'difficulty'
      | 'trainingEffects'
      | 'fatigueCost'
      | 'contraindications'
      | 'techniqueReviewStatus'
      | 'techniqueVideoUrl'
    >
  >

const commonStopCondition =
  'Lopeta, jos kipu voimistuu, tasapaino pettää tai tekniikka ei pysy hallittuna.'

function exercise(input: ExerciseInput): ExerciseTemplate {
  return {
    stopCondition: commonStopCondition,
    difficulty: 'BEGINNER',
    trainingEffects: [input.category],
    fatigueCost: 'MODERATE',
    contraindications: [],
    techniqueReviewStatus: 'PENDING_REVIEW',
    ...input,
  }
}

/**
 * Beta-kirjasto on eksplisiittinen ja versioitava. PENDING_REVIEW-liike voidaan
 * määrätä ohjelmaan, mutta sille ei näytetä ulkoista videolinkkiä ennen sisällön
 * ammattilaisarviota. Näin sovellus ei koskaan rakenna satunnaista YouTube-hakua.
 */
export const exerciseLibrary: ExerciseTemplate[] = [
  exercise({
    code: 'CHAIR_SQUAT', nameFi: 'Tuolilta ylösnousu', category: 'Kyykky', equipment: ['Kehonpaino'],
    instructionsFi: 'Pidä jalkapohjat maassa, nouse hallitusti ja kosketa tuolia kevyesti jokaisella toistolla.',
    substitutions: ['Kehonpainokyykky', 'Maljakyykky'], fatigueCost: 'LOW',
  }),
  exercise({
    code: 'BODYWEIGHT_SQUAT', nameFi: 'Kehonpainokyykky', category: 'Kyykky', equipment: ['Kehonpaino'],
    instructionsFi: 'Pidä paino koko jalkapohjalla, polvet varpaiden suuntaan ja käytä hallittua liikerataa.',
    substitutions: ['Tuolilta ylösnousu', 'Maljakyykky'], difficulty: 'INTERMEDIATE',
  }),
  exercise({
    code: 'GOBLET_SQUAT', nameFi: 'Maljakyykky', category: 'Kyykky', equipment: ['Käsipainot', 'Kahvakuula'],
    instructionsFi: 'Pidä paino rinnan edessä, polvet varpaiden suuntaan ja käytä kivutonta liikerataa.',
    substitutions: ['Kehonpainokyykky', 'Jalkaprässi'], difficulty: 'INTERMEDIATE',
    techniqueReviewStatus: 'VERIFIED', techniqueVideoUrl: 'https://www.youtube.com/watch?v=nfX7IFK9UNI',
  }),
  exercise({
    code: 'FRONT_SQUAT', nameFi: 'Etukyykky', category: 'Kyykky', equipment: ['Levytanko ja painot'],
    instructionsFi: 'Tue tanko etuolkapäille, pidä kyynärpäät ylhäällä ja laskeudu hallitusti.',
    substitutions: ['Maljakyykky', 'Jalkaprässi'], difficulty: 'ADVANCED', fatigueCost: 'HIGH',
    contraindications: ['rannekipu', 'olkapääkipu'],
  }),
  exercise({
    code: 'LEG_PRESS', nameFi: 'Jalkaprässi', category: 'Kyykky', equipment: ['Kuntosalilaitteet'],
    instructionsFi: 'Säädä istuin, pidä alaselkä tuettuna ja työnnä polvet varpaiden suuntaan.',
    substitutions: ['Maljakyykky', 'Tuolilta ylösnousu'], fatigueCost: 'HIGH',
  }),
  exercise({
    code: 'BOX_SQUAT', nameFi: 'Laatikkokyykky', category: 'Kyykky', equipment: ['Levytanko ja painot'],
    instructionsFi: 'Kosketa koroketta hallitusti, säilytä vartalon jännitys ja nouse ilman heilahdusta.',
    substitutions: ['Maljakyykky', 'Tuolilta ylösnousu'], difficulty: 'INTERMEDIATE', fatigueCost: 'HIGH',
  }),

  exercise({
    code: 'GLUTE_BRIDGE', nameFi: 'Lantionnosto', category: 'Lannesarana', equipment: ['Kehonpaino'],
    instructionsFi: 'Paina jalkapohjat lattiaan, nosta lantio ilman alaselän yliojennusta ja laske rauhallisesti.',
    substitutions: ['Romanialainen maastaveto', 'Bird dog'], fatigueCost: 'LOW',
  }),
  exercise({
    code: 'HIP_THRUST', nameFi: 'Hip thrust', category: 'Lannesarana', equipment: ['Levytanko ja painot'],
    instructionsFi: 'Tue yläselkä penkkiin, nosta lantio hallitusti ja pidä kylkiluut alhaalla.',
    substitutions: ['Lantionnosto', 'Romanialainen maastaveto'], difficulty: 'INTERMEDIATE', fatigueCost: 'HIGH',
  }),
  exercise({
    code: 'ROMANIAN_DEADLIFT', nameFi: 'Romanialainen maastaveto', category: 'Lannesarana', equipment: ['Käsipainot', 'Kahvakuula', 'Levytanko ja painot'],
    instructionsFi: 'Vie lantiota taakse, pidä kuorma lähellä vartaloa ja selkä hallitussa neutraaliasennossa.',
    substitutions: ['Lantionnosto', 'Taljaveto jalkojen välistä'], difficulty: 'INTERMEDIATE', fatigueCost: 'HIGH',
    contraindications: ['akuutti selkäkipu'], techniqueReviewStatus: 'VERIFIED',
    techniqueVideoUrl: 'https://www.youtube.com/watch?v=H71kODJpFus',
  }),
  exercise({
    code: 'KETTLEBELL_DEADLIFT', nameFi: 'Kahvakuulamaastaveto', category: 'Lannesarana', equipment: ['Kahvakuula'],
    instructionsFi: 'Pidä kuula jalkojen välissä, työnnä lantiota taakse ja nouse painamalla lattiaa.',
    substitutions: ['Romanialainen maastaveto', 'Lantionnosto'],
  }),
  exercise({
    code: 'CABLE_PULL_THROUGH', nameFi: 'Taljaveto jalkojen välistä', category: 'Lannesarana', equipment: ['Kuntosalilaitteet'],
    instructionsFi: 'Astu irti taljasta, vie lantiota taakse ja ojenna lantio ilman selän yliojennusta.',
    substitutions: ['Lantionnosto', 'Romanialainen maastaveto'], difficulty: 'INTERMEDIATE',
  }),
  exercise({
    code: 'TRAP_BAR_DEADLIFT', nameFi: 'Trap bar -maastaveto', category: 'Lannesarana', equipment: ['Levytanko ja painot'],
    instructionsFi: 'Asetu tangon keskelle, tue vartalo ja nouse työntämällä jalkoja lattiaan.',
    substitutions: ['Kahvakuulamaastaveto', 'Romanialainen maastaveto'], difficulty: 'ADVANCED', fatigueCost: 'HIGH',
  }),

  exercise({
    code: 'SUPPORTED_SPLIT_SQUAT', nameFi: 'Tuettu askelkyykky', category: 'Yhden jalan voima', equipment: ['Kehonpaino'],
    instructionsFi: 'Ota tarvittaessa tukea, laskeudu suoraan alas ja pidä etummainen jalkapohja maassa.',
    substitutions: ['Tuolilta ylösnousu', 'Matala porrasnousu'], fatigueCost: 'LOW',
  }),
  exercise({
    code: 'REVERSE_LUNGE', nameFi: 'Taakseaskelkyykky', category: 'Yhden jalan voima', equipment: ['Kehonpaino', 'Käsipainot'],
    instructionsFi: 'Astu taakse, laskeudu hallitusti ja palaa ylös etummaisen jalan avulla.',
    substitutions: ['Tuettu askelkyykky', 'Matala porrasnousu'], difficulty: 'INTERMEDIATE',
  }),
  exercise({
    code: 'LOW_STEP_UP', nameFi: 'Matala porrasnousu', category: 'Yhden jalan voima', equipment: ['Kehonpaino', 'Käsipainot'],
    instructionsFi: 'Aseta koko jalkapohja korokkeelle ja nouse työntämällä korokkeella olevalla jalalla.',
    substitutions: ['Tuettu askelkyykky', 'Taakseaskelkyykky'], fatigueCost: 'LOW',
  }),
  exercise({
    code: 'SINGLE_LEG_RDL', nameFi: 'Yhden jalan romanialainen maastaveto', category: 'Yhden jalan voima', equipment: ['Kehonpaino', 'Käsipainot', 'Kahvakuula'],
    instructionsFi: 'Pidä lantio suorassa, vie vapaata jalkaa taakse ja palaa ylös hallitusti.',
    substitutions: ['Romanialainen maastaveto', 'Tuettu askelkyykky'], difficulty: 'ADVANCED',
  }),
  exercise({
    code: 'LATERAL_LUNGE', nameFi: 'Sivukyykky', category: 'Yhden jalan voima', equipment: ['Kehonpaino', 'Käsipainot'],
    instructionsFi: 'Astu sivulle, vie lantiota taakse tukijalan päälle ja pidä toinen jalka pitkänä.',
    substitutions: ['Taakseaskelkyykky', 'Matala porrasnousu'], difficulty: 'INTERMEDIATE',
  }),

  exercise({
    code: 'ELEVATED_PUSH_UP', nameFi: 'Korotettu punnerrus', category: 'Työntö', equipment: ['Kehonpaino'],
    instructionsFi: 'Tue kädet vakaalle tasolle, pidä vartalo suorana ja laske rinta hallitusti kohti tukea.',
    substitutions: ['Punnerrus', 'Käsipainopunnerrus lattialla'], fatigueCost: 'LOW',
  }),
  exercise({
    code: 'PUSH_UP', nameFi: 'Punnerrus', category: 'Työntö', equipment: ['Kehonpaino'],
    instructionsFi: 'Pidä vartalo yhtenäisenä, laske rintakehä käsien väliin ja työnnä lattiaa pois.',
    substitutions: ['Korotettu punnerrus', 'Rintaprässi'], difficulty: 'INTERMEDIATE',
  }),
  exercise({
    code: 'DUMBBELL_FLOOR_PRESS', nameFi: 'Käsipainopunnerrus lattialla', category: 'Työntö', equipment: ['Käsipainot'],
    instructionsFi: 'Pidä ranteet suorina, laske olkavarret rauhallisesti lattiaan ja työnnä ilman kiirettä.',
    substitutions: ['Korotettu punnerrus', 'Rintaprässi'], techniqueReviewStatus: 'VERIFIED',
    techniqueVideoUrl: 'https://www.youtube.com/watch?v=qHCI9rK7HqM',
  }),
  exercise({
    code: 'DUMBBELL_BENCH_PRESS', nameFi: 'Käsipainopenkkipunnerrus', category: 'Työntö', equipment: ['Käsipainot'],
    instructionsFi: 'Tue jalat lattiaan, laske käsipainot hallitusti ja pidä ranteet kyynärvarsien päällä.',
    substitutions: ['Käsipainopunnerrus lattialla', 'Rintaprässi'], difficulty: 'INTERMEDIATE',
  }),
  exercise({
    code: 'CHEST_PRESS', nameFi: 'Rintaprässi', category: 'Työntö', equipment: ['Kuntosalilaitteet'],
    instructionsFi: 'Säädä istuin, tue selkä ja työnnä kahvat hallitusti eteen.',
    substitutions: ['Korotettu punnerrus', 'Käsipainopunnerrus lattialla'],
  }),
  exercise({
    code: 'LANDMINE_PRESS', nameFi: 'Landmine-punnerrus', category: 'Työntö', equipment: ['Levytanko ja painot'],
    instructionsFi: 'Pidä vartalo vakaana ja työnnä tangon pää ylös ja eteen ilman alaselän yliojennusta.',
    substitutions: ['Käsipainopunnerrus lattialla', 'Rintaprässi'], difficulty: 'INTERMEDIATE',
  }),
  exercise({
    code: 'DUMBBELL_OVERHEAD_PRESS', nameFi: 'Käsipainopystypunnerrus', category: 'Työntö', equipment: ['Käsipainot'],
    instructionsFi: 'Pidä kylkiluut hallittuina ja työnnä painot pään yläpuolelle kivuttomalla liikeradalla.',
    substitutions: ['Landmine-punnerrus', 'Rintaprässi'], difficulty: 'INTERMEDIATE', contraindications: ['olkapääkipu'],
  }),

  exercise({
    code: 'PRONE_W_RAISE', nameFi: 'Vatsamakuun W-nosto', category: 'Veto', equipment: ['Kehonpaino'],
    instructionsFi: 'Vedä kyynärpäät W-asentoon ja nosta käsiä vain vähän lapoja halliten.',
    substitutions: ['Soutu vastuskuminauhalla', 'Yhden käden soutu'], fatigueCost: 'LOW',
  }),
  exercise({
    code: 'BAND_ROW', nameFi: 'Soutu vastuskuminauhalla', category: 'Veto', equipment: ['Vastuskuminauhat'],
    instructionsFi: 'Kiinnitä nauha varmasti, vedä kyynärpäät kohti kylkiä ja palauta rauhallisesti.',
    substitutions: ['Yhden käden soutu', 'Soutu laitteessa'], fatigueCost: 'LOW',
  }),
  exercise({
    code: 'ONE_ARM_ROW', nameFi: 'Yhden käden soutu', category: 'Veto', equipment: ['Käsipainot', 'Kahvakuula'],
    instructionsFi: 'Tue vapaa käsi, vedä kyynärpää kohti kylkeä ja vältä vartalon kiertoa.',
    substitutions: ['Soutu vastuskuminauhalla', 'Soutu laitteessa'],
  }),
  exercise({
    code: 'SEATED_ROW', nameFi: 'Soutu laitteessa', category: 'Veto', equipment: ['Kuntosalilaitteet'],
    instructionsFi: 'Pidä rintakehä ryhdikkäänä ja vedä kahvat kohti kylkiä.',
    substitutions: ['Yhden käden soutu', 'Soutu vastuskuminauhalla'],
  }),
  exercise({
    code: 'LAT_PULLDOWN', nameFi: 'Ylätalja', category: 'Veto', equipment: ['Kuntosalilaitteet'],
    instructionsFi: 'Vedä tanko rintakehän yläosaa kohti ja vältä vartalon voimakasta kallistusta.',
    substitutions: ['Soutu laitteessa', 'Soutu vastuskuminauhalla'],
  }),
  exercise({
    code: 'ASSISTED_PULL_UP', nameFi: 'Avustettu leuanveto', category: 'Veto', equipment: ['Kuntosalilaitteet', 'Vastuskuminauhat'],
    instructionsFi: 'Aloita lavat hallittuina, vedä rintakehää kohti tankoa ja laskeudu rauhallisesti.',
    substitutions: ['Ylätalja', 'Soutu laitteessa'], difficulty: 'INTERMEDIATE', fatigueCost: 'HIGH',
  }),
  exercise({
    code: 'FACE_PULL', nameFi: 'Face pull taljassa', category: 'Veto', equipment: ['Kuntosalilaitteet'],
    instructionsFi: 'Vedä köysi kasvojen sivuille ja pidä hartiat alhaalla.',
    substitutions: ['Soutu vastuskuminauhalla', 'Vatsamakuun W-nosto'], fatigueCost: 'LOW',
  }),

  exercise({
    code: 'BIRD_DOG', nameFi: 'Bird dog', category: 'Keskivartalo', equipment: ['Kehonpaino'],
    instructionsFi: 'Ojenna vastakkainen käsi ja jalka ilman lantion kiertoa. Pidä hengitys rauhallisena.',
    substitutions: ['Dead bug', 'Sivulankku polvet maassa'], fatigueCost: 'LOW',
    techniqueReviewStatus: 'VERIFIED', techniqueVideoUrl: 'https://www.youtube.com/watch?v=egKWoMZ6cXM',
  }),
  exercise({
    code: 'DEAD_BUG', nameFi: 'Dead bug', category: 'Keskivartalo', equipment: ['Kehonpaino'],
    instructionsFi: 'Pidä alaselkä hallittuna, hengitä ulos ojennuksen aikana ja käytä hallitsemaasi liikerataa.',
    substitutions: ['Bird dog', 'Sivulankku polvet maassa'], fatigueCost: 'LOW',
  }),
  exercise({
    code: 'KNEELING_SIDE_PLANK', nameFi: 'Sivulankku polvet maassa', category: 'Keskivartalo', equipment: ['Kehonpaino'],
    instructionsFi: 'Tue kyynärpää olkapään alle ja nosta lantio pitäen vartalo suorana polvista päähän.',
    substitutions: ['Dead bug', 'Pallof-punnerrus'], fatigueCost: 'LOW',
  }),
  exercise({
    code: 'FRONT_PLANK', nameFi: 'Etulankku', category: 'Keskivartalo', equipment: ['Kehonpaino'],
    instructionsFi: 'Pidä kylkiluut ja lantio hallittuina ja hengitä normaalisti jännityksen aikana.',
    substitutions: ['Dead bug', 'Sivulankku polvet maassa'], fatigueCost: 'LOW',
  }),
  exercise({
    code: 'PALLOF_PRESS', nameFi: 'Pallof-punnerrus', category: 'Keskivartalo', equipment: ['Vastuskuminauhat', 'Kuntosalilaitteet'],
    instructionsFi: 'Seiso sivuttain vastukseen, työnnä kädet eteen ja vastusta vartalon kiertoa.',
    substitutions: ['Sivulankku polvet maassa', 'Dead bug'], fatigueCost: 'LOW',
  }),

  exercise({
    code: 'FARMER_CARRY', nameFi: 'Farmarikävely', category: 'Kantaminen', equipment: ['Käsipainot', 'Kahvakuula'],
    instructionsFi: 'Kanna painoja vartalon sivuilla ryhdikkäästi ja kävele hallituin askelin.',
    substitutions: ['Matkalaukkukanto', 'Etulankku'], difficulty: 'INTERMEDIATE',
  }),
  exercise({
    code: 'SUITCASE_CARRY', nameFi: 'Matkalaukkukanto', category: 'Kantaminen', equipment: ['Käsipainot', 'Kahvakuula'],
    instructionsFi: 'Kanna painoa yhdellä puolella ilman vartalon kallistumista.',
    substitutions: ['Farmarikävely', 'Pallof-punnerrus'], difficulty: 'INTERMEDIATE',
  }),

  exercise({
    code: 'MARCHING_DRILL', nameFi: 'Juoksun A-marssi', category: 'Sprintti', equipment: ['Kehonpaino'],
    instructionsFi: 'Nosta polvi napakasti, pidä nilkka aktiivisena ja liiku ryhdikkäänä.',
    substitutions: ['Matalan tehon kiihdytys', 'Nopeat polvennostot'], fatigueCost: 'LOW', trainingEffects: ['Juoksutekniikka', 'Koordinaatio'],
  }),
  exercise({
    code: 'FAST_HIGH_KNEES', nameFi: 'Nopeat polvennostot', category: 'Sprintti', equipment: ['Kehonpaino'],
    instructionsFi: 'Pidä vartalo ryhdikkäänä ja tee lyhyitä nopeita polvennostoja päkiöillä.',
    substitutions: ['Juoksun A-marssi', 'Matalan tehon kiihdytys'], fatigueCost: 'LOW', trainingEffects: ['Juoksutekniikka', 'Rytmi'],
  }),
  exercise({
    code: 'LOW_INTENSITY_ACCELERATION', nameFi: 'Matalan tehon kiihdytys', category: 'Sprintti', equipment: ['Kehonpaino'],
    instructionsFi: 'Kiihdytä tasaisesti 10–20 metriä ja lopeta veto ennen tekniikan hajoamista.',
    substitutions: ['Juoksun A-marssi', 'Kuntopyörän lyhyt kiihdytys'], difficulty: 'INTERMEDIATE', fatigueCost: 'HIGH', trainingEffects: ['Nopeus', 'Kiihdytys'],
  }),
  exercise({
    code: 'BIKE_ACCELERATION', nameFi: 'Kuntopyörän lyhyt kiihdytys', category: 'Sprintti', equipment: ['Polkupyörä, kuntopyörä tai pyörätraineri'],
    instructionsFi: 'Kiihdytä 6–10 sekuntia hallitusti ja anna sykkeen rauhoittua vetojen välissä.',
    substitutions: ['Matalan tehon kiihdytys', 'Juoksun A-marssi'], fatigueCost: 'MODERATE', trainingEffects: ['Nopeus', 'Teho'],
  }),

  exercise({
    code: 'ANKLE_HOP', nameFi: 'Nilkkahyppely', category: 'Hypyt', equipment: ['Kehonpaino'],
    instructionsFi: 'Pidä hypyt matalina ja kimmoisina sekä laskeudu hiljaa päkiän kautta.',
    substitutions: ['Nopea varpaille nousu', 'Matalan korokkeen step-up'], difficulty: 'INTERMEDIATE', fatigueCost: 'MODERATE', contraindications: ['akuutti alaraajakipu'],
  }),
  exercise({
    code: 'LOW_STEP_POWER', nameFi: 'Matalan korokkeen step-up', category: 'Hypyt', equipment: ['Kehonpaino'],
    instructionsFi: 'Nouse matalalle korokkeelle nopeasti mutta laskeudu rauhallisesti ja hallitusti.',
    substitutions: ['Nopea varpaille nousu', 'Nilkkahyppely'], fatigueCost: 'LOW', trainingEffects: ['Alavartalon teho', 'Tasapaino'],
  }),
  exercise({
    code: 'COUNTERMOVEMENT_JUMP', nameFi: 'Kevennyshyppy', category: 'Hypyt', equipment: ['Kehonpaino'],
    instructionsFi: 'Tee nopea jousto, hyppää terävästi ja laskeudu pehmeästi samaan asentoon.',
    substitutions: ['Nilkkahyppely', 'Nopea varpaille nousu'], difficulty: 'ADVANCED', fatigueCost: 'HIGH', contraindications: ['akuutti alaraajakipu'],
  }),
  exercise({
    code: 'FAST_CALF_RAISE', nameFi: 'Nopea varpaille nousu', category: 'Hypyt', equipment: ['Kehonpaino'],
    instructionsFi: 'Nouse päkiöille nopeasti, laskeudu hallitusti ja pidä nilkka suorassa.',
    substitutions: ['Nilkkahyppely', 'Matala porrasnousu'], fatigueCost: 'LOW',
  }),

  exercise({
    code: 'ANKLE_ROCK', nameFi: 'Nilkan liikkuvuus seinää vasten', category: 'Liikkuvuus', equipment: ['Kehonpaino'],
    instructionsFi: 'Vie polvea kohti seinää kantapää maassa ja pysy kivuttomalla liikeradalla.',
    substitutions: ['Pohkeen kevyt venytys', 'Matala porrasnousu'], fatigueCost: 'LOW', trainingEffects: ['Nilkan liikkuvuus'],
  }),
  exercise({
    code: 'CALF_MOBILITY', nameFi: 'Pohkeen kevyt venytys', category: 'Liikkuvuus', equipment: ['Kehonpaino'],
    instructionsFi: 'Pidä kantapää maassa ja siirrä painoa eteen vain kevyeen venytyksen tunteeseen asti.',
    substitutions: ['Nilkan liikkuvuus seinää vasten', 'Matala porrasnousu'], fatigueCost: 'LOW', trainingEffects: ['Nilkan liikkuvuus', 'Pohkeen rentous'],
  }),
  exercise({
    code: 'HIP_FLEXOR_MOBILITY', nameFi: 'Lonkan koukistajan liikkuvuus', category: 'Liikkuvuus', equipment: ['Kehonpaino'],
    instructionsFi: 'Pidä lantio neutraalina ja siirrä painoa kevyesti eteen ilman alaselän yliojennusta.',
    substitutions: ['Lonkan kierto selinmakuulla', 'Lantionnosto'], fatigueCost: 'LOW', trainingEffects: ['Lonkan liikkuvuus'],
  }),
  exercise({
    code: 'SUPINE_HIP_ROTATION', nameFi: 'Lonkan kierto selinmakuulla', category: 'Liikkuvuus', equipment: ['Kehonpaino'],
    instructionsFi: 'Pidä hartiat alustassa ja kierrä polvia rauhallisesti puolelta toiselle kivuttomalla liikeradalla.',
    substitutions: ['Lonkan koukistajan liikkuvuus', 'Cat-cow'], fatigueCost: 'LOW', trainingEffects: ['Lonkan liikkuvuus', 'Selän hallinta'],
  }),
  exercise({
    code: 'THORACIC_ROTATION', nameFi: 'Rintarangan kierto kylkimakuulla', category: 'Liikkuvuus', equipment: ['Kehonpaino'],
    instructionsFi: 'Pidä polvet yhdessä ja kierrä ylävartaloa rauhallisesti hengityksen tahdissa.',
    substitutions: ['Cat-cow', 'Vatsamakuun W-nosto'], fatigueCost: 'LOW', trainingEffects: ['Rintarangan liikkuvuus'],
  }),
  exercise({
    code: 'CAT_COW', nameFi: 'Cat-cow', category: 'Liikkuvuus', equipment: ['Kehonpaino'],
    instructionsFi: 'Pyöristä ja ojenna selkää rauhallisesti vain miellyttävällä liikeradalla.',
    substitutions: ['Rintarangan kierto kylkimakuulla', 'Bird dog'], fatigueCost: 'LOW', trainingEffects: ['Selän liikkuvuus'],
  }),
]

export function exerciseAllowedForExperience(
  template: ExerciseTemplate,
  experience: ExperienceLevel,
) {
  if (experience === 'ADVANCED') return true
  if (experience === 'INTERMEDIATE') return template.difficulty !== 'ADVANCED'
  return template.difficulty === 'BEGINNER'
}

export function exerciseConflictsWithLimitations(
  template: ExerciseTemplate,
  limitations: string,
) {
  const normalized = limitations.toLocaleLowerCase('fi-FI')
  return template.contraindications.some((item) =>
    normalized.includes(item.toLocaleLowerCase('fi-FI')),
  )
}

export function verifiedTechniqueUrl(template: ExerciseTemplate) {
  return template.techniqueReviewStatus === 'VERIFIED'
    ? template.techniqueVideoUrl
    : undefined
}
