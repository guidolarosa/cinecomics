import { NextResponse } from 'next/server'
import { getAllProjects, saveProject } from '@/lib/storage'
import { createProject } from '@/lib/factories'

export async function GET() {
  const projects = await getAllProjects()
  return NextResponse.json(projects)
}

export async function POST(req: Request) {
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const project = createProject(name.trim())
  await saveProject(project)
  return NextResponse.json(project, { status: 201 })
}
