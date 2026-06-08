'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Play, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Project, Frame } from '@/types'
import { createFrame } from '@/lib/factories'
import { v4 as uuid } from 'uuid'
import FrameList from './FrameList'
import FrameEditor from './FrameEditor'

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
    const frame = createFrame(project.frames.length)
    const updated = { ...project, frames: [...project.frames, frame] }
    updateProject(updated)
    setSelectedFrameId(frame.id)
  }

  function reorderFrames(frames: Frame[]) {
    if (!project) return
    const reindexed = frames.map((f, i) => ({ ...f, order: i }))
    updateProject({ ...project, frames: reindexed })
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
    const sorted = project.frames.slice().sort((a, b) => a.order - b.order)
    const srcIndex = sorted.findIndex((f) => f.id === id)
    if (srcIndex === -1) return
    const src = sorted[srcIndex]
    const copy = { ...src, id: uuid() }
    // Insert copy right after the source
    const next = [
      ...sorted.slice(0, srcIndex + 1),
      copy,
      ...sorted.slice(srcIndex + 1),
    ].map((f, i) => ({ ...f, order: i }))
    updateProject({ ...project, frames: next })
    setSelectedFrameId(copy.id)
  }

  function deleteFrame(id: string) {
    if (!project) return
    const frames = project.frames.filter((f) => f.id !== id)
    const reindexed = frames.map((f, i) => ({ ...f, order: i }))
    updateProject({ ...project, frames: reindexed })
    if (selectedFrameId === id) setSelectedFrameId(frames[0]?.id ?? null)
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
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          Background
          <input
            type="color"
            value={project.backgroundColor ?? '#000000'}
            onChange={(e) => updateProject({ ...project, backgroundColor: e.target.value })}
            className="w-6 h-6 rounded cursor-pointer border border-border bg-transparent p-0"
          />
        </label>
        <Button size="sm" onClick={() => router.push(`/projects/${project.id}/present`)}>
          <Play className="w-3 h-3 mr-1" />
          Present
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Frame list sidebar */}
        <aside className="w-48 border-r flex flex-col shrink-0">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Frames</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addFrame}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          <FrameList
            project={project}
            selectedId={selectedFrameId}
            onSelect={setSelectedFrameId}
            onReorder={reorderFrames}
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
