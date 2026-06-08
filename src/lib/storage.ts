import { Project } from '@/types'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const isVercel = process.env.STORAGE_BACKEND === 'vercel'

// ─── Local storage (dev) ───────────────────────────────────────────────────

const DATA_FILE = path.join(process.cwd(), 'data', 'projects.json')

async function ensureDataFile() {
  const dir = path.dirname(DATA_FILE)
  await fs.mkdir(dir, { recursive: true })
  try {
    await fs.access(DATA_FILE)
  } catch {
    await atomicWrite(DATA_FILE, JSON.stringify([]))
  }
}

// Write to a temp file then rename — prevents partial-write corruption
// from concurrent requests clobbering each other.
async function atomicWrite(filePath: string, content: string) {
  const tmp = path.join(os.tmpdir(), `cinecomic-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)
  await fs.writeFile(tmp, content, 'utf-8')
  await fs.rename(tmp, filePath)
}

async function localGetAll(): Promise<Project[]> {
  await ensureDataFile()
  const raw = await fs.readFile(DATA_FILE, 'utf-8')
  try {
    return JSON.parse(raw)
  } catch {
    // Corrupted file — reset and return empty
    await atomicWrite(DATA_FILE, JSON.stringify([]))
    return []
  }
}

async function localSaveAll(projects: Project[]): Promise<void> {
  await ensureDataFile()
  await atomicWrite(DATA_FILE, JSON.stringify(projects, null, 2))
}

// ─── Vercel KV storage (prod) ─────────────────────────────────────────────

async function kvGetAll(): Promise<Project[]> {
  const { kv } = await import('@vercel/kv')
  const ids = await kv.smembers<string[]>('project_ids')
  if (!ids || ids.length === 0) return []
  const projects = await Promise.all(
    ids.map((id) => kv.get<Project>(`project:${id}`))
  )
  return projects.filter(Boolean) as Project[]
}

async function kvSave(project: Project): Promise<void> {
  const { kv } = await import('@vercel/kv')
  await kv.set(`project:${project.id}`, project)
  await kv.sadd('project_ids', project.id)
}

async function kvDelete(id: string): Promise<void> {
  const { kv } = await import('@vercel/kv')
  await kv.del(`project:${id}`)
  await kv.srem('project_ids', id)
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function getAllProjects(): Promise<Project[]> {
  if (isVercel) return kvGetAll()
  return localGetAll()
}

export async function getProject(id: string): Promise<Project | null> {
  if (isVercel) {
    const { kv } = await import('@vercel/kv')
    return kv.get<Project>(`project:${id}`)
  }
  const all = await localGetAll()
  return all.find((p) => p.id === id) ?? null
}

export async function saveProject(project: Project): Promise<void> {
  if (isVercel) {
    await kvSave(project)
    return
  }
  const all = await localGetAll()
  const idx = all.findIndex((p) => p.id === project.id)
  if (idx >= 0) all[idx] = project
  else all.push(project)
  await localSaveAll(all)
}

export async function deleteProject(id: string): Promise<void> {
  if (isVercel) {
    await kvDelete(id)
    return
  }
  const all = await localGetAll()
  await localSaveAll(all.filter((p) => p.id !== id))
}
