import { v4 as uuid } from 'uuid'
import { Frame, Project, SoundboardSlot } from '@/types'

function emptySlots(): Frame['soundboard'] {
  return Array.from({ length: 9 }, () => ({ audioFileId: null })) as Frame['soundboard']
}

export function createFrame(order: number): Frame {
  return {
    id: uuid(),
    order,
    assetId: null,
    displayMode: 'full',
    crop: null,
    audio: { backgroundAction: 'none', backgroundAudioId: null, fadeOutDuration: 2 },
    soundboard: emptySlots(),
  }
}

export function createProject(name: string): Project {
  return {
    id: uuid(),
    name,
    createdAt: new Date().toISOString(),
    backgroundColor: '#000000',
    frames: [createFrame(0)],
    assets: [],
    audioFiles: [],
  }
}
