'use client'

import { memo, useRef } from 'react'
import { Frame, Project, DisplayMode, AudioAction, TransitionType } from '@/types'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Upload } from 'lucide-react'
import CropTool from './CropTool'
import SoundboardEditor from './SoundboardEditor'

interface Props {
  frame: Frame
  project: Project
  onChange: (frame: Frame) => void
  onProjectChange: (project: Project) => void
}

export default memo(function FrameEditor({ frame, project, onChange, onProjectChange }: Props) {
  const assetInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)

  const selectedAsset = project.assets.find((a) => a.id === frame.assetId)

  async function handleAssetUpload(files: FileList) {
    // Upload all files, read dimensions client-side first
    const uploads = await Promise.all(
      Array.from(files).map(async (file) => {
        const dims = await getImageDimensions(file)
        const form = new FormData()
        form.append('file', file)
        form.append('width', String(dims.width))
        form.append('height', String(dims.height))
        const res = await fetch('/api/assets', { method: 'POST', body: form })
        return res.json()
      })
    )
    // Single atomic update: new assets + assign first upload to this frame
    const updatedFrame = { ...frame, assetId: uploads[0].id }
    const updatedProject = {
      ...project,
      assets: [...project.assets, ...uploads],
      frames: project.frames.map((f) => (f.id === frame.id ? updatedFrame : f)),
    }
    onProjectChange(updatedProject)
  }

  async function handleAudioUpload(files: FileList) {
    const uploads = await Promise.all(
      Array.from(files).map(async (file) => {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch('/api/audio', { method: 'POST', body: form })
        return res.json()
      })
    )
    onProjectChange({ ...project, audioFiles: [...project.audioFiles, ...uploads] })
  }

  return (
    <div className="flex h-full">
      {/* Canvas area — no padding in framing mode so CropTool fills edge-to-edge */}
      <div className={
        frame.displayMode === 'framing' && selectedAsset
          ? 'flex-1 overflow-hidden bg-zinc-950'
          : 'flex-1 flex items-center justify-center bg-zinc-950 p-6'
      }>
        {selectedAsset ? (
          frame.displayMode === 'framing' ? (
            <CropTool
              asset={selectedAsset}
              crop={frame.crop}
              onChange={(crop) => onChange({ ...frame, crop })}
              onClear={() => onChange({ ...frame, crop: null })}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selectedAsset.url}
              alt=""
              className="max-w-full max-h-full object-contain rounded"
            />
          )
        ) : (
          <div
            className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-12 text-center cursor-pointer hover:border-muted-foreground/60 transition-colors"
            onClick={() => assetInputRef.current?.click()}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Click to upload an image</p>
          </div>
        )}
      </div>

      {/* Properties sidebar */}
      <aside className="w-72 border-l overflow-y-auto p-4 space-y-5 shrink-0">

        {/* Image */}
        <section className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Image</Label>
          <Select
            value={frame.assetId ?? ''}
            onValueChange={(v) => {
              const updatedFrame = { ...frame, assetId: v || null }
              onProjectChange({
                ...project,
                frames: project.frames.map((f) => (f.id === frame.id ? updatedFrame : f)),
              })
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select image…" />
            </SelectTrigger>
            <SelectContent>
              {project.assets.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.filename}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="w-full" onClick={() => assetInputRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" /> Upload image
          </Button>
          <input
            ref={assetInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => e.target.files?.length && handleAssetUpload(e.target.files)}
          />
        </section>

        <Separator />

        {/* Display mode */}
        <section className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Display mode</Label>
          <Select
            value={frame.displayMode}
            onValueChange={(v) => onChange({ ...frame, displayMode: v as DisplayMode, crop: null })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Full</SelectItem>
              <SelectItem value="framing">Framing (zoom/pan)</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <Separator />

        {/* Transition */}
        <section className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Transition</Label>
          <Select
            value={frame.transition ?? 'zoom'}
            onValueChange={(v) => onChange({ ...frame, transition: v as TransitionType })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zoom">Zoom / Pan</SelectItem>
              <SelectItem value="fade">Fade</SelectItem>
              <SelectItem value="none">None (instant)</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <Separator />

        {/* Audio */}
        <section className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Background audio</Label>
          <Select
            value={frame.audio.backgroundAction}
            onValueChange={(v) =>
              onChange({ ...frame, audio: { ...frame.audio, backgroundAction: v as AudioAction } })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="start">Start</SelectItem>
              <SelectItem value="stop">Stop (fade out)</SelectItem>
            </SelectContent>
          </Select>

          {frame.audio.backgroundAction === 'start' && (
            <Select
              value={frame.audio.backgroundAudioId ?? ''}
              onValueChange={(v) =>
                onChange({ ...frame, audio: { ...frame.audio, backgroundAudioId: v || null } })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select audio…" />
              </SelectTrigger>
              <SelectContent>
                {project.audioFiles.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.filename}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {frame.audio.backgroundAction === 'stop' && (
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Fade out (s)</Label>
              <Input
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={frame.audio.fadeOutDuration}
                onChange={(e) =>
                  onChange({
                    ...frame,
                    audio: { ...frame.audio, fadeOutDuration: parseFloat(e.target.value) || 2 },
                  })
                }
                className="h-7 text-xs"
              />
            </div>
          )}

          <Button variant="outline" size="sm" className="w-full" onClick={() => audioInputRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" /> Upload audio
          </Button>
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files?.length && handleAudioUpload(e.target.files)}
          />
        </section>

        <Separator />

        {/* Soundboard */}
        <section className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Soundboard (keys 1–9)</Label>
          <SoundboardEditor
            slots={frame.soundboard}
            audioFiles={project.audioFiles}
            onChange={(soundboard) => onChange({ ...frame, soundboard })}
          />
        </section>
      </aside>
    </div>
  )
})

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}
