import { v4 as uuid } from 'uuid'
import { Frame, FrameGroup, Project, SoundboardSlot } from '@/types'

function emptySlots(): Frame['soundboard'] {
  return Array.from({ length: 9 }, () => ({ audioFileId: null })) as Frame['soundboard']
}

export function createFrame(order: number, groupId: string | null = null): Frame {
  return {
    id: uuid(),
    order,
    groupId,
    assetId: null,
    displayMode: 'full',
    crop: null,
    transition: 'zoom',
    audio: { backgroundAction: 'none', backgroundAudioId: null, fadeOutDuration: 2 },
    soundboard: emptySlots(),
  }
}

export function createGroup(name: string, order: number): FrameGroup {
  return { id: uuid(), name, order }
}

export function createProject(name: string): Project {
  return {
    id: uuid(),
    name,
    description: '',
    createdAt: new Date().toISOString(),
    backgroundColor: '#000000',
    presentationScale: 1,
    thumbnailAssetId: null,
    groups: [],
    frames: [createFrame(0)],
    assets: [],
    audioFiles: [],
  }
}
