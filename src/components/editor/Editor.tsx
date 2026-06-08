'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Play, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Project, Frame } from '@/types'
import { createFrame } from '@/lib/factories'
import { computeTopLevel, applyTopLevelOrder, groupFrames as getGroupFrames } from '@/lib/frameOrder'
import { v4 as uuid } from 'uuid'
import FrameList from './FrameList'
import FrameEditor from './FrameEditor'
import ProjectOptionsModal from './ProjectOptionsModal'

interface Props {
  projectId: string
}

export default function Editor({ projectId }: Props) {
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((p: Project) => {
        setProject(p)
        setSelectedFrameId(p.frames[0]?.id ?? null)
      })
  }, [projectId])

  const save = useCallback(async (updated: Project) => {
    setSaving(true)
    await fetch(`/api/projects/${updated.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setSaving(false)
  }, [])

  function updateProject(updated: Project) {
    setProject(updated)
    save(updated)
  }

  function addFrame() {
    if (!project) return
    const topCount = computeTopLevel(project.frames, project.groups).length
    const frame = createFrame(topCount)
    const updated = { ...project, frames: [...project.frames, frame] }
    updateProject(updated)
    setSelectedFrameId(frame.id)
  }

  function updateFrame(frame: Frame) {
    if (!project) return
    updateProject({
      ...project,
      frames: project.frames.map((f) => (f.id === frame.id ? frame : f)),
    })
  }

  function duplicateFrame(id: string) {
    if (!project) return
    const src = project.frames.find((f) => f.id === id)
    if (!src) return
    const copy: Frame = { ...src, id: uuid() }
    let frames = project.frames
    let groups = project.groups

    if (src.groupId) {
      // Insert copy after source within its group
      const gFrames = getGroupFrames(frames, src.groupId)
      const srcIdx = gFrames.findIndex((f) => f.id === id)
      const inserted = [
        ...gFrames.slice(0, srcIdx + 1),
        copy,
        ...gFrames.slice(srcIdx + 1),
      ].map((f, i) => ({ ...f, order: i }))
      const nonGroup = frames.filter((f) => f.groupId !== src.groupId)
      frames = [...nonGroup, ...inserted]
    } else {
      // Insert at top-level after source
      const tl = computeTopLevel(frames, groups)
      const srcIdx = tl.findIndex((i) => i.id === id)
      const newTl = [
        ...tl.slice(0, srcIdx + 1),
        { kind: 'frame' as const, id: copy.id, order: 0, frame: copy },
        ...tl.slice(srcIdx + 1),
      ]
      const normalized = applyTopLevelOrder(newTl, [...frames, copy], groups)
      frames = normalized.frames
      groups = normalized.groups
    }

    updateProject({ ...project, frames, groups })
    setSelectedFrameId(copy.id)
  }

  function deleteFrame(id: string) {
    if (!project) return
    const src = project.frames.find((f) => f.id === id)
    if (!src) return
    let frames = project.frames.filter((f) => f.id !== id)
    let groups = project.groups

    if (src.groupId) {
      // Renumber remaining frames within the group
      const remaining = getGroupFrames(frames, src.groupId)
        .map((f, i) => ({ ...f, order: i }))
      frames = frames.map((f) => remaining.find((r) => r.id === f.id) ?? f)
    } else {
      // Renormalize top-level orders
      const tl = computeTopLevel(frames, groups)
      const normalized = applyTopLevelOrder(tl, frames, groups)
      frames = normalized.frames
      groups = normalized.groups
    }

    updateProject({ ...project, frames, groups })
    if (selectedFrameId === id) {
      setSelectedFrameId(frames[0]?.id ?? null)
    }
  }

  const selectedFrame = project?.frames.find((f) => f.id === selectedFrameId) ?? null

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar */}
      <header className="flex items-center gap-3 px-4 py-2 border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <span className="font-semibold text-sm">{project.name}</span>
        {saving && <span className="text-xs text-muted-foreground ml-1">Saving…</span>}
        <div className="flex-1" />
        <ProjectOptionsModal project={project} onProjectChange={updateProject} />
        <Button size="sm" onClick={() => router.push(`/projects/${project.id}/present`)}>
          <Play className="w-3 h-3 mr-1" />
          Present
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Frame list sidebar — FrameList owns its own header with the Plus menu */}
        <aside className="w-48 border-r flex flex-col shrink-0 overflow-hidden">
          <FrameList
            project={project}
            selectedId={selectedFrameId}
            onSelect={setSelectedFrameId}
            onProjectChange={updateProject}
            onAddFrame={addFrame}
            onDuplicate={duplicateFrame}
            onDelete={deleteFrame}
          />
        </aside>

        {/* Frame editor main area */}
        <main className="flex-1 overflow-auto">
          {selectedFrame ? (
            <FrameEditor
              frame={selectedFrame}
              project={project}
              onChange={updateFrame}
              onProjectChange={updateProject}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <p>No frames yet.</p>
                <Button className="mt-3" onClick={addFrame}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Frame
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
