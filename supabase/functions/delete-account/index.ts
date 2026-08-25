import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let stage = 'authentication'
  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return response({ error: 'Istunto puuttuu.' }, 401)

    const supabaseUrl = requireSecret('SUPABASE_URL')
    const anonKey = requireSecret('SUPABASE_ANON_KEY')
    const serviceRoleKey = requireSecret('SUPABASE_SERVICE_ROLE_KEY')
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user)
      return response({ error: 'Istunto ei ole voimassa.' }, 401)

    const body = (await request.json().catch(() => null)) as {
      confirmation?: string
    } | null
    if (body?.confirmation !== 'POISTA') {
      return response({ error: 'Poistoa ei vahvistettu.' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })
    const userId = userData.user.id
    stage = 'database'
    const ownedTables = [
      'exercise_set_logs',
      'run_logs',
      'workout_logs',
      'daily_checkins',
      'workout_exercises',
      'workouts',
      'workout_templates',
      'training_plans',
      'plan_versions',
      'fixed_sport_sessions',
      'competition_events',
      'sport_profiles',
      'goal_periods',
      'goal_profiles',
      'health_screenings',
      'nutrition_logs',
      'body_metrics',
      'baseline_tests',
      'reassessments',
      'reminders',
      'sync_conflicts',
      'sync_operations',
      'sync_devices',
      'profiles',
    ]
    for (const table of ownedTables) {
      const { error: rowDeleteError } = await admin
        .from(table)
        .delete()
        .eq('user_id', userId)
      if (rowDeleteError) throw rowDeleteError
    }

    stage = 'images'
    while (true) {
      const { data: photos, error: listError } = await admin.storage
        .from('progress-photos')
        .list(userId, { limit: 100 })
      if (listError) throw listError

      const photoPaths = (photos ?? [])
        .filter((photo) => photo.name)
        .map((photo) => `${userId}/${photo.name}`)
      if (photoPaths.length === 0) break

      const { error: removeError } = await admin.storage
        .from('progress-photos')
        .remove(photoPaths)
      if (removeError) throw removeError
    }

    stage = 'push'
    const { error: subscriptionDeleteError } = await admin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
    if (subscriptionDeleteError) throw subscriptionDeleteError

    stage = 'auth'
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
    if (deleteError) throw deleteError

    return response({ deleted: true }, 200)
  } catch {
    return response({ error: 'Tilin poistaminen epäonnistui turvallisesti.', stage }, 500)
  }
})

function requireSecret(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function response(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
