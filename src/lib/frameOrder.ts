import { Frame, FrameGroup } from '@/types'

export type TopLevelItem =
  | { kind: 'frame'; id: string; order: number; frame: Frame }
  | { kind: 'group'; id: string; order: number; group: FrameGroup }

/** Sorted flat list of top-level items (ungrouped frames + groups). */
export function computeTopLevel(frames: Frame[], groups: FrameGroup[]): TopLevelItem[] {
  const safeFrames = frames ?? []
  const safeGroups = groups ?? []
  const ungrouped: TopLevelItem[] = safeFrames
    .filter((f) => !f.groupId)
    .map((f) => ({ kind: 'frame', id: f.id, order: f.order, frame: f }))
  const groupItems: TopLevelItem[] = safeGroups
    .map((g) => ({ kind: 'group', id: g.id, order: g.order, group: g }))
  return [...ungrouped, ...groupItems].sort((a, b) => a.order - b.order)
}

/** Re-apply sequential orders from a reordered top-level item array. */
export function applyTopLevelOrder(
  sorted: TopLevelItem[],
  frames: Frame[],
  groups: FrameGroup[],
): { frames: Frame[]; groups: FrameGroup[] } {
  const newFrames = frames.map((f) => {
    const idx = sorted.findIndex((i) => i.id === f.id)
    return idx !== -1 ? { ...f, order: idx } : f
  })
  const newGroups = groups.map((g) => {
    const idx = sorted.findIndex((i) => i.id === g.id)
    return idx !== -1 ? { ...g, order: idx } : g
  })
  return { frames: newFrames, groups: newGroups }
}

/** Sorted frames that belong to a given group. */
export function groupFrames(frames: Frame[], groupId: string): Frame[] {
  return frames.filter((f) => f.groupId === groupId).sort((a, b) => a.order - b.order)
}
