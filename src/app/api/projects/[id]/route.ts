import { NextResponse } from 'next/server'
import { getProject, saveProject, deleteProject } from '@/lib/storage'
import { Project } from '@/types'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await getProject(id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Backfill fields added after initial schema
  const normalized = { ...project, presentationScale: project.presentationScale ?? 1, thumbnailAssetId: project.thumbnailAssetId ?? null, groups: project.groups ?? [] }
  for (const frame of normalized.frames ?? []) {
    if (frame.groupId === undefined) frame.groupId = null
  }
  return NextResponse.json(normalized)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const project = { ...body, id } as Project
  await saveProject(project)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deleteProject(id)
  return NextResponse.json({ ok: true })
}
