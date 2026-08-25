insert into public.exercises (code, name_fi, category, equipment, instructions_fi)
values
  ('BODYWEIGHT_SQUAT', 'Kehonpainokyykky', 'KYYKKY', '{}', 'Kyykkää hallitulla liikeradalla kivuttomalla syvyydellä.'),
  ('GOBLET_SQUAT', 'Maljakyykky', 'KYYKKY', '{KÄSIPAINO,KAHVAKUULA}', 'Pidä paino rinnan edessä ja vartalo hallittuna.'),
  ('ROMANIAN_DEADLIFT', 'Romanialainen maastaveto', 'LANNESARANA', '{LEVYTANKO,KÄSIPAINO}', 'Vie lantiota taakse ja säilytä selän neutraali asento.'),
  ('PUSH_UP', 'Punnerrus', 'TYÖNTÖ', '{}', 'Pidä vartalo yhtenäisenä ja valitse hallittava korotus tarvittaessa.'),
  ('ONE_ARM_ROW', 'Yhden käden soutu', 'VETO', '{KÄSIPAINO,KAHVAKUULA}', 'Vedä kyynärpäätä kohti kylkeä ilman vartalon kiertoa.'),
  ('DEAD_BUG', 'Dead bug', 'KESKIVARTALO', '{}', 'Pidä hengitys rauhallisena ja alaselkä hallittuna.')
on conflict (code) do update set
  name_fi = excluded.name_fi,
  category = excluded.category,
  equipment = excluded.equipment,
  instructions_fi = excluded.instructions_fi,
  is_active = true;
