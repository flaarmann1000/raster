'use client'
import React, { useMemo, useEffect, useState } from 'react'
import { SourcePath, PixelMap, BezierPath, ViewMode } from '@/lib/types'
import { pathToSVGd, polylineToPathD } from '@/lib/geometry/bezier'
import { generateOffsetPolylines, adaptiveSamplePolyline } from '@/lib/geometry/offset'
import { smoothPath } from '@/lib/geometry/smooth'
import { makePill } from '@/lib/geometry/pill'
import { evalParam } from '@/lib/maps/params'
import { v } from '@/lib/geometry/vec2'
import { renderMap } from '@/lib/maps/renderer'

interface RenderEngineProps {
  sourcePaths: SourcePath[]
  pixelMaps: PixelMap[]
  canvasW: number
  canvasH: number
  viewMode: ViewMode
  showGuides: boolean
  showOffsets: boolean
  activePathId: string | null
  activeMapId: string | null
}

export function RenderEngine({
  sourcePaths, pixelMaps, canvasW, canvasH,
  viewMode, showGuides, showOffsets, activePathId, activeMapId,
}: RenderEngineProps) {
  const mapLookup = useMemo(() =>
    (id: string) => pixelMaps.find(m => m.id === id),
    [pixelMaps]
  )

  const showPills = viewMode === 'render' || viewMode === 'combined'
  const showGuideLines = showGuides && (viewMode === 'guide' || viewMode === 'combined')
  const showOffsetLines = showOffsets && (viewMode === 'guide' || viewMode === 'combined')

  const activeMap = activeMapId ? pixelMaps.find(m => m.id === activeMapId) : null

  return (
    <>
      {/* Map overlay — in Pixel Map view and combined view */}
      {activeMap && (viewMode === 'map' || viewMode === 'combined') && (
        <MapOverlay map={activeMap} canvasW={canvasW} canvasH={canvasH} viewMode={viewMode} />
      )}
      {sourcePaths.map(sp => (
        <PathRenderer
          key={sp.id}
          sp={sp}
          mapLookup={mapLookup}
          canvasW={canvasW}
          canvasH={canvasH}
          showPills={showPills}
          showGuideLines={showGuideLines}
          showOffsetLines={showOffsetLines}
          isActive={sp.id === activePathId}
        />
      ))}
    </>
  )
}

interface PathRendererProps {
  sp: SourcePath
  mapLookup: (id: string) => PixelMap | undefined
  canvasW: number
  canvasH: number
  showPills: boolean
  showGuideLines: boolean
  showOffsetLines: boolean
  isActive: boolean
}

function PathRenderer({ sp, mapLookup, canvasW, canvasH, showPills, showGuideLines, showOffsetLines, isActive }: PathRendererProps) {
  const { offsetSettings, pillSettings, smoothingSettings } = sp

  const result = useMemo(() => {
    if (!sp.visible) return null

    const evalAt = (param: typeof pillSettings.length, wx: number, wy: number) =>
      evalParam(param, wx, wy, canvasW, canvasH, mapLookup)

    // Apply non-destructive smoothing
    let centerPath = sp.path
    if (smoothingSettings.enabled) {
      const r = evalAt(smoothingSettings.radius, canvasW / 2, canvasH / 2)
      centerPath = smoothPath(centerPath, r)
    }

    // Evaluate offset params at canvas center (count/global params)
    const count = Math.round(Math.max(0, evalAt(offsetSettings.count, canvasW/2, canvasH/2)))
    const baseDistance = evalAt(offsetSettings.baseDistance, canvasW/2, canvasH/2)
    const growth = evalAt(offsetSettings.growth, canvasW/2, canvasH/2)

    // Use polyline-based offset
    const offsets = generateOffsetPolylines(centerPath, count, baseDistance, growth, offsetSettings.symmetric)

    // Pill shapes across all offset lines
    const pillElements: React.ReactNode[] = []
    const offsetPathElements: React.ReactNode[] = []

    for (const ol of offsets) {
      const distFromCenter = Math.abs(ol.distance)

      if (showOffsetLines && ol.side !== 'center') {
        const d = polylineToPathD(ol.points, false)
        offsetPathElements.push(
          <path key={`offset_${ol.side}_${ol.index}`} d={d} stroke="#3b82f6" strokeWidth="0.5" fill="none" opacity="0.5" strokeDasharray="4 3" />
        )
      }

      if (showPills) {
        const spacingFalloff = evalAt(pillSettings.spacingFalloff, canvasW/2, canvasH/2)

        const samples = adaptiveSamplePolyline(ol.points, (pos) => {
          const baseSpacing = evalAt(pillSettings.spacing, pos.x, pos.y)
          return Math.max(1, baseSpacing + spacingFalloff * (distFromCenter / Math.max(Math.abs(baseDistance), 1)))
        })

        for (let pi = 0; pi < samples.length; pi++) {
          const sample = samples[pi]
          const { pos } = sample

          const baseLen = evalAt(pillSettings.length, pos.x, pos.y)
          const lenFalloff = evalAt(pillSettings.lengthFalloff, pos.x, pos.y)
          const pillLen = Math.max(0.5, baseLen - lenFalloff * distFromCenter)

          const baseThick = evalAt(pillSettings.thickness, pos.x, pos.y)
          const thickFalloff = evalAt(pillSettings.thicknessFalloff, pos.x, pos.y)
          const pillThick = Math.max(0.5, baseThick - thickFalloff * distFromCenter)

          const pill = makePill(pos, sample.tangent, pillLen, pillThick)
          const style = pillSettings.style

          pillElements.push(
            <path
              key={`${ol.side}_${ol.index}_p${pi}`}
              d={pill.d}
              fill={style !== 'stroke' ? pillSettings.fillColor : 'none'}
              stroke={style !== 'fill' ? pillSettings.strokeColor : 'none'}
              strokeWidth={style !== 'fill' ? pillSettings.strokeWidth : 0}
            />
          )
        }
      }
    }

    return { centerPath, offsetPathElements, pillElements }
  }, [sp, mapLookup, canvasW, canvasH, showPills, showOffsetLines])

  if (!result || !sp.visible) return null

  return (
    <g id={`sp_${sp.id}`}>
      {result.offsetPathElements}
      {result.pillElements}
      {showGuideLines && (
        <path
          d={pathToSVGd(result.centerPath)}
          stroke={isActive ? '#f59e0b' : '#6b7280'}
          strokeWidth={isActive ? '1.5' : '1'}
          fill="none"
          opacity="0.7"
          strokeDasharray={isActive ? undefined : '6 4'}
        />
      )}
    </g>
  )
}

// ─── Map overlay ──────────────────────────────────────────────────────────────

function mapToDataUrl(map: PixelMap): string | null {
  const rendered = renderMap(map)
  const { width, height } = map
  if (width <= 0 || height <= 0) return null

  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const imageData = ctx.createImageData(width, height)
    for (let i = 0; i < width * height; i++) {
      const v = Math.round(rendered[i] * 255)
      imageData.data[i * 4 + 0] = v
      imageData.data[i * 4 + 1] = v
      imageData.data[i * 4 + 2] = v
      imageData.data[i * 4 + 3] = 255
    }
    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL()
  } catch {
    return null
  }
}

interface MapOverlayProps {
  map: PixelMap
  canvasW: number
  canvasH: number
  viewMode: ViewMode
}

function MapOverlay({ map, canvasW, canvasH, viewMode }: MapOverlayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    setDataUrl(mapToDataUrl(map))
  }, [map])

  if (!dataUrl) return null

  const opacity = viewMode === 'map' ? 0.85 : 0.2
  const fit = map.fit ?? 'cover'

  let x: number, y: number, w: number, h: number

  if (fit === 'cover') {
    const size = Math.max(canvasW, canvasH)
    const dx = (size - canvasW) / 2
    const dy = (size - canvasH) / 2
    x = -dx; y = -dy; w = size; h = size
  } else if (fit === 'contain') {
    const scale = Math.min(canvasW, canvasH)
    const dx = (canvasW - scale) / 2
    const dy = (canvasH - scale) / 2
    x = dx; y = dy; w = scale; h = scale
  } else if (fit === 'none') {
    const zoom = map.mapZoom ?? 1
    const ox = map.mapOffsetX ?? 0
    const oy = map.mapOffsetY ?? 0
    w = canvasW * zoom
    h = canvasH * zoom
    x = -ox * w
    y = -oy * h
  } else {
    // 'fill': stretch map to canvas
    x = 0; y = 0; w = canvasW; h = canvasH
  }

  return (
    <image
      href={dataUrl}
      x={x} y={y}
      width={w} height={h}
      opacity={opacity}
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
