import { Project } from '@/types'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { Redis } from '@upstash/redis'

const isVercel = process.env.STORAGE_BACKEND === 'vercel' || process.env.STORAGE_BACKEND_VERCEL === 'vercel'

// ─── Local storage (dev) ──────────────────────────────────────────────────────

const DATA_FILE = path.join(process.cwd(), 'data', 'projects.json')

async function ensureDataFile() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  try { await fs.access(DATA_FILE) }
  catch { await atomicWrite(DATA_FILE, '[]') }
}

async function atomicWrite(filePath: string, content: string) {
  const tmp = path.join(os.tmpdir(), `cc-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)
  await fs.writeFile(tmp, content, 'utf-8')
  await fs.rename(tmp, filePath)
}

async function localGetAll(): Promise<Project[]> {
  await ensureDataFile()
  try { return JSON.parse(await fs.readFile(DATA_FILE, 'utf-8')) }
  catch { await atomicWrite(DATA_FILE, '[]'); return [] }
}

async function localSaveAll(projects: Project[]) {
  await ensureDataFile()
  await atomicWrite(DATA_FILE, JSON.stringify(projects, null, 2))
}

// ─── Upstash Redis (prod) ─────────────────────────────────────────────────────

let _redis: Redis | null = null

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url:   process.env.CINECOMIC_KV_REST_API_URL!,
      token: process.env.CINECOMIC_KV_REST_API_TOKEN!,
    })
  }
  return _redis
}

async function kvGetAll(): Promise<Project[]> {
  const redis = getRedis()
  const ids = (await redis.smembers('project_ids')) as string[]
  if (!ids?.length) return []
  const rows = await Promise.all(ids.map((id) => redis.get<Project>(`project:${id}`)))
  return rows.filter(Boolean) as Project[]
}

async function kvGet(id: string): Promise<Project | null> {
  return getRedis().get<Project>(`project:${id}`)
}

async function kvSave(project: Project) {
  const redis = getRedis()
  await redis.set(`project:${project.id}`, project)
  await redis.sadd('project_ids', project.id)
}

async function kvDelete(id: string) {
  const redis = getRedis()
  await redis.del(`project:${id}`)
  await redis.srem('project_ids', id)
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getAllProjects(): Promise<Project[]> {
  return isVercel ? kvGetAll() : localGetAll()
}

export async function getProject(id: string): Promise<Project | null> {
  if (isVercel) return kvGet(id)
  return (await localGetAll()).find((p) => p.id === id) ?? null
}

export async function saveProject(project: Project): Promise<void> {
  if (isVercel) { await kvSave(project); return }
  const all = await localGetAll()
  const idx = all.findIndex((p) => p.id === project.id)
  if (idx >= 0) all[idx] = project; else all.push(project)
  await localSaveAll(all)
}

export async function deleteProject(id: string): Promise<void> {
  if (isVercel) { await kvDelete(id); return }
  await localSaveAll((await localGetAll()).filter((p) => p.id !== id))
}
