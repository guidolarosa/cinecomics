'use client'

import { AudioFile, Frame, SoundboardSlot } from '@/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

type FrameSoundboard = Frame['soundboard']

interface Props {
  slots: FrameSoundboard
  audioFiles: AudioFile[]
  onChange: (slots: FrameSoundboard) => void
}

export default function SoundboardEditor({ slots, audioFiles, onChange }: Props) {
  function updateSlot(index: number, audioFileId: string | null) {
    const updated = slots.map((s: SoundboardSlot, i: number) =>
      i === index ? { audioFileId } : s
    ) as FrameSoundboard
    onChange(updated)
  }

  return (
    <div className="space-y-1.5">
      {slots.map((slot, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
          <Select
            value={slot.audioFileId ?? ''}
            onValueChange={(v) => updateSlot(i, v || null)}
          >
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {audioFiles.map((a) => (
                <SelectItem key={a.id} value={a.id} className="text-xs">
                  {a.filename}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {slot.audioFileId && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => updateSlot(i, null)}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
