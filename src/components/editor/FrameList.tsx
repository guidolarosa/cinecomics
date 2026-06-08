'use client'

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
import { Copy, GripVertical, Trash2 } from 'lucide-react'
import { Frame, Project } from '@/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  project: Project
  selectedId: string | null
  onSelect: (id: string) => void
  onReorder: (frames: Frame[]) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

export default function FrameList({
  project,
  selectedId,
  onSelect,
  onReorder,
  onDuplicate,
  onDelete,
}: Props) {
  const sorted = project.frames.slice().sort((a, b) => a.order - b.order)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sorted.findIndex((f) => f.id === active.id)
    const newIndex = sorted.findIndex((f) => f.id === over.id)
    onReorder(arrayMove(sorted, oldIndex, newIndex))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sorted.map((f) => f.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sorted.map((frame, i) => (
            <SortableFrame
              key={frame.id}
              frame={frame}
              index={i}
              asset={project.assets.find((a) => a.id === frame.assetId) ?? null}
              isSelected={selectedId === frame.id}
              onSelect={onSelect}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

interface SortableFrameProps {
  frame: Frame
  index: number
  asset: { url: string } | null
  isSelected: boolean
  onSelect: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

function SortableFrame({
  frame,
  index,
  asset,
  isSelected,
  onSelect,
  onDuplicate,
  onDelete,
}: SortableFrameProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: frame.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex flex-col gap-1 rounded-md border p-1 cursor-pointer text-xs',
        isSelected
          ? 'border-primary bg-primary/10'
          : 'hover:border-muted-foreground border-transparent'
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
      <div className="w-full aspect-video bg-muted rounded overflow-hidden ml-3" style={{ width: 'calc(100% - 0.75rem)' }}>
        {asset ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[10px]">
            empty
          </div>
        )}
      </div>

      <span className="text-muted-foreground pl-4 text-[10px]">Frame {index + 1}</span>

      {/* Action buttons — visible on hover */}
      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); onDuplicate(frame.id) }}
        >
          <Copy className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-destructive hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onDelete(frame.id) }}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}
