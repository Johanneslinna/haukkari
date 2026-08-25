alter table public.workouts
  add column prescription jsonb not null default '{}'::jsonb,
  add column decision_trace jsonb not null default '{}'::jsonb;

alter table public.workout_logs
  add column completion_status text not null default 'COMPLETED'
    check (completion_status in ('COMPLETED', 'PARTIAL', 'STOPPED')),
  add column feedback jsonb not null default '{}'::jsonb,
  add column decision_trace jsonb not null default '{}'::jsonb;

comment on column public.workouts.prescription is
  'Immutable prescribed-session snapshot used for offline execution and planned-vs-completed history.';
comment on column public.workouts.decision_trace is
  'Versioned deterministic rules and safety decisions that produced the workout.';
comment on column public.workout_logs.feedback is
  'Post-workout user feedback used by later deterministic progression decisions.';
