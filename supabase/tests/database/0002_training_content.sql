begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

select has_table(
  'public',
  'training_content_releases',
  'sisältöjulkaisujen rekisteri on olemassa'
);

select has_table(
  'public',
  'exercise_definitions',
  'versionoidut harjoitemäärittelyt ovat olemassa'
);

select is(
  (
    select count(*)::integer
    from public.exercise_definitions
    where content_release_id = 'adult-resistance-v1.0.0'
  ),
  27,
  'beta-julkaisun kaikki 27 harjoitemäärittelyä on seedattu'
);

insert into public.training_content_releases (
  release_id,
  semantic_version,
  status,
  content_digest,
  published_at,
  immutable
) values (
  'adult-resistance-v1.1.0-test',
  '1.1.0',
  'INTERNAL_BETA',
  'test-digest',
  now(),
  true
);

select lives_ok(
  $$insert into public.exercise_definitions (
      content_release_id, exercise_code, definition_version, name_fi, definition
    ) values (
      'adult-resistance-v1.1.0-test', 'GOBLET_SQUAT', '1.1.0', 'Maljakyykky',
      '{"code":"GOBLET_SQUAT","version":"1.1.0"}'::jsonb
    )$$,
  'sama vakaa harjoitekoodi voidaan tallentaa uuteen sisältöjulkaisuun'
);

select is(
  (
    select count(*)::integer
    from public.exercise_definitions
    where exercise_code = 'GOBLET_SQUAT'
      and content_release_id in (
        'adult-resistance-v1.0.0',
        'adult-resistance-v1.1.0-test'
      )
  ),
  2,
  'vanha ja uusi harjoitemäärittely säilyvät rinnakkain'
);

select throws_ok(
  $$update public.exercise_definitions
    set definition = '{"tampered":true}'::jsonb
    where content_release_id = 'adult-resistance-v1.0.0'
      and exercise_code = 'GOBLET_SQUAT'$$,
  '23000',
  'published training content is immutable',
  'julkaistua harjoitemäärittelyä ei voi muuttaa'
);

select throws_ok(
  $$delete from public.training_content_releases
    where release_id = 'adult-resistance-v1.0.0'$$,
  '23000',
  'published training content is immutable',
  'sisältöjulkaisua ei voi poistaa'
);

select ok(
  (
    select definition ->> 'version' = content_version
      and content_release_id = 'adult-resistance-v1.0.0'
    from public.exercises
    where code = 'GOBLET_SQUAT'
  ),
  'nykyversion projektio kertoo täsmällisen release- ja harjoiteversion'
);

select * from finish();
rollback;
