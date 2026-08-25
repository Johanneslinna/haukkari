import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const SAFE_NOTIFICATION = {
  web_push: 8030,
  notification: {
    title: 'Haukkari',
    body: 'Päivän treenitarkistus odottaa.',
    lang: 'fi-FI',
  },
}

type Reminder = {
  id: string
  user_id: string
  local_time: string
  timezone: string
  weekdays: number[]
}

type PushSubscriptionRow = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth_key: string
  expires_at: string | null
}

Deno.serve(async (request) => {
  if (request.method !== 'POST')
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  const expectedSecret = requireSecret('PUSH_CRON_SECRET')
  if (!safeEqual(request.headers.get('x-cron-secret') ?? '', expectedSecret)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabaseUrl = requireSecret('SUPABASE_URL')
    const serviceRoleKey = requireSecret('SUPABASE_SERVICE_ROLE_KEY')
    webpush.setVapidDetails(
      requireSecret('VAPID_SUBJECT'),
      requireSecret('VAPID_PUBLIC_KEY'),
      requireSecret('VAPID_PRIVATE_KEY'),
    )
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })
    const now = new Date()
    let sent = 0
    let removed = 0
    await admin
      .from('push_delivery_receipts')
      .delete()
      .lt('created_at', new Date(now.getTime() - 30 * 86_400_000).toISOString())
    const { data: expired, error: expiredError } = await admin
      .from('push_subscriptions')
      .update({ deleted_at: now.toISOString() })
      .lt('expires_at', now.toISOString())
      .is('deleted_at', null)
      .select('id')
    if (expiredError) throw expiredError
    removed += expired?.length ?? 0

    const { data, error } = await admin
      .from('reminders')
      .select('id,user_id,local_time,timezone,weekdays')
      .eq('enabled', true)
      .is('deleted_at', null)
    if (error) throw error

    for (const reminder of (data ?? []) as Reminder[]) {
      const local = localSchedule(reminder, now)
      if (!local) continue
      const { data: subscriptions, error: subscriptionError } = await admin
        .from('push_subscriptions')
        .select('id,user_id,endpoint,p256dh,auth_key,expires_at')
        .eq('user_id', reminder.user_id)
        .is('deleted_at', null)
      if (subscriptionError) throw subscriptionError

      for (const subscription of (subscriptions ?? []) as PushSubscriptionRow[]) {
        const claimed = await claimDelivery(
          admin,
          reminder,
          subscription,
          local.scheduleKey,
        )
        if (!claimed) continue
        try {
          const payload = JSON.stringify({
            ...SAFE_NOTIFICATION,
            notification: {
              ...SAFE_NOTIFICATION.notification,
              navigate: `${requireSecret('APP_PUBLIC_URL').replace(/\/$/u, '')}/`,
            },
          })
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
            },
            payload,
            { TTL: 300, urgency: 'normal' },
          )
          sent += 1
        } catch (reason) {
          const statusCode = pushStatus(reason)
          if (statusCode === 404 || statusCode === 410) {
            await admin
              .from('push_subscriptions')
              .update({ deleted_at: now.toISOString() })
              .eq('id', subscription.id)
            removed += 1
          } else {
            await admin
              .from('push_delivery_receipts')
              .delete()
              .eq('reminder_id', reminder.id)
              .eq('subscription_id', subscription.id)
              .eq('schedule_key', local.scheduleKey)
          }
        }
      }
    }

    return Response.json({ sent, removed })
  } catch {
    return Response.json({ error: 'Reminder dispatch failed safely' }, { status: 500 })
  }
})

function localSchedule(reminder: Reminder, now: Date) {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: reminder.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    }).formatToParts(now)
  } catch {
    return null
  }
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  const weekday =
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(value('weekday')) + 1
  const localTime = `${value('hour')}:${value('minute')}`
  if (
    !reminder.weekdays.includes(weekday) ||
    localTime !== reminder.local_time.slice(0, 5)
  )
    return null
  return {
    scheduleKey: `${value('year')}-${value('month')}-${value('day')}T${localTime}@${reminder.timezone}`,
  }
}

async function claimDelivery(
  admin: ReturnType<typeof createClient>,
  reminder: Reminder,
  subscription: PushSubscriptionRow,
  scheduleKey: string,
) {
  const { error } = await admin.from('push_delivery_receipts').insert({
    user_id: reminder.user_id,
    reminder_id: reminder.id,
    subscription_id: subscription.id,
    schedule_key: scheduleKey,
  })
  if (!error) return true
  if (error.code === '23505') return false
  throw error
}

function pushStatus(reason: unknown) {
  if (!reason || typeof reason !== 'object' || !('statusCode' in reason)) return null
  return typeof reason.statusCode === 'number' ? reason.statusCode : null
}

function requireSecret(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function safeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left)
  const rightBytes = new TextEncoder().encode(right)
  if (leftBytes.length !== rightBytes.length) return false
  let difference = 0
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index]! ^ rightBytes[index]!
  }
  return difference === 0
}
