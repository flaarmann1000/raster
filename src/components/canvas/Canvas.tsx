'use client'
import React, { useRef, useCallback, useEffect, useState } from 'react'
import { useStore } from '@/store/useStore'
import { RenderEngine } from './RenderEngine'
import { PathEditor } from './PathEditor'

export function Canvas() {
  const svgRef = useRef<SVGSVGElement>(null!)
  const containerRef = useRef<HTMLDivElement>(null!)
  const {
    sourcePaths, pixelMaps, viewport, viewMode,
    showGuides, showOffsets, activePathId, activeTool,
    canvasSize, setViewport, setCanvasSize, backgroundColor, activeMapId,
  } = useStore()

  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef<{ mx: number; my: number; vx: number; vy: number } | null>(null)

  // Resize observer
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect
        // Canvas size is fixed at 800x600 by default; container adapts
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Pan (middle mouse or space+drag)
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || activeTool === 'pan') {
      setIsPanning(true)
      panStart.current = { mx: e.clientX, my: e.clientY, vx: viewport.x, vy: viewport.y }
      e.preventDefault()
    }
  }, [activeTool, viewport])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning && panStart.current) {
      const dx = e.clientX - panStart.current.mx
      const dy = e.clientY - panStart.current.my
      setViewport({ x: panStart.current.vx + dx, y: panStart.current.vy + dy })
    }
  }, [isPanning, setViewport])

  const onMouseUp = useCallback(() => {
    setIsPanning(false)
    panStart.current = null
  }, [])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.91
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    setViewport({
      scale: Math.max(0.1, Math.min(8, viewport.scale * factor)),
      x: mx - (mx - viewport.x) * factor,
      y: my - (my - viewport.y) * factor,
    })
  }, [viewport, setViewport])

  const { width, height } = canvasSize

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden bg-[#0a0a0a]"
      style={{ cursor: isPanning ? 'grabbing' : activeTool === 'pan' ? 'grab' : 'default' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onWheel={onWheel}
    >
      {/* Grid background */}
      <svg
        width="100%" height="100%"
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      >
        <defs>
          <pattern id="grid-minor" width="20" height="20" patternUnits="userSpaceOnUse"
            patternTransform={`translate(${viewport.x % 20} ${viewport.y % 20})`}>
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1a1a1a" strokeWidth="0.5"/>
          </pattern>
          <pattern id="grid-major" width="100" height="100" patternUnits="userSpaceOnUse"
            patternTransform={`translate(${viewport.x % 100} ${viewport.y % 100})`}>
            <rect width="100" height="100" fill="url(#grid-minor)"/>
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#222" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-major)"/>
      </svg>

      {/* Main SVG canvas */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{
          position: 'absolute',
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          transformOrigin: '0 0',
          boxShadow: '0 0 0 1px #333, 0 4px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Background */}
        <rect width={width} height={height} fill={backgroundColor} />

        {/* Render pills and guide lines */}
        <RenderEngine
          sourcePaths={sourcePaths}
          pixelMaps={pixelMaps}
          canvasW={width}
          canvasH={height}
          viewMode={viewMode}
          showGuides={showGuides}
          showOffsets={showOffsets}
          activePathId={activePathId}
          activeMapId={activeMapId}
        />

        {/* Interactive path editing handles */}
        {activeTool !== 'pan' && (
          <PathEditor svgRef={svgRef} canvasW={width} canvasH={height} />
        )}
      </svg>

      {/* Zoom indicator */}
      <div className="absolute bottom-3 right-3 text-xs text-[#555] pointer-events-none">
        {Math.round(viewport.scale * 100)}%
      </div>
    </div>
  )
}
