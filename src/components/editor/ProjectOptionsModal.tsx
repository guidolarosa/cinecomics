'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Asset, AudioFile, Project } from '@/types'
import {
  ImageIcon,
  Music,
  Pause,
  Play,
  Settings,
  Square,
  Upload,
  X,
  ZoomIn,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Section = 'general' | 'images' | 'audio'

const NAV: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General',      icon: Settings  },
  { id: 'images',  label: 'Images',       icon: ImageIcon },
  { id: 'audio',   label: 'Audio',        icon: Music     },
]

interface Props {
  project: Project
  onProjectChange: (project: Project) => void
}

export default function ProjectOptionsModal({ project, onProjectChange }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon" title="Project settings" />}
      >
        <Settings className="w-4 h-4" />
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        className="sm:max-w-4xl w-full max-h-[85vh] p-0 gap-0 overflow-hidden"
      >
        <ModalBody
          project={project}
          onProjectChange={onProjectChange}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

// ─── Modal body ───────────────────────────────────────────────────────────────

function ModalBody({
  project,
  onProjectChange,
  onClose,
}: {
  project: Project
  onProjectChange: (project: Project) => void
  onClose: () => void
}) {
  const [section, setSection] = useState<Section>('general')
  const [lightboxAsset, setLightboxAsset] = useState<Asset | null>(null)

  return (
    <>
      <div className="flex h-[600px]">
        {/* ── Sidebar ── */}
        <aside className="w-52 shrink-0 border-r border-border flex flex-col bg-muted/30">
          <div className="px-4 py-4 border-b border-border shrink-0">
            <p className="text-sm font-semibold truncate">{project.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Project settings</p>
          </div>

          <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={cn(
                  'w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-left transition-colors',
                  section === id
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Content ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <h2 className="text-base font-semibold">
              {NAV.find((n) => n.id === section)?.label}
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Scrollable section body */}
          <div className="flex-1 overflow-y-auto p-6">
            {section === 'general' && (
              <GeneralSection project={project} onProjectChange={onProjectChange} />
            )}
            {section === 'images' && (
              <ImagesSection
                project={project}
                onProjectChange={onProjectChange}
                onOpenLightbox={setLightboxAsset}
              />
            )}
            {section === 'audio' && (
              <AudioSection project={project} onProjectChange={onProjectChange} />
            )}
          </div>
        </div>
      </div>

      {lightboxAsset && (
        <Lightbox asset={lightboxAsset} onClose={() => setLightboxAsset(null)} />
      )}
    </>
  )
}

// ─── General section ──────────────────────────────────────────────────────────

function GeneralSection({
  project,
  onProjectChange,
}: {
  project: Project
  onProjectChange: (p: Project) => void
}) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')

  function commitName() {
    const t = name.trim() || project.name
    setName(t)
    if (t !== project.name) onProjectChange({ ...project, name: t })
  }

  function commitDescription() {
    if (description !== (project.description ?? ''))
      onProjectChange({ ...project, description })
  }

  return (
    <div className="space-y-6 max-w-sm">
      <div className="space-y-1.5">
        <Label htmlFor="proj-name">Name</Label>
        <Input
          id="proj-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="proj-desc">Description</Label>
        <textarea
          id="proj-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={commitDescription}
          rows={3}
          placeholder="A short description…"
          className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring"
        />
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label>Presentation background</Label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={project.backgroundColor ?? '#000000'}
            onChange={(e) => onProjectChange({ ...project, backgroundColor: e.target.value })}
            className="w-10 h-10 rounded-lg cursor-pointer border border-border bg-transparent p-0.5"
          />
          <span className="text-sm text-muted-foreground font-mono">
            {project.backgroundColor ?? '#000000'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Images section ───────────────────────────────────────────────────────────

function ImagesSection({
  project,
  onProjectChange,
  onOpenLightbox,
}: {
  project: Project
  onProjectChange: (p: Project) => void
  onOpenLightbox: (a: Asset) => void
}) {
  const [uploading, setUploading] = useState(false)

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (!list.length) return
    setUploading(true)
    const uploads = await Promise.all(
      list.map(async (file) => {
        const dims = await getImageDimensions(file)
        const form = new FormData()
        form.append('file', file)
        form.append('width',  String(dims.width))
        form.append('height', String(dims.height))
        const res = await fetch('/api/assets', { method: 'POST', body: form })
        return res.json() as Promise<Asset>
      })
    )
    onProjectChange({ ...project, assets: [...project.assets, ...uploads] })
    setUploading(false)
  }

  return (
    <div className="space-y-5">
      <DropZone
        accept="image/png,image/jpeg,image/webp"
        uploading={uploading}
        label="Drag images here, or click to browse"
        onFiles={handleFiles}
      />

      {project.assets.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {project.assets.map((asset) => (
            <ImageCard
              key={asset.id}
              asset={asset}
              onClick={() => onOpenLightbox(asset)}
              onDelete={() => {
                const updated = {
                  ...project,
                  assets: project.assets.filter((a) => a.id !== asset.id),
                  // Null out any frames using this asset
                  frames: project.frames.map((f) =>
                    f.assetId === asset.id ? { ...f, assetId: null, crop: null } : f
                  ),
                }
                onProjectChange(updated)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Audio section ────────────────────────────────────────────────────────────

function AudioSection({
  project,
  onProjectChange,
}: {
  project: Project
  onProjectChange: (p: Project) => void
}) {
  const [uploading, setUploading] = useState(false)

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith('audio/'))
    if (!list.length) return
    setUploading(true)
    const uploads = await Promise.all(
      list.map(async (file) => {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch('/api/audio', { method: 'POST', body: form })
        return res.json() as Promise<AudioFile>
      })
    )
    onProjectChange({ ...project, audioFiles: [...project.audioFiles, ...uploads] })
    setUploading(false)
  }

  return (
    <div className="space-y-5">
      <DropZone
        accept="audio/*"
        uploading={uploading}
        label="Drag audio files here, or click to browse"
        onFiles={handleFiles}
      />

      {project.audioFiles.length > 0 && (
        <div className="space-y-2">
          {project.audioFiles.map((file) => (
            <AudioCard
              key={file.id}
              file={file}
              onDelete={() => {
                const updated = {
                  ...project,
                  audioFiles: project.audioFiles.filter((f) => f.id !== file.id),
                  // Null out any frame audio or soundboard slots using this file
                  frames: project.frames.map((f) => ({
                    ...f,
                    audio: f.audio.backgroundAudioId === file.id
                      ? { ...f.audio, backgroundAudioId: null }
                      : f.audio,
                    soundboard: f.soundboard.map((slot) =>
                      slot.audioFileId === file.id ? { audioFileId: null } : slot
                    ) as typeof f.soundboard,
                  })),
                }
                onProjectChange(updated)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Drop zone ────────────────────────────────────────────────────────────────

function DropZone({
  accept,
  uploading,
  label,
  onFiles,
}: {
  accept: string
  uploading: boolean
  label: string
  onFiles: (files: FileList | File[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragging(true)
  }
  function onDragLeave() { setDragging(false) }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    onFiles(e.dataTransfer.files)
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-10 cursor-pointer transition-colors',
        dragging
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-border text-muted-foreground hover:border-muted-foreground/50 hover:bg-muted/30'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => e.target.files && onFiles(e.target.files)}
      />
      <Upload className="w-6 h-6" />
      <p className="text-sm">{uploading ? 'Uploading…' : label}</p>
    </div>
  )
}

// ─── Image card ───────────────────────────────────────────────────────────────

function ImageCard({
  asset,
  onClick,
  onDelete,
}: {
  asset: Asset
  onClick: () => void
  onDelete: () => void
}) {
  return (
    <div className="group relative aspect-video rounded-md overflow-hidden border border-border bg-muted hover:border-primary transition-colors">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset.url}
        alt={asset.filename}
        className="w-full h-full object-cover cursor-pointer"
        onClick={onClick}
      />

      {/* Zoom overlay on hover */}
      <div
        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer pointer-events-none"
      >
        <ZoomIn className="w-5 h-5 text-white" />
      </div>

      {/* Delete button — top-right corner */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute top-1 right-1 w-5 h-5 rounded bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-destructive"
      >
        <X className="w-3 h-3" />
      </button>

      {/* Filename strip */}
      <div className="absolute bottom-0 inset-x-0 bg-black/70 px-1.5 py-1 translate-y-full group-hover:translate-y-0 transition-transform pointer-events-none">
        <p className="text-[10px] text-white truncate">{asset.filename}</p>
      </div>
    </div>
  )
}

// ─── Audio card ───────────────────────────────────────────────────────────────

function AudioCard({ file, onDelete }: { file: AudioFile; onDelete: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => () => { audioRef.current?.pause() }, [])

  function getAudio() {
    if (!audioRef.current) {
      const a = new Audio(file.url)
      a.addEventListener('ended',      () => { setPlaying(false); setProgress(0) })
      a.addEventListener('timeupdate', () => { if (a.duration) setProgress(a.currentTime / a.duration) })
      audioRef.current = a
    }
    return audioRef.current
  }

  function toggle() {
    const a = getAudio()
    if (playing) { a.pause(); setPlaying(false) }
    else         { a.play().catch(() => {}); setPlaying(true) }
  }

  function stop() {
    const a = audioRef.current
    if (a) { a.pause(); a.currentTime = 0 }
    setPlaying(false); setProgress(0)
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 bg-muted/20 group">
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggle}>
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={stop}>
          <Square className="w-3 h-3" />
        </Button>
      </div>
      <Music className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm truncate">{file.filename}</p>
        <div className="h-1 rounded-full bg-border overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-[width] duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => { stop(); onDelete() }}
      >
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset.url}
        alt={asset.filename}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="absolute top-4 right-4 flex items-center gap-3">
        <span className="text-sm text-white/70">{asset.filename}</span>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url) }
    img.src = url
  })
}
