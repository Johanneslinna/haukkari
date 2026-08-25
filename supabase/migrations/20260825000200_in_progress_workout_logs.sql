alter table public.workout_logs
  drop constraint if exists workout_logs_completion_status_check;

alter table public.workout_logs
  add constraint workout_logs_completion_status_check
  check (completion_status in ('IN_PROGRESS', 'COMPLETED', 'PARTIAL', 'STOPPED'));

comment on column public.workout_logs.completion_status is
  'IN_PROGRESS keeps offline set logging resumable; terminal values describe the final workout result.';
