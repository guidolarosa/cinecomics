'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Asset, CropRegion } from '@/types'

interface Props {
  asset: Asset
  crop: CropRegion | null
  onChange: (crop: CropRegion) => void
}

const MIN_SIZE = 5 // percentage

export default function CropTool({ asset, crop, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [current, setCurrent] = useState<CropRegion | null>(crop)

  useEffect(() => {
    setCurrent(crop)
  }, [crop])

  function toPercent(clientX: number, clientY: number) {
    const rect = containerRef.current!.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    }
  }

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const pt = toPercent(e.clientX, e.clientY)
    setStart(pt)
    setDragging(true)
    setCurrent({ x: pt.x, y: pt.y, width: 0, height: 0 })
  }, [])

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging || !start) return
      const pt = toPercent(e.clientX, e.clientY)
      setCurrent({
        x: Math.min(start.x, pt.x),
        y: Math.min(start.y, pt.y),
        width: Math.abs(pt.x - start.x),
        height: Math.abs(pt.y - start.y),
      })
    },
    [dragging, start]
  )

  const onMouseUp = useCallback(() => {
    if (!dragging || !current) return
    setDragging(false)
    setStart(null)
    if (current.width >= MIN_SIZE && current.height >= MIN_SIZE) {
      onChange(current)
    }
  }, [dragging, current, onChange])

  return (
    <div className="relative select-none max-w-full max-h-full" style={{ display: 'inline-block' }}>
      <div
        ref={containerRef}
        className="relative cursor-crosshair"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.url}
          alt=""
          className="max-w-full max-h-[75vh] object-contain block"
          draggable={false}
        />

        {/* Dimming overlay */}
        {current && current.width > 0 && (
          <div className="absolute inset-0 bg-black/50 pointer-events-none" />
        )}

        {/* Crop rectangle */}
        {current && current.width >= MIN_SIZE && (
          <div
            className="absolute border-2 border-primary pointer-events-none"
            style={{
              left: `${current.x}%`,
              top: `${current.y}%`,
              width: `${current.width}%`,
              height: `${current.height}%`,
              boxShadow: 'inset 0 0 0 9999px rgba(0,0,0,0)', // clear interior
            }}
          />
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-2">
        {current && current.width >= MIN_SIZE
          ? `Crop: ${current.x.toFixed(1)}%, ${current.y.toFixed(1)}% — ${current.width.toFixed(1)}×${current.height.toFixed(1)}`
          : 'Click and drag to set the crop region'}
      </p>
    </div>
  )
}
