export const SAFE_PUSH_TITLE = 'Haukkari'
export const SAFE_PUSH_BODY = 'Päivän treenitarkistus odottaa.'
export const webPushFeatureEnabled = import.meta.env.VITE_ENABLE_WEB_PUSH === 'true'

export type StoredPushSubscription = {
  endpoint: string
  p256dh: string
  authKey: string
  expiresAt: string | null
}

type WebPushEnvironment = {
  notification: Pick<typeof Notification, 'permission' | 'requestPermission'> | null
  serviceWorker: ServiceWorkerContainer | null
}

export type WebPushResult =
  | { status: 'SUBSCRIBED'; subscription: StoredPushSubscription }
  | { status: 'DENIED' }
  | { status: 'UNSUPPORTED' }

function browserEnvironment(): WebPushEnvironment {
  return {
    notification: 'Notification' in globalThis ? Notification : null,
    serviceWorker:
      typeof navigator !== 'undefined' && 'serviceWorker' in navigator
        ? navigator.serviceWorker
        : null,
  }
}

export async function requestWebPushSubscription(
  publicVapidKey: string,
  environment: WebPushEnvironment = browserEnvironment(),
): Promise<WebPushResult> {
  if (!environment.notification || !environment.serviceWorker) {
    return { status: 'UNSUPPORTED' }
  }
  const permission =
    environment.notification.permission === 'granted'
      ? 'granted'
      : await environment.notification.requestPermission()
  if (permission !== 'granted') return { status: 'DENIED' }

  const registration = await environment.serviceWorker.ready
  const current = await registration.pushManager.getSubscription()
  const subscription =
    current ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicVapidKey) as BufferSource,
    }))
  const serialized = subscription.toJSON()
  if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) {
    throw new Error('Push-palvelu ei palauttanut täydellistä laitetilausta.')
  }
  return {
    status: 'SUBSCRIBED',
    subscription: {
      endpoint: serialized.endpoint,
      p256dh: serialized.keys.p256dh,
      authKey: serialized.keys.auth,
      expiresAt: subscription.expirationTime
        ? new Date(subscription.expirationTime).toISOString()
        : null,
    },
  }
}

export async function unsubscribeCurrentDevice(
  serviceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
    ? navigator.serviceWorker
    : null,
) {
  if (!serviceWorker) return
  const registration = await serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) await subscription.unsubscribe()
}

export function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replaceAll('-', '+').replaceAll('_', '/')
  const decoded = atob(base64)
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0))
}
