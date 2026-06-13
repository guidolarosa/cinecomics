'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react'
import { Project, Frame, Asset } from '@/types'
import { flattenFrames } from '@/lib/frameOrder'

interface Props {
  projectId: string
}

export default function Presentation({ projectId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const startFrameId = searchParams.get('frameId')

  const [project, setProject]       = useState<Project | null>(null)
  const [frameIndex, setFrameIndex] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [toolbarVisible, setToolbarVisible] = useState(true)

  const bgAudioRef    = useRef<HTMLAudioElement | null>(null)
  const fadeTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const hideTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Load project ─────────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((p: Project) => {
        const flat = flattenFrames(p.frames, p.groups ?? [])
        setProject({ ...p, frames: flat })
        if (startFrameId) {
          const idx = flat.findIndex((f) => f.id === startFrameId)
          if (idx !== -1) setFrameIndex(idx)
        }
      })
  }, [projectId])

  const frames       = project?.frames ?? []
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearFade()
      bgAudioRef.current?.pause()
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Fullscreen ───────────────────────────────────────────────────────────

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  // ─── Toolbar auto-hide ────────────────────────────────────────────────────

  const resetHideTimer = useCallback(() => {
    setToolbarVisible(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setToolbarVisible(false), 3000)
  }, [])

  useEffect(() => {
    resetHideTimer()
    window.addEventListener('mousemove', resetHideTimer)
    return () => window.removeEventListener('mousemove', resetHideTimer)
  }, [resetHideTimer])

  // ─── Keyboard ─────────────────────────────────────────────────────────────

  const navigate = useCallback(
    (dir: 1 | -1) => setFrameIndex((i) => Math.max(0, Math.min(frames.length - 1, i + dir))),
    [frames.length]
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!project || !currentFrame) return
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); navigate(1) }
      else if (e.key === 'ArrowLeft')               { e.preventDefault(); navigate(-1) }
      else if (e.key === 'Escape' && !document.fullscreenElement) {
        router.push(`/projects/${projectId}/edit`)
      }
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

  // ─── Render ───────────────────────────────────────────────────────────────

  const bgColor = project?.backgroundColor ?? '#000000'

  if (!project || !currentFrame) {
    return <div className="w-screen h-screen" style={{ background: bgColor }} />
  }

  const asset          = project.assets.find((a) => a.id === currentFrame.assetId) ?? null
  const transitionType = currentFrame.transition ?? 'zoom'
  const viewKey        = transitionType !== 'zoom' ? frameIndex : undefined
  const scale          = project.presentationScale ?? 1

  const atStart = frameIndex === 0
  const atEnd   = frameIndex === frames.length - 1

  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: bgColor }}>
      {/* Frame content */}
      <div
        key={viewKey}
        className="w-full h-full"
        style={{
          animation: transitionType === 'fade' ? 'cc-fade-in 500ms ease-in-out forwards' : undefined,
        }}
      >
        <FrameView
          frame={currentFrame}
          asset={asset}
          bgColor={bgColor}
          animateTransform={transitionType === 'zoom'}
          scale={scale}
        />
      </div>

      {/* Click zones — left half goes back, right half goes forward */}
      <div className="absolute inset-0 flex pointer-events-none" style={{ zIndex: 10 }}>
        <div
          className="flex-1 h-full pointer-events-auto"
          style={{ cursor: atStart ? 'default' : 'w-resize' }}
          onClick={() => !atStart && navigate(-1)}
        />
        <div
          className="flex-1 h-full pointer-events-auto"
          style={{ cursor: atEnd ? 'default' : 'e-resize' }}
          onClick={() => !atEnd && navigate(1)}
        />
      </div>

      {/* Bottom toolbar */}
      <div
        className="absolute bottom-0 inset-x-0 flex items-center h-12 px-3 transition-opacity duration-300"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)',
          opacity: toolbarVisible ? 1 : 0,
          pointerEvents: toolbarVisible ? 'auto' : 'none',
          zIndex: 20,
        }}
      >
        {/* Left slot — reserved for future controls */}
        <div className="flex-1" />

        {/* Center: prev / counter / next */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(-1)}
            disabled={atStart}
            className="flex items-center justify-center w-7 h-7 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-default"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs text-white/60 tabular-nums select-none w-16 text-center">
            {frameIndex + 1} / {frames.length}
          </span>

          <button
            onClick={() => navigate(1)}
            disabled={atEnd}
            className="flex items-center justify-center w-7 h-7 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-default"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Right: fullscreen toggle */}
        <div className="flex-1 flex justify-end">
          <button
            onClick={toggleFullscreen}
            className="flex items-center justify-center w-7 h-7 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
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
  animateTransform?: boolean
  scale?: number
}

function computeTransform(
  frame: Frame,
  iw: number,
  ih: number,
  vw: number,
  vh: number,
  scale = 1,
): string {
  if (frame.displayMode === 'full' || !frame.crop || !iw || !ih) return 'none'

  const { x, y, width, height } = frame.crop

  const fitScale    = Math.min(vw / iw, vh / ih)
  const fw          = iw * fitScale
  const fh          = ih * fitScale
  const imgLeft     = (vw - fw) / 2
  const imgTop      = (vh - fh) / 2
  const cropCenterX = imgLeft + (x + width  / 2) / 100 * fw
  const cropCenterY = imgTop  + (y + height / 2) / 100 * fh
  const cropW       = width  / 100 * fw
  const cropH       = height / 100 * fh

  // Base zoom fills the viewport with the crop; scale pulls it back out
  const zoom = Math.min(vw / cropW, vh / cropH) * scale

  const tx = vw / 2 - cropCenterX * zoom
  const ty = vh / 2 - cropCenterY * zoom

  return `translate(${tx}px, ${ty}px) scale(${zoom})`
}

function FrameView({ frame, asset, bgColor, animateTransform = true, scale = 1 }: FrameViewProps) {
  const { w: vw, h: vh } = useViewportSize()

  const [loaded, setLoaded] = useState<{ id: string; w: number; h: number } | null>(
    asset?.width && asset?.height ? { id: asset.id, w: asset.width, h: asset.height } : null
  )

  useEffect(() => {
    if (asset?.width && asset?.height) setLoaded({ id: asset.id, w: asset.width, h: asset.height })
    else setLoaded(null)
  }, [asset?.id, asset?.width, asset?.height])

  if (!asset) return <div className="w-full h-full" style={{ background: bgColor }} />

  const iw        = loaded?.id === asset.id ? loaded.w : 0
  const ih        = loaded?.id === asset.id ? loaded.h : 0
  // scale reduces the crop zoom — the image always fills the full viewport
  const transform = computeTransform(frame, iw, ih, vw, vh, scale)

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: bgColor }}>
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
          transition: animateTransform ? 'transform 600ms ease-in-out' : 'none',
        }}
        onLoad={(e) => {
          const img = e.currentTarget
          setLoaded({ id: asset.id, w: img.naturalWidth, h: img.naturalHeight })
        }}
      />
    </div>
  )
}
