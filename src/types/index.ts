export type DisplayMode = 'full' | 'framing'
export type AudioAction = 'start' | 'stop' | 'none'

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

export interface Frame {
  id: string
  order: number
  assetId: string | null
  displayMode: DisplayMode
  crop: CropRegion | null
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
  createdAt: string   // ISO string
  backgroundColor: string   // CSS color, shown behind images in presentation
  frames: Frame[]
  assets: Asset[]
  audioFiles: AudioFile[]
}
