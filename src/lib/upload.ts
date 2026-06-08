import { Asset, AudioFile } from '@/types'
import { v4 as uuid } from 'uuid'
import fs from 'fs/promises'
import path from 'path'

const isVercel = process.env.STORAGE_BACKEND === 'vercel'
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads')

async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true })
}

export async function uploadAsset(file: File): Promise<Asset> {
  const id = uuid()
  const ext = file.name.split('.').pop()
  const filename = `${id}.${ext}`

  if (isVercel) {
    const { put } = await import('@vercel/blob')
    const blob = await put(`assets/${filename}`, file, { access: 'public' })
    // We don't have dimensions at upload time on server; client should send them
    return { id, filename: file.name, url: blob.url, mimeType: file.type, width: 0, height: 0 }
  }

  await ensureUploadsDir()
  const bytes = await file.arrayBuffer()
  await fs.writeFile(path.join(UPLOADS_DIR, filename), Buffer.from(bytes))
  return { id, filename: file.name, url: `/uploads/${filename}`, mimeType: file.type, width: 0, height: 0 }
}

export async function uploadAudio(file: File): Promise<AudioFile> {
  const id = uuid()
  const ext = file.name.split('.').pop()
  const filename = `${id}.${ext}`

  if (isVercel) {
    const { put } = await import('@vercel/blob')
    const blob = await put(`audio/${filename}`, file, { access: 'public' })
    return { id, filename: file.name, url: blob.url, mimeType: file.type }
  }

  await ensureUploadsDir()
  const bytes = await file.arrayBuffer()
  await fs.writeFile(path.join(UPLOADS_DIR, filename), Buffer.from(bytes))
  return { id, filename: file.name, url: `/uploads/${filename}`, mimeType: file.type }
}

export async function deleteUpload(url: string): Promise<void> {
  if (isVercel) {
    const { del } = await import('@vercel/blob')
    await del(url)
    return
  }
  const filename = path.basename(url)
  await fs.unlink(path.join(UPLOADS_DIR, filename)).catch(() => {})
}
