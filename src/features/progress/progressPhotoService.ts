import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../infrastructure/supabase/database.types'
import { supabase } from '../../infrastructure/supabase/client'

const BUCKET = 'progress-photos'
export const SIGNED_PHOTO_URL_SECONDS = 300

export type ProgressPhoto = {
  name: string
  path: string
  createdAt: string | null
  updatedAt: string | null
  size: number | null
  mimeType: string | null
  signedUrl: string
}

function requireClient(client: SupabaseClient<Database> | null) {
  if (!client) throw new Error('Kuvien tallennus vaatii määritetyn Supabase-yhteyden.')
  return client
}

export function progressPhotoPath(userId: string, extension = 'webp') {
  const safeExtension =
    extension.replace(/[^a-z0-9]/giu, '').toLocaleLowerCase() || 'webp'
  return `${userId}/${crypto.randomUUID()}.${safeExtension}`
}

export async function compressProgressPhoto(file: File, maxDimension = 1800) {
  if (!file.type.startsWith('image/'))
    throw new Error('Valitse JPEG-, PNG- tai WebP-kuva.')
  if (!('createImageBitmap' in globalThis) || typeof document === 'undefined') return file

  const image = await createImageBitmap(file)
  try {
    const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * ratio))
    canvas.height = Math.max(1, Math.round(image.height * ratio))
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.84),
    )
    if (!blob || blob.size >= file.size) return file
    return new File([blob], `${file.name.replace(/\.[^.]+$/u, '')}.webp`, {
      type: 'image/webp',
      lastModified: file.lastModified,
    })
  } finally {
    image.close()
  }
}

export class ProgressPhotoService {
  private readonly client: SupabaseClient<Database> | null

  constructor(client: SupabaseClient<Database> | null = supabase) {
    this.client = client
  }

  async list(userId: string): Promise<ProgressPhoto[]> {
    const storage = requireClient(this.client).storage.from(BUCKET)
    const { data, error } = await storage.list(userId, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    })
    if (error) throw error
    const files = (data ?? []).filter(
      (item) => item.name && item.name !== '.emptyFolderPlaceholder',
    )
    if (!files.length) return []
    const paths = files.map((item) => `${userId}/${item.name}`)
    const { data: signed, error: signedError } = await storage.createSignedUrls(
      paths,
      SIGNED_PHOTO_URL_SECONDS,
    )
    if (signedError) throw signedError
    return files.map((item, index) => ({
      name: item.name,
      path: paths[index]!,
      createdAt: item.created_at ?? null,
      updatedAt: item.updated_at ?? null,
      size: typeof item.metadata?.size === 'number' ? item.metadata.size : null,
      mimeType:
        typeof item.metadata?.mimetype === 'string' ? item.metadata.mimetype : null,
      signedUrl: signed[index]?.signedUrl ?? '',
    }))
  }

  async upload(userId: string, source: File) {
    const file = await compressProgressPhoto(source)
    const extension =
      file.type === 'image/webp' ? 'webp' : (file.name.split('.').at(-1) ?? 'jpg')
    const path = progressPhotoPath(userId, extension)
    const { error } = await requireClient(this.client)
      .storage.from(BUCKET)
      .upload(path, file, {
        cacheControl: '300',
        contentType: file.type,
        upsert: false,
      })
    if (error) throw error
    return path
  }

  async remove(userId: string, path: string) {
    if (!path.startsWith(`${userId}/`) || path.includes('..')) {
      throw new Error('Kuvan polku ei kuulu kirjautuneelle käyttäjälle.')
    }
    const { error } = await requireClient(this.client).storage.from(BUCKET).remove([path])
    if (error) throw error
  }
}

export const progressPhotoService = new ProgressPhotoService()
