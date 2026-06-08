'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Project, Frame, Asset } from '@/types'

interface Props {
  projectId: string
}

export default function Presentation({ projectId }: Props) {
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [frameIndex, setFrameIndex] = useState(0)

  const bgAudioRef = useRef<HTMLAudioElement | null>(null)
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((p: Project) => {
        setProject({ ...p, frames: p.frames.slice().sort((a, b) => a.order - b.order) })
      })
  }, [projectId])

  const frames = project?.frames ?? []
  const currentFrame = frames[frameIndex]

  // ─── Audio engine ─────────────────────────────────────────────────────────

  function clearFade() {
    if (fadeTimerRef.current) { clearInterval(fadeTimerRef.current); fadeTimerRef.current = null }
  }

  function startBgAudio(url: string) {
    clearFade()
    bgAudioRef.current?.pause()
    const audio = new Audio(url)
    audio.loop = true
    audio.volume = 1
    audio.play().catch(() => {})
    bgAudioRef.current = audio
  }

  function stopBgAudio(fadeOutDuration: number) {
    clearFade()
    const audio = bgAudioRef.current
    if (!audio) return
    if (fadeOutDuration <= 0) { audio.pause(); return }
    const step = 50
    const decrement = audio.volume / ((fadeOutDuration * 1000) / step)
    fadeTimerRef.current = setInterval(() => {
      if (!bgAudioRef.current) return clearFade()
      bgAudioRef.current.volume = Math.max(0, bgAudioRef.current.volume - decrement)
      if (bgAudioRef.current.volume <= 0) { bgAudioRef.current.pause(); clearFade() }
    }, step)
  }

  function triggerSfx(url: string) {
    new Audio(url).play().catch(() => {})
  }

  useEffect(() => {
    if (!currentFrame || !project) return
    const { backgroundAction, backgroundAudioId, fadeOutDuration } = currentFrame.audio
    if (backgroundAction === 'start' && backgroundAudioId) {
      const f = project.audioFiles.find((a) => a.id === backgroundAudioId)
      if (f) startBgAudio(f.url)
    } else if (backgroundAction === 'stop') {
      stopBgAudio(fadeOutDuration)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameIndex, project])

  // ─── Keyboard ─────────────────────────────────────────────────────────────

  const navigate = useCallback(
    (dir: 1 | -1) => setFrameIndex((i) => Math.max(0, Math.min(frames.length - 1, i + dir))),
    [frames.length]
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!project || !currentFrame) return
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); navigate(1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); navigate(-1) }
      else if (e.key === 'Escape') { router.push(`/projects/${projectId}/edit`) }
      else if (e.key >= '1' && e.key <= '9') {
        const slot = currentFrame.soundboard[parseInt(e.key) - 1]
        if (slot?.audioFileId) {
          const f = project.audioFiles.find((a) => a.id === slot.audioFileId)
          if (f) triggerSfx(f.url)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [project, currentFrame, navigate, router, projectId])

  // ─── Fullscreen ───────────────────────────────────────────────────────────

  useEffect(() => {
    document.documentElement.requestFullscreen().catch(() => {})
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
      clearFade()
      bgAudioRef.current?.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const bgColor = project?.backgroundColor ?? '#000000'

  if (!project || !currentFrame) {
    return <div className="w-screen h-screen" style={{ background: bgColor }} />
  }

  const asset = project.assets.find((a) => a.id === currentFrame.assetId) ?? null

  return (
    <div className="w-screen h-screen overflow-hidden" style={{ background: bgColor }}>
      <FrameView frame={currentFrame} asset={asset} bgColor={bgColor} />
    </div>
  )
}

// ─── Viewport hook ────────────────────────────────────────────────────────────

function useViewportSize() {
  const [size, setSize] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1920,
    h: typeof window !== 'undefined' ? window.innerHeight : 1080,
  }))
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

// ─── Frame renderer ───────────────────────────────────────────────────────────

interface FrameViewProps {
  frame: Frame
  asset: Asset | null
  bgColor: string
}

function computeTransform(
  frame: Frame,
  iw: number,
  ih: number,
  vw: number,
  vh: number
): string {
  if (frame.displayMode === 'full' || !frame.crop || !iw || !ih) return 'none'

  const { x, y, width, height } = frame.crop

  // Scale image to fit viewport (contain), compute rendered image rect
  const fitScale = Math.min(vw / iw, vh / ih)
  const fw = iw * fitScale                    // rendered image width
  const fh = ih * fitScale                    // rendered image height
  const imgLeft = (vw - fw) / 2              // image left offset in container
  const imgTop  = (vh - fh) / 2              // image top offset in container

  // Crop region center in container pixel coordinates
  const cropCenterX = imgLeft + (x + width  / 2) / 100 * fw
  const cropCenterY = imgTop  + (y + height / 2) / 100 * fh

  // Crop region size in container pixels
  const cropW = width  / 100 * fw
  const cropH = height / 100 * fh

  // Zoom factor: fill viewport with the crop, letterboxing if aspect ratios differ
  const zoom = Math.min(vw / cropW, vh / cropH)

  // Translate so crop center maps to viewport center.
  // With transform-origin: 0 0, point (px, py) maps to (px*zoom + tx, py*zoom + ty).
  const tx = vw / 2 - cropCenterX * zoom
  const ty = vh / 2 - cropCenterY * zoom

  return `translate(${tx}px, ${ty}px) scale(${zoom})`
}

function FrameView({ frame, asset, bgColor }: FrameViewProps) {
  const { w: vw, h: vh } = useViewportSize()

  // Track natural dimensions keyed by asset id — prevents stale dims on asset change.
  // Seed from stored metadata immediately; onLoad corrects if metadata was missing/wrong.
  const [loaded, setLoaded] = useState<{ id: string; w: number; h: number } | null>(
    asset?.width && asset?.height ? { id: asset.id, w: asset.width, h: asset.height } : null
  )

  useEffect(() => {
    if (asset?.width && asset?.height) {
      setLoaded({ id: asset.id, w: asset.width, h: asset.height })
    } else {
      setLoaded(null)
    }
  }, [asset?.id, asset?.width, asset?.height])

  if (!asset) return <div className="w-full h-full" />

  // Only use loaded dims if they belong to the current asset
  const iw = loaded?.id === asset.id ? loaded.w : 0
  const ih = loaded?.id === asset.id ? loaded.h : 0

  const transform = computeTransform(frame, iw, ih, vw, vh)

  return (
    <div className="w-full h-full overflow-hidden relative" style={{ background: bgColor }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset.url}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',    // browser handles aspect ratio — no stretching possible
          transformOrigin: '0 0',
          transform,
          transition: 'transform 600ms ease-in-out',
        }}
        onLoad={(e) => {
          const img = e.currentTarget
          setLoaded({ id: asset.id, w: img.naturalWidth, h: img.naturalHeight })
        }}
      />
    </div>
  )
}
