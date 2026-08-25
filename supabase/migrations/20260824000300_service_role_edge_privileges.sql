do $grants$
declare
  table_name text;
  edge_tables constant text[] := array[
    'profiles', 'health_screenings', 'goal_profiles', 'goal_periods', 'plan_versions',
    'training_plans', 'workout_templates', 'workouts', 'workout_exercises',
    'daily_checkins', 'workout_logs', 'exercise_set_logs', 'run_logs',
    'nutrition_logs', 'body_metrics', 'sport_profiles', 'fixed_sport_sessions',
    'competition_events', 'baseline_tests', 'reassessments', 'reminders',
    'push_subscriptions', 'push_delivery_receipts', 'sync_devices',
    'sync_conflicts', 'sync_operations'
  ];
begin
  foreach table_name in array edge_tables loop
    execute format(
      'grant select, insert, update, delete on public.%I to service_role',
      table_name
    );
  end loop;
end
$grants$;

