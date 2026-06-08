export type DisplayMode    = 'full' | 'framing'
export type AudioAction   = 'start' | 'stop' | 'none'
export type TransitionType = 'zoom' | 'fade' | 'none'

export interface CropRegion {
  x: number       // percentage 0–100
  y: number
  width: number
  height: number
}

export interface SoundboardSlot {
  audioFileId: string | null
}

export interface FrameAudio {
  backgroundAction: AudioAction
  backgroundAudioId: string | null
  fadeOutDuration: number   // seconds
}

export interface FrameGroup {
  id: string
  name: string
  order: number   // position in the top-level sidebar list (shared with ungrouped frame orders)
}

export interface Frame {
  id: string
  order: number         // ungrouped: top-level position; grouped: within-group position
  groupId: string | null
  assetId: string | null
  displayMode: DisplayMode
  crop: CropRegion | null
  transition: TransitionType
  audio: FrameAudio
  soundboard: [
    SoundboardSlot, SoundboardSlot, SoundboardSlot,
    SoundboardSlot, SoundboardSlot, SoundboardSlot,
    SoundboardSlot, SoundboardSlot, SoundboardSlot,
  ]
}

export interface Asset {
  id: string
  filename: string
  url: string
  mimeType: string
  width: number
  height: number
}

export interface AudioFile {
  id: string
  filename: string
  url: string
  mimeType: string
}

export interface Project {
  id: string
  name: string
  description: string
  createdAt: string
  backgroundColor: string
  groups: FrameGroup[]
  frames: Frame[]
  assets: Asset[]
  audioFiles: AudioFile[]
}
