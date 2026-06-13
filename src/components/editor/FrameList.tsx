'use client'

import { memo, useEffect, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Menu } from '@base-ui/react/menu'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  FolderOpen,
  GripVertical,
  LayoutTemplate,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { Frame, FrameGroup, Asset, CropRegion, Project } from '@/types'
import { createGroup } from '@/lib/factories'
import { computeTopLevel, applyTopLevelOrder, groupFrames as getGroupFrames } from '@/lib/frameOrder'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// ─── DnD item data ────────────────────────────────────────────────────────────

type ItemData =
  | { type: 'ungrouped-frame' }
  | { type: 'group' }
  | { type: 'grouped-frame'; groupId: string }

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  project: Project
  selectedId: string | null
  onSelect: (id: string) => void
  onProjectChange: (project: Project) => void
  onAddFrame: () => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

// ─── Main component ───────────────────────────────────────────────────────────

function FrameListInner({
  project,
  selectedId,
  onSelect,
  onProjectChange,
  onAddFrame,
  onDuplicate,
  onDelete,
}: Props) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [showGroupDialog, setShowGroupDialog] = useState(false)
  const [groupNameInput, setGroupNameInput] = useState('')
  const groupNameRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const topLevel = computeTopLevel(project.frames, project.groups)

  function toggleCollapse(groupId: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  function openGroupDialog() {
    setGroupNameInput('')
    setShowGroupDialog(true)
    setTimeout(() => groupNameRef.current?.focus(), 50)
  }

  function submitGroup() {
    const name = groupNameInput.trim()
    if (!name) return
    const order = topLevel.length
    const group = createGroup(name, order)
    onProjectChange({ ...project, groups: [...project.groups, group] })
    setShowGroupDialog(false)
    setGroupNameInput('')
  }

  // ─── DnD handlers ────────────────────────────────────────────────────────

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId  = String(active.id)
    const overId    = String(over.id)
    const activeData = active.data.current as ItemData | undefined
    const overData   = over.data.current   as ItemData | undefined

    let frames = project.frames
    let groups = project.groups

    // ── Case 1: ungrouped frame dropped on group header → add to group ──
    if (activeData?.type === 'ungrouped-frame' && overData?.type === 'group') {
      const targetGroupId = overId
      const inGroup = frames.filter((f) => f.groupId === targetGroupId)
      frames = frames.map((f) =>
        f.id === activeId ? { ...f, groupId: targetGroupId, order: inGroup.length } : f,
      )
      // Re-normalize top level (this frame left the ungrouped list)
      const tl = computeTopLevel(frames, groups)
      const normalized = applyTopLevelOrder(tl, frames, groups)
      onProjectChange({ ...project, frames: normalized.frames, groups: normalized.groups })
      return
    }

    // ── Case 2: grouped frame dropped on a DIFFERENT group header → move group ──
    if (
      activeData?.type === 'grouped-frame' &&
      overData?.type === 'group' &&
      activeData.groupId !== overId
    ) {
      const targetGroupId = overId
      const inGroup = frames.filter((f) => f.groupId === targetGroupId)
      frames = frames.map((f) =>
        f.id === activeId ? { ...f, groupId: targetGroupId, order: inGroup.length } : f,
      )
      onProjectChange({ ...project, frames })
      return
    }

    // ── Case 3: grouped frame dropped on ungrouped frame → ungroup ──
    if (activeData?.type === 'grouped-frame' && overData?.type === 'ungrouped-frame') {
      const tl = computeTopLevel(frames, groups)
      const overIdx = tl.findIndex((i) => i.id === overId)
      // Remove from group, insert at top-level near the drop target
      const frameWithoutGroup = frames.find((f) => f.id === activeId)!
      frames = frames.map((f) => (f.id === activeId ? { ...f, groupId: null, order: 0 } : f))
      const newTl = [
        ...tl.slice(0, overIdx),
        { kind: 'frame' as const, id: activeId, order: 0, frame: { ...frameWithoutGroup, groupId: null } },
        ...tl.slice(overIdx),
      ]
      const normalized = applyTopLevelOrder(newTl, frames, groups)
      onProjectChange({ ...project, frames: normalized.frames, groups: normalized.groups })
      return
    }

    // ── Case 4: reorder within top-level (ungrouped frames + groups) ──
    if (
      (activeData?.type === 'ungrouped-frame' || activeData?.type === 'group') &&
      (overData?.type === 'ungrouped-frame' || overData?.type === 'group')
    ) {
      const tl = computeTopLevel(frames, groups)
      const oldIdx = tl.findIndex((i) => i.id === activeId)
      const newIdx = tl.findIndex((i) => i.id === overId)
      if (oldIdx !== -1 && newIdx !== -1) {
        const reordered = arrayMove(tl, oldIdx, newIdx)
        const normalized = applyTopLevelOrder(reordered, frames, groups)
        onProjectChange({ ...project, frames: normalized.frames, groups: normalized.groups })
      }
      return
    }

    // ── Case 5: reorder within a group ──
    if (activeData?.type === 'grouped-frame' && overData?.type === 'grouped-frame') {
      if (activeData.groupId === overData.groupId) {
        const gFrames = getGroupFrames(frames, activeData.groupId)
        const oldIdx = gFrames.findIndex((f) => f.id === activeId)
        const newIdx = gFrames.findIndex((f) => f.id === overId)
        if (oldIdx !== -1 && newIdx !== -1) {
          const reordered = arrayMove(gFrames, oldIdx, newIdx).map((f, i) => ({ ...f, order: i }))
          frames = frames.map((f) => reordered.find((r) => r.id === f.id) ?? f)
          onProjectChange({ ...project, frames })
        }
      }
    }
  }

  // ─── Group operations (passed down) ──────────────────────────────────────

  function renameGroup(groupId: string, name: string) {
    onProjectChange({
      ...project,
      groups: project.groups.map((g) => (g.id === groupId ? { ...g, name } : g)),
    })
  }

  function deleteGroup(groupId: string) {
    // Ungroup frames (remove groupId, append to end of top level)
    const ungrouped = project.frames.filter((f) => !f.groupId)
    const groupedFrames = getGroupFrames(project.frames, groupId)
    const reassigned = groupedFrames.map((f, i) => ({
      ...f,
      groupId: null,
      order: ungrouped.length + i,
    }))
    const frames = project.frames.map((f) => reassigned.find((r) => r.id === f.id) ?? f)
    const groups = project.groups.filter((g) => g.id !== groupId)
    // Re-normalize top level
    const tl = computeTopLevel(frames, groups)
    const normalized = applyTopLevelOrder(tl, frames, groups)
    onProjectChange({ ...project, frames: normalized.frames, groups: normalized.groups })
  }

  function moveFrameToGroup(frameId: string, targetGroupId: string | null) {
    const frame = project.frames.find((f) => f.id === frameId)
    if (!frame) return
    let frames = project.frames
    let groups = project.groups

    if (targetGroupId) {
      const inGroup = frames.filter((f) => f.groupId === targetGroupId)
      frames = frames.map((f) =>
        f.id === frameId ? { ...f, groupId: targetGroupId, order: inGroup.length } : f,
      )
      const tl = computeTopLevel(frames, groups)
      const normalized = applyTopLevelOrder(tl, frames, groups)
      frames = normalized.frames
      groups = normalized.groups
    } else {
      // Remove from group
      const tl = computeTopLevel(frames, groups)
      frames = frames.map((f) => (f.id === frameId ? { ...f, groupId: null, order: 0 } : f))
      const newTl = [...tl, { kind: 'frame' as const, id: frameId, order: 0, frame: { ...frame, groupId: null } }]
      const normalized = applyTopLevelOrder(newTl, frames, groups)
      frames = normalized.frames
      groups = normalized.groups
    }

    onProjectChange({ ...project, frames, groups })
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const topLevelIds = topLevel.map((i) => i.id)

  return (
    <div className="flex flex-col h-full">
      {/* Sidebar header */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Frames
        </span>
        <Menu.Root>
          <Menu.Trigger className="flex items-center justify-center w-6 h-6 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <Plus className="w-3 h-3" />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner side="bottom" align="end" sideOffset={4}>
              <Menu.Popup className="z-50 min-w-[140px] overflow-hidden rounded-md bg-popover p-1 shadow-lg border border-border origin-(--transform-origin) data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
                <Menu.Item
                  className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground outline-none"
                  onClick={onAddFrame}
                >
                  <LayoutTemplate className="w-3.5 h-3.5" />
                  Frame
                </Menu.Item>
                <Menu.Item
                  className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground outline-none"
                  onClick={openGroupDialog}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Group
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>

      {/* Frame + group list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={topLevelIds} strategy={verticalListSortingStrategy}>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {topLevel.map((item, globalIndex) => {
              if (item.kind === 'frame') {
                const frame = item.frame
                return (
                  <SortableFrameItem
                    key={frame.id}
                    frame={frame}
                    index={globalIndex}
                    asset={project.assets.find((a) => a.id === frame.assetId) ?? null}
                    isSelected={selectedId === frame.id}
                    groups={project.groups}
                    onSelect={onSelect}
                    onDuplicate={onDuplicate}
                    onDelete={onDelete}
                    onMoveToGroup={(gId) => moveFrameToGroup(frame.id, gId)}
                  />
                )
              } else {
                const group = item.group
                const gFrames = getGroupFrames(project.frames, group.id)
                const collapsed = collapsedGroups.has(group.id)
                return (
                  <SortableGroupContainer
                    key={group.id}
                    group={group}
                    frames={gFrames}
                    assets={project.assets}
                    allGroups={project.groups}
                    collapsed={collapsed}
                    selectedId={selectedId}
                    onToggleCollapse={() => toggleCollapse(group.id)}
                    onRename={(name) => renameGroup(group.id, name)}
                    onDelete={() => deleteGroup(group.id)}
                    onSelect={onSelect}
                    onDuplicate={onDuplicate}
                    onDeleteFrame={onDelete}
                    onMoveFrame={(frameId, gId) => moveFrameToGroup(frameId, gId)}
                  />
                )
              }
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Group name dialog */}
      {showGroupDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowGroupDialog(false)}
        >
          <div
            className="bg-popover rounded-xl p-4 shadow-xl w-64 border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold mb-3">New group</h3>
            <Input
              ref={groupNameRef}
              value={groupNameInput}
              onChange={(e) => setGroupNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitGroup()
                if (e.key === 'Escape') setShowGroupDialog(false)
              }}
              placeholder="Group name…"
              className="h-8 text-sm mb-3"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowGroupDialog(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={submitGroup} disabled={!groupNameInput.trim()}>
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Only re-render when the data that actually affects the list changes.
// Skips re-renders caused by project metadata changes (backgroundColor, scale, name…)
// since the callbacks are stable (Editor uses projectRef internally).
const FrameList = memo(FrameListInner, (prev, next) =>
  prev.project.frames === next.project.frames &&
  prev.project.groups === next.project.groups &&
  prev.project.assets === next.project.assets &&
  prev.selectedId === next.selectedId,
)

export default FrameList

// ─── Sortable frame item ───────────────────────────────────────────────────────

interface SortableFrameItemProps {
  frame: Frame
  index: number
  asset: Asset | null
  isSelected: boolean
  groups: FrameGroup[]
  itemData?: ItemData
  onSelect: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onMoveToGroup: (groupId: string | null) => void
}

function SortableFrameItem({
  frame,
  index,
  asset,
  isSelected,
  groups,
  itemData,
  onSelect,
  onDuplicate,
  onDelete,
  onMoveToGroup,
}: SortableFrameItemProps) {
  const data: ItemData = itemData ?? (frame.groupId ? { type: 'grouped-frame', groupId: frame.groupId } : { type: 'ungrouped-frame' })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: frame.id,
    data,
  })

  const showCrop = frame.displayMode === 'framing' && !!frame.crop && !!asset

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={cn(
        'group relative flex flex-col gap-1 rounded-md border p-1 cursor-pointer text-xs',
        isSelected
          ? 'border-primary bg-primary/10'
          : 'hover:border-muted-foreground border-transparent',
      )}
      onClick={() => onSelect(frame.id)}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-3 h-3" />
      </div>

      {/* Thumbnail */}
      <div className="aspect-video bg-muted rounded overflow-hidden ml-4">
        {asset ? (
          showCrop ? (
            <CroppedThumbnail asset={asset} crop={frame.crop!} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.url} alt="" className="w-full h-full object-cover" />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[10px]">
            empty
          </div>
        )}
      </div>

      <span className="text-muted-foreground pl-4 text-[10px]">Frame {index + 1}</span>

      {/* Kebab menu */}
      <div
        className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <FrameKebabMenu
          frame={frame}
          groups={groups}
          onDuplicate={() => onDuplicate(frame.id)}
          onDelete={() => onDelete(frame.id)}
          onMoveToGroup={onMoveToGroup}
        />
      </div>
    </div>
  )
}

// ─── Frame kebab menu ────────────────────────────────────────────────────────

function FrameKebabMenu({
  frame,
  groups,
  onDuplicate,
  onDelete,
  onMoveToGroup,
}: {
  frame: Frame
  groups: FrameGroup[]
  onDuplicate: () => void
  onDelete: () => void
  onMoveToGroup: (groupId: string | null) => void
}) {
  const otherGroups = groups.filter((g) => g.id !== frame.groupId)

  return (
    <Menu.Root>
      <Menu.Trigger className="flex items-center justify-center w-5 h-5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors">
        <MoreVertical className="w-3 h-3" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4}>
          <Menu.Popup className="z-50 min-w-[160px] overflow-hidden rounded-md bg-zinc-800 p-1 shadow-lg border border-white/10 origin-(--transform-origin) data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <Menu.Item
              className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs text-zinc-200 cursor-pointer hover:bg-white/10 outline-none"
              onClick={onDuplicate}
            >
              <Copy className="w-3 h-3" /> Duplicate
            </Menu.Item>

            {/* Move to another group */}
            {otherGroups.map((g) => (
              <Menu.Item
                key={g.id}
                className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs text-zinc-200 cursor-pointer hover:bg-white/10 outline-none"
                onClick={() => onMoveToGroup(g.id)}
              >
                <FolderOpen className="w-3 h-3" />
                Move to "{g.name}"
              </Menu.Item>
            ))}

            {/* Remove from current group */}
            {frame.groupId && (
              <Menu.Item
                className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs text-zinc-200 cursor-pointer hover:bg-white/10 outline-none"
                onClick={() => onMoveToGroup(null)}
              >
                <X className="w-3 h-3" /> Remove from group
              </Menu.Item>
            )}

            <div className="my-1 border-t border-white/10" />

            <Menu.Item
              className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs text-red-400 cursor-pointer hover:bg-white/10 outline-none"
              onClick={onDelete}
            >
              <Trash2 className="w-3 h-3" /> Delete
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

// ─── Sortable group container ─────────────────────────────────────────────────

interface SortableGroupContainerProps {
  group: FrameGroup
  frames: Frame[]
  assets: Asset[]
  allGroups: FrameGroup[]
  collapsed: boolean
  selectedId: string | null
  onToggleCollapse: () => void
  onRename: (name: string) => void
  onDelete: () => void
  onSelect: (id: string) => void
  onDuplicate: (id: string) => void
  onDeleteFrame: (id: string) => void
  onMoveFrame: (frameId: string, groupId: string | null) => void
}

function SortableGroupContainer({
  group,
  frames,
  assets,
  allGroups,
  collapsed,
  selectedId,
  onToggleCollapse,
  onRename,
  onDelete,
  onSelect,
  onDuplicate,
  onDeleteFrame,
  onMoveFrame,
}: SortableGroupContainerProps) {
  const [editing, setEditing] = useState(false)
  const [nameValue, setNameValue] = useState(group.name)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const { setNodeRef, transform, transition, isDragging, isOver, attributes, listeners } =
    useSortable({ id: group.id, data: { type: 'group' } as ItemData })

  function commitRename() {
    const name = nameValue.trim() || group.name
    setNameValue(name)
    onRename(name)
    setEditing(false)
  }

  function startEditing() {
    setEditing(true)
    setNameValue(group.name)
    setTimeout(() => nameInputRef.current?.focus(), 30)
  }

  const frameIds = frames.map((f) => f.id)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      {/* Group header */}
      <div
        className={cn(
          'group/header flex items-center gap-1 rounded-md px-1 py-1 border transition-colors',
          isOver
            ? 'border-primary/60 bg-primary/10'
            : 'border-transparent hover:border-muted-foreground/30',
        )}
      >
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3 h-3" />
        </div>

        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {/* Name (inline editable) */}
        {editing ? (
          <input
            ref={nameInputRef}
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') { setNameValue(group.name); setEditing(false) }
            }}
            className="flex-1 min-w-0 bg-transparent border-b border-primary text-xs outline-none py-0"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="flex-1 min-w-0 text-xs font-medium truncate cursor-default select-none"
            onDoubleClick={(e) => { e.stopPropagation(); startEditing() }}
          >
            {group.name}
          </span>
        )}

        {/* Frame count badge */}
        <span className="text-[10px] text-muted-foreground shrink-0">{frames.length}</span>

        {/* Group kebab */}
        <div
          className="opacity-0 group-hover/header:opacity-100 transition-opacity shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <GroupKebabMenu onRename={startEditing} onDelete={onDelete} />
        </div>
      </div>

      {/* Grouped frames */}
      {!collapsed && (
        <SortableContext items={frameIds} strategy={verticalListSortingStrategy}>
          <div className="mt-1 ml-4 space-y-1">
            {frames.map((frame, i) => (
              <SortableFrameItem
                key={frame.id}
                frame={frame}
                index={i}
                asset={assets.find((a) => a.id === frame.assetId) ?? null}
                isSelected={selectedId === frame.id}
                groups={allGroups}
                itemData={{ type: 'grouped-frame', groupId: group.id }}
                onSelect={onSelect}
                onDuplicate={onDuplicate}
                onDelete={onDeleteFrame}
                onMoveToGroup={(gId) => onMoveFrame(frame.id, gId)}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  )
}

// ─── Group kebab menu ─────────────────────────────────────────────────────────

function GroupKebabMenu({ onRename, onDelete }: { onRename: () => void; onDelete: () => void }) {
  return (
    <Menu.Root>
      <Menu.Trigger className="flex items-center justify-center w-5 h-5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors">
        <MoreVertical className="w-3 h-3" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4}>
          <Menu.Popup className="z-50 min-w-[140px] overflow-hidden rounded-md bg-zinc-800 p-1 shadow-lg border border-white/10 origin-(--transform-origin) data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <Menu.Item
              className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs text-zinc-200 cursor-pointer hover:bg-white/10 outline-none"
              onClick={onRename}
            >
              <Pencil className="w-3 h-3" /> Rename
            </Menu.Item>
            <div className="my-1 border-t border-white/10" />
            <Menu.Item
              className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-xs text-red-400 cursor-pointer hover:bg-white/10 outline-none"
              onClick={onDelete}
            >
              <Trash2 className="w-3 h-3" /> Delete group
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

// ─── Cropped thumbnail ────────────────────────────────────────────────────────

function CroppedThumbnail({ asset, crop }: { asset: Asset; crop: CropRegion }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const { width, height } = containerRef.current.getBoundingClientRect()
    if (width && height) setContainerSize({ w: width, h: height })
  }, [])

  const transform =
    containerSize && asset.width && asset.height
      ? cropTransform(asset.width, asset.height, crop, containerSize.w, containerSize.h)
      : 'none'

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset.url}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          transformOrigin: '0 0',
          transform,
        }}
      />
    </div>
  )
}

function cropTransform(iw: number, ih: number, crop: CropRegion, cw: number, ch: number): string {
  const { x, y, width, height } = crop
  const fitScale = Math.min(cw / iw, ch / ih)
  const fw = iw * fitScale
  const fh = ih * fitScale
  const imgLeft = (cw - fw) / 2
  const imgTop  = (ch - fh) / 2
  const cropCenterX = imgLeft + (x + width  / 2) / 100 * fw
  const cropCenterY = imgTop  + (y + height / 2) / 100 * fh
  const cropW = width  / 100 * fw
  const cropH = height / 100 * fh
  const zoom = Math.max(cw / cropW, ch / cropH)
  const tx = cw / 2 - cropCenterX * zoom
  const ty = ch / 2 - cropCenterY * zoom
  return `translate(${tx}px, ${ty}px) scale(${zoom})`
}
