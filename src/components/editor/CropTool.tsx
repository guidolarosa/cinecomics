'use client'

import { useRef, useState, useEffect } from 'react'
import { Asset, CropRegion } from '@/types'
import { Button } from '@/components/ui/button'
import { Minus, Plus, RotateCcw, X } from 'lucide-react'

type HandleDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
type DragMode = 'draw' | 'move' | HandleDir

interface DragState {
  mode: DragMode
  startMouse: { x: number; y: number }
  startCrop: CropRegion | null
}

const HANDLE_HIT = 5
const MIN_SIZE   = 2

const HANDLES: { dir: HandleDir; lx: number; ly: number }[] = [
  { dir: 'nw', lx: 0,   ly: 0   },
  { dir: 'n',  lx: 0.5, ly: 0   },
  { dir: 'ne', lx: 1,   ly: 0   },
  { dir: 'e',  lx: 1,   ly: 0.5 },
  { dir: 'se', lx: 1,   ly: 1   },
  { dir: 's',  lx: 0.5, ly: 1   },
  { dir: 'sw', lx: 0,   ly: 1   },
  { dir: 'w',  lx: 0,   ly: 0.5 },
]

const MODE_CURSOR: Record<DragMode, string> = {
  draw: 'crosshair', move: 'move',
  nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize',
  e: 'e-resize', se: 'se-resize', s: 's-resize',
  sw: 'sw-resize', w: 'w-resize',
}

interface Props {
  asset: Asset
  crop: CropRegion | null
  onChange: (crop: CropRegion) => void
  onClear: () => void
}

export default function CropTool({ asset, crop, onChange, onClear }: Props) {
  const scrollRef  = useRef<HTMLDivElement>(null)
  const imgRef     = useRef<HTMLImageElement>(null)
  const localCropRef = useRef<CropRegion | null>(crop)

  const [localCrop,     setLocalCrop]     = useState<CropRegion | null>(crop)
  const [drag,          setDrag]          = useState<DragState | null>(null)
  const [cursor,        setCursor]        = useState('crosshair')
  const [viewZoom,      setViewZoom]      = useState(1)
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null)
  const [naturalSize,   setNaturalSize]   = useState<{ w: number; h: number } | null>(
    asset.width && asset.height ? { w: asset.width, h: asset.height } : null
  )

  // Observe the scroll container so we always know its pixel dimensions
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setContainerSize({ w: width, h: height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Sync crop from parent
  useEffect(() => {
    setLocalCrop(crop)
    localCropRef.current = crop
  }, [crop])

  // Reset zoom and re-read natural size on asset change
  useEffect(() => {
    setViewZoom(1)
    setNaturalSize(asset.width && asset.height ? { w: asset.width, h: asset.height } : null)
  }, [asset.id, asset.width, asset.height])

  // Ctrl/Cmd + scroll → zoom
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        setViewZoom((z) => clampZoom(z - e.deltaY * 0.005))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ── Compute the "fit" size: image contained within the scroll container at 100% ──
  // At viewZoom=1 the whole image is visible; >1 zooms in (scrollable); <1 zooms out.
  let fitW = 0
  let fitH = 0
  if (containerSize && naturalSize && naturalSize.w > 0 && naturalSize.h > 0) {
    const scale = Math.min(containerSize.w / naturalSize.w, containerSize.h / naturalSize.h)
    fitW = Math.round(naturalSize.w * scale)
    fitH = Math.round(naturalSize.h * scale)
  }
  const renderedW = fitW > 0 ? Math.round(fitW * viewZoom) : undefined
  const renderedH = fitH > 0 ? Math.round(fitH * viewZoom) : undefined

  // ── Coordinate helpers ──────────────────────────────────────────────────────
  function toPercent(clientX: number, clientY: number) {
    const rect = imgRef.current!.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(100, (clientX - rect.left) / rect.width  * 100)),
      y: Math.max(0, Math.min(100, (clientY - rect.top)  / rect.height * 100)),
    }
  }

  function getMode(pt: { x: number; y: number }): DragMode {
    const c = localCropRef.current
    if (!c || c.width < MIN_SIZE) return 'draw'
    for (const h of HANDLES) {
      const hx = c.x + h.lx * c.width
      const hy = c.y + h.ly * c.height
      if (Math.abs(pt.x - hx) < HANDLE_HIT && Math.abs(pt.y - hy) < HANDLE_HIT) return h.dir
    }
    if (pt.x >= c.x && pt.x <= c.x + c.width && pt.y >= c.y && pt.y <= c.y + c.height) return 'move'
    return 'draw'
  }

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    const pt   = toPercent(e.clientX, e.clientY)
    const mode = getMode(pt)
    const startCrop = localCropRef.current ? { ...localCropRef.current } : null
    setDrag({ mode, startMouse: pt, startCrop })
    if (mode === 'draw') {
      const blank = { x: pt.x, y: pt.y, width: 0, height: 0 }
      setLocalCrop(blank)
      localCropRef.current = blank
    }
  }

  function onMouseMoveHover(e: React.MouseEvent) {
    if (drag) return
    setCursor(MODE_CURSOR[getMode(toPercent(e.clientX, e.clientY))])
  }

  // Window-level drag listeners
  useEffect(() => {
    if (!drag) return
    const activeDrag = drag

    function handleMove(e: MouseEvent) {
      if (!imgRef.current) return
      const rect = imgRef.current.getBoundingClientRect()
      const pt = {
        x: Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width  * 100)),
        y: Math.max(0, Math.min(100, (e.clientY - rect.top)  / rect.height * 100)),
      }
      const dx = pt.x - activeDrag.startMouse.x
      const dy = pt.y - activeDrag.startMouse.y
      let next: CropRegion | null = null

      if (activeDrag.mode === 'draw') {
        const { x: sx, y: sy } = activeDrag.startMouse
        next = {
          x: Math.min(sx, pt.x), y: Math.min(sy, pt.y),
          width: Math.abs(pt.x - sx), height: Math.abs(pt.y - sy),
        }
      } else if (activeDrag.mode === 'move' && activeDrag.startCrop) {
        const sc = activeDrag.startCrop
        next = {
          ...sc,
          x: Math.max(0, Math.min(100 - sc.width,  sc.x + dx)),
          y: Math.max(0, Math.min(100 - sc.height, sc.y + dy)),
        }
      } else if (activeDrag.startCrop) {
        next = resize(activeDrag.startCrop, activeDrag.mode as HandleDir, dx, dy)
      }

      if (next) { setLocalCrop(next); localCropRef.current = next }
    }

    function handleUp() {
      setDrag(null)
      const c = localCropRef.current
      if (c && c.width >= MIN_SIZE && c.height >= MIN_SIZE) onChange(c)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup',   handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup',   handleUp)
    }
  }, [drag, onChange])

  const hasCrop = !!localCrop && localCrop.width >= MIN_SIZE && localCrop.height >= MIN_SIZE

  return (
    // Fill the parent canvas area completely, like a Figma-style canvas
    <div className="relative w-full h-full flex flex-col select-none">

      {/* Scrollable canvas — flex-1 + min-h-0 so it grows to fill and allows shrink */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-auto"
      >
        {/*
          Centering wrapper: centers the image when it's smaller than the container.
          When zoomed in past the container size, scrollbars appear naturally.
        */}
        <div className="flex items-center justify-center" style={{ minWidth: '100%', minHeight: '100%' }}>
          {/* Relative container sized exactly to the rendered image */}
          <div
            className="relative flex-shrink-0"
            style={{
              width:  renderedW ?? '100%',
              height: renderedH ?? '100%',
              cursor: drag ? MODE_CURSOR[drag.mode] : cursor,
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMoveHover}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={asset.url}
              alt=""
              style={{
                display: 'block',
                width:   renderedW ?? '100%',
                height:  renderedH ?? '100%',
                objectFit: renderedW ? 'fill' : 'contain',
              }}
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget
                setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
              }}
            />

            {hasCrop && localCrop && (
              <>
                {/* Dimming outside crop via clip-path punch-through */}
                <div
                  className="absolute inset-0 pointer-events-none bg-black/50"
                  style={{
                    clipPath: `polygon(
                      0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
                      ${localCrop.x}% ${localCrop.y}%,
                      ${localCrop.x}% ${localCrop.y + localCrop.height}%,
                      ${localCrop.x + localCrop.width}% ${localCrop.y + localCrop.height}%,
                      ${localCrop.x + localCrop.width}% ${localCrop.y}%,
                      ${localCrop.x}% ${localCrop.y}%
                    )`,
                  }}
                />

                {/* Crop border + resize handles */}
                <div
                  className="absolute border-2 border-primary pointer-events-none"
                  style={{
                    left:   `${localCrop.x}%`,
                    top:    `${localCrop.y}%`,
                    width:  `${localCrop.width}%`,
                    height: `${localCrop.height}%`,
                  }}
                >
                  {HANDLES.map((h) => (
                    <div
                      key={h.dir}
                      className="absolute w-2.5 h-2.5 bg-white border-2 border-primary rounded-sm"
                      style={{
                        left:      `${h.lx * 100}%`,
                        top:       `${h.ly * 100}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Status bar pinned to bottom */}
      <div className="shrink-0 flex items-center gap-3 px-3 py-1.5 border-t border-white/10 bg-zinc-950/80">
        <span className="text-xs text-zinc-400 flex-1">
          {hasCrop && localCrop
            ? `${localCrop.x.toFixed(1)}%, ${localCrop.y.toFixed(1)}% · ${localCrop.width.toFixed(1)} × ${localCrop.height.toFixed(1)}`
            : 'Click and drag to draw a crop region · Ctrl+scroll to zoom'}
        </span>
        {hasCrop && (
          <Button variant="outline" size="sm" onClick={onClear} className="h-6 px-2 text-xs">
            <X className="w-3 h-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Zoom toolbar floating in top-right corner */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-zinc-900/90 backdrop-blur-sm rounded-md px-2 py-1.5 shadow-lg border border-white/10">
        <span className="text-xs text-zinc-400 mr-1">Zoom</span>
        <Button
          variant="ghost" size="sm" className="h-6 w-6 p-0 text-zinc-300 hover:text-white hover:bg-white/10"
          onClick={() => setViewZoom((z) => clampZoom(z - 0.25))}
        >
          <Minus className="w-3 h-3" />
        </Button>
        <span className="text-xs w-10 text-center tabular-nums text-zinc-200">{Math.round(viewZoom * 100)}%</span>
        <Button
          variant="ghost" size="sm" className="h-6 w-6 p-0 text-zinc-300 hover:text-white hover:bg-white/10"
          onClick={() => setViewZoom((z) => clampZoom(z + 0.25))}
        >
          <Plus className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/10 ml-0.5"
          onClick={() => setViewZoom(1)}
        >
          <RotateCcw className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}

function clampZoom(z: number) {
  return Math.max(0.25, Math.min(4, z))
}

function resize(crop: CropRegion, dir: HandleDir, dx: number, dy: number): CropRegion {
  let { x, y, width, height } = crop

  if (dir.includes('w')) {
    const nx = Math.max(0, Math.min(x + width - MIN_SIZE, x + dx))
    width += x - nx
    x = nx
  }
  if (dir.includes('e')) {
    width = Math.max(MIN_SIZE, Math.min(100 - x, width + dx))
  }
  if (dir.includes('n')) {
    const ny = Math.max(0, Math.min(y + height - MIN_SIZE, y + dy))
    height += y - ny
    y = ny
  }
  if (dir.includes('s')) {
    height = Math.max(MIN_SIZE, Math.min(100 - y, height + dy))
  }

  return { x, y, width, height }
}
