import { z } from 'zod'
import type {
  LocalDevice,
  OutboxOperation,
  PullPage,
  PushResult,
  RemoteRecord,
  SyncCursor,
  SyncRemoteGateway,
  SyncableTable,
} from '../../domain/sync/types'

const remoteRecordSchema = z
  .object({
    id: z.uuid(),
    user_id: z.uuid(),
    created_at: z.iso.datetime({ offset: true }),
    updated_at: z.iso.datetime({ offset: true }),
    deleted_at: z.iso.datetime({ offset: true }).nullable(),
    version: z.number().int().positive(),
  })
  .loose()

type GatewayConfiguration = {
  apiUrl: string
  anonKey: string
  getAccessToken: () => Promise<string | null>
  fetch?: typeof fetch
}

type ApiResult = {
  response: Response
  data: unknown
}

function sameIntendedFields(remote: RemoteRecord, operation: OutboxOperation) {
  return Object.entries(operation.payload).every(([field, value]) => {
    if (field === 'version' || field === 'updated_at') return true
    return JSON.stringify(remote[field]) === JSON.stringify(value)
  })
}

export class SupabaseSyncGateway implements SyncRemoteGateway {
  private readonly apiUrl: string
  private readonly anonKey: string
  private readonly getAccessToken: () => Promise<string | null>
  private readonly fetchImplementation: typeof fetch

  constructor(configuration: GatewayConfiguration) {
    this.apiUrl = configuration.apiUrl.replace(/\/$/u, '')
    this.anonKey = configuration.anonKey
    this.getAccessToken = configuration.getAccessToken
    this.fetchImplementation = configuration.fetch ?? globalThis.fetch.bind(globalThis)
  }

  async prepare(userId: string, device: LocalDevice) {
    const query = new URLSearchParams({
      user_id: `eq.${userId}`,
      device_key: `eq.${device.deviceKey}`,
      select: 'id',
      limit: '1',
    })
    const existing = await this.request(`/rest/v1/sync_devices?${query}`)
    if (!existing.response.ok) throw await this.apiError(existing)
    const devices = z.array(z.object({ id: z.uuid() })).parse(existing.data)
    if (devices[0] && devices[0].id !== device.id) {
      throw new Error(
        'Tämän laitteen palvelintunniste ei vastaa paikallista tunnistetta.',
      )
    }
    if (devices.length > 0) {
      const update = await this.request(
        `/rest/v1/sync_devices?id=eq.${encodeURIComponent(device.id)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ last_seen_at: device.lastSeenAt }),
        },
      )
      if (!update.response.ok) throw await this.apiError(update)
      return
    }

    const inserted = await this.request('/rest/v1/sync_devices', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: device.id,
        user_id: userId,
        device_key: device.deviceKey,
        display_name: device.displayName,
        last_seen_at: device.lastSeenAt,
      }),
    })
    if (!inserted.response.ok) throw await this.apiError(inserted)
  }

  async push(operation: OutboxOperation): Promise<PushResult> {
    try {
      const existingOperation = await this.operationStatus(operation)
      if (existingOperation === 'APPLIED') {
        const existingRecord = await this.getRecord(operation)
        return existingRecord
          ? { outcome: 'APPLIED', record: existingRecord }
          : { outcome: 'RETRY', message: 'Kuitattu tietue ei löytynyt palvelimelta.' }
      }
      if (existingOperation === 'MISSING') {
        const recorded = await this.recordOperation(operation)
        if (!recorded.response.ok && recorded.response.status !== 409) {
          return this.retryFrom(recorded)
        }
      }

      const mutation = await this.applyMutation(operation)
      if (mutation.outcome !== 'APPLIED') return mutation
      const marked = await this.markApplied(operation.operationId)
      if (!marked.response.ok) {
        return this.retryFrom(marked)
      }
      return mutation
    } catch (reason) {
      return {
        outcome: 'RETRY',
        message: reason instanceof Error ? reason.message : 'Verkkopyyntö epäonnistui.',
      }
    }
  }

  async pull(
    userId: string,
    table: SyncableTable,
    cursor: SyncCursor | null,
    limit: number,
  ): Promise<PullPage> {
    const query = new URLSearchParams({
      user_id: `eq.${userId}`,
      select: '*',
      order: 'updated_at.asc,id.asc',
      limit: String(limit),
    })
    if (cursor) {
      query.set(
        'or',
        `(updated_at.gt.${cursor.updatedAt},and(updated_at.eq.${cursor.updatedAt},id.gt.${cursor.id}))`,
      )
    }
    const result = await this.request(`/rest/v1/${table}?${query}`)
    if (!result.response.ok) throw await this.apiError(result)
    const records = z.array(remoteRecordSchema).parse(result.data) as RemoteRecord[]
    return { records, hasMore: records.length === limit }
  }

  private async operationStatus(operation: OutboxOperation) {
    const query = new URLSearchParams({
      id: `eq.${operation.operationId}`,
      select: 'applied_at',
      limit: '1',
    })
    const result = await this.request(`/rest/v1/sync_operations?${query}`)
    if (!result.response.ok) throw await this.apiError(result)
    const rows = z
      .array(z.object({ applied_at: z.string().nullable() }))
      .parse(result.data)
    if (!rows[0]) return 'MISSING' as const
    return rows[0].applied_at ? ('APPLIED' as const) : ('RECORDED' as const)
  }

  private recordOperation(operation: OutboxOperation) {
    return this.request('/rest/v1/sync_operations', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: operation.operationId,
        user_id: operation.userId,
        device_id: operation.deviceId,
        entity_table: operation.table,
        entity_id: operation.entityId,
        operation: operation.kind,
        base_version: operation.baseVersion,
        payload: operation.payload,
      }),
    })
  }

  private async applyMutation(operation: OutboxOperation): Promise<PushResult> {
    if (operation.kind === 'INSERT') {
      const result = await this.request(`/rest/v1/${operation.table}`, {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(operation.payload),
      })
      if (result.response.ok) {
        return {
          outcome: 'APPLIED',
          record: z
            .array(remoteRecordSchema)
            .nonempty()
            .parse(result.data)[0] as RemoteRecord,
        }
      }
      if (result.response.status !== 409) return this.retryFrom(result)
    } else {
      const query = new URLSearchParams({
        id: `eq.${operation.entityId}`,
        user_id: `eq.${operation.userId}`,
        version: `eq.${operation.baseVersion}`,
      })
      const result = await this.request(`/rest/v1/${operation.table}?${query}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(operation.payload),
      })
      if (result.response.ok) {
        const records = z.array(remoteRecordSchema).parse(result.data) as RemoteRecord[]
        if (records[0]) return { outcome: 'APPLIED', record: records[0] }
      } else if (result.response.status >= 500) {
        return this.retryFrom(result)
      }
    }

    const remoteRecord = await this.getRecord(operation)
    if (!remoteRecord) {
      return { outcome: 'RETRY', message: 'Palvelimen tietuetta ei löytynyt.' }
    }
    return sameIntendedFields(remoteRecord, operation)
      ? { outcome: 'APPLIED', record: remoteRecord }
      : { outcome: 'CONFLICT', remoteRecord }
  }

  private async getRecord(operation: OutboxOperation) {
    const query = new URLSearchParams({
      id: `eq.${operation.entityId}`,
      user_id: `eq.${operation.userId}`,
      select: '*',
      limit: '1',
    })
    const result = await this.request(`/rest/v1/${operation.table}?${query}`)
    if (!result.response.ok) throw await this.apiError(result)
    return (
      (z.array(remoteRecordSchema).parse(result.data)[0] as RemoteRecord | undefined) ??
      null
    )
  }

  private markApplied(operationId: string) {
    const query = new URLSearchParams({ id: `eq.${operationId}` })
    return this.request(`/rest/v1/sync_operations?${query}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ applied_at: new Date().toISOString(), error_code: null }),
    })
  }

  private async retryFrom(result: ApiResult): Promise<PushResult> {
    const error = await this.apiError(result)
    return { outcome: 'RETRY', message: error.message }
  }

  private async apiError(result: ApiResult) {
    const parsed = z
      .object({ message: z.string().optional(), code: z.string().optional() })
      .loose()
      .safeParse(result.data)
    const detail = parsed.success
      ? (parsed.data.message ?? parsed.data.code)
      : `HTTP ${result.response.status}`
    return new Error(detail ?? 'Supabase-pyyntö epäonnistui.')
  }

  private async request(path: string, init: RequestInit = {}): Promise<ApiResult> {
    const accessToken = await this.getAccessToken()
    if (!accessToken) throw new Error('Synkronointi vaatii aktiivisen käyttäjäistunnon.')
    const response = await this.fetchImplementation(`${this.apiUrl}${path}`, {
      ...init,
      headers: {
        apikey: this.anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    })
    const text = await response.text()
    let data: unknown = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = { message: text }
      }
    }
    return { response, data }
  }
}
