'use client'
import React, { useRef, useCallback, useState, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { CubicSegment, Vec2, BezierPath } from '@/lib/types'
import { bezierPoint, pathToSVGd } from '@/lib/geometry/bezier'
import { clientToWorld, hitTestPath, HitResult } from './useCanvasInteraction'

interface PathEditorProps {
  svgRef: React.RefObject<SVGSVGElement>
  canvasW: number
  canvasH: number
}

const ANCHOR_R = 5
const CP_R = 3.5

export function PathEditor({ svgRef, canvasW, canvasH }: PathEditorProps) {
  const {
    sourcePaths, activePathId, viewport,
    activeTool, setActivePath, movePoint,
    addPath, pushHistory,
  } = useStore()

  const dragRef = useRef<HitResult | null>(null)

  const [drawPreview, setDrawPreview] = useState<Vec2 | null>(null)

  const toWorld = useCallback((e: React.MouseEvent | MouseEvent): Vec2 => {
    if (!svgRef.current) return { x: 0, y: 0 }
    return clientToWorld(e, svgRef.current, viewport)
  }, [svgRef, viewport])

  const onMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    const world = toWorld(e)

    if (activeTool === 'draw') {
      // Add point to active path or create new path
      const activeSp = sourcePaths.find(p => p.id === activePathId)
      if (!activeSp) {
        // Create new path starting at this point
        addPath()
        return
      }
      // Append segment to active path
      const segs = activeSp.path.segments
      const lastSeg = segs[segs.length - 1]
      const lastPt = lastSeg ? lastSeg[3] : world
      const newSeg: CubicSegment = [
        lastPt,
        { x: lastPt.x + (world.x - lastPt.x) * 0.33, y: lastPt.y + (world.y - lastPt.y) * 0.33 },
        { x: lastPt.x + (world.x - lastPt.x) * 0.67, y: lastPt.y + (world.y - lastPt.y) * 0.67 },
        world,
      ]
      const newPath: BezierPath = {
        ...activeSp.path,
        segments: [...segs, newSeg],
      }
      useStore.getState().updatePath(activeSp.id, { path: newPath })
      pushHistory()
      return
    }

    // Select tool: hit test
    const hit = hitTestPath(sourcePaths, world, activePathId, 10 / viewport.scale)
    if (hit) {
      if (hit.pathId !== activePathId) setActivePath(hit.pathId)
      dragRef.current = hit
      e.preventDefault()
    } else {
      setActivePath(null)
    }
  }, [activeTool, toWorld, sourcePaths, activePathId, addPath, pushHistory, setActivePath, viewport.scale])

  const onMouseMove = useCallback((e: MouseEvent) => {
    const world = toWorld(e)
    if (activeTool === 'draw') {
      setDrawPreview(world)
      return
    }
    if (!dragRef.current) return
    const hit = dragRef.current
    movePoint(hit.pathId, hit.segIndex, hit.pointIndex, world)
  }, [activeTool, toWorld, movePoint])

  const onMouseUp = useCallback(() => {
    if (dragRef.current) {
      pushHistory()
      dragRef.current = null
    }
  }, [pushHistory])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  const activeSp = sourcePaths.find(p => p.id === activePathId)

  return (
    <>
      {/* Draw preview line */}
      {activeTool === 'draw' && drawPreview && activeSp && activeSp.path.segments.length > 0 && (() => {
        const lastSeg = activeSp.path.segments[activeSp.path.segments.length - 1]
        const lastPt = lastSeg[3]
        return (
          <line
            x1={lastPt.x} y1={lastPt.y}
            x2={drawPreview.x} y2={drawPreview.y}
            stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 3" opacity="0.6"
          />
        )
      })()}

      {/* Edit handles for active path */}
      {activeSp && sourcePaths.filter(sp => sp.id === activePathId).map(sp =>
        sp.path.segments.map((seg, si) => (
          <g key={`handles_${si}`} style={{ pointerEvents: 'none' }}>
            {/* Control point lines */}
            <line x1={seg[0].x} y1={seg[0].y} x2={seg[1].x} y2={seg[1].y}
              stroke="#4f8ef7" strokeWidth="0.75" opacity="0.6" />
            <line x1={seg[3].x} y1={seg[3].y} x2={seg[2].x} y2={seg[2].y}
              stroke="#4f8ef7" strokeWidth="0.75" opacity="0.6" />
            {/* CP1 */}
            <circle cx={seg[1].x} cy={seg[1].y} r={CP_R}
              fill="#1d4ed8" stroke="#93c5fd" strokeWidth="1" />
            {/* CP2 */}
            <circle cx={seg[2].x} cy={seg[2].y} r={CP_R}
              fill="#1d4ed8" stroke="#93c5fd" strokeWidth="1" />
            {/* Anchor at seg[0] */}
            <rect
              x={seg[0].x - ANCHOR_R} y={seg[0].y - ANCHOR_R}
              width={ANCHOR_R*2} height={ANCHOR_R*2}
              fill="#f59e0b" stroke="#fff" strokeWidth="1"
              rx="1"
            />
            {/* Last anchor at seg[3] only on last segment */}
            {si === sp.path.segments.length - 1 && (
              <rect
                x={seg[3].x - ANCHOR_R} y={seg[3].y - ANCHOR_R}
                width={ANCHOR_R*2} height={ANCHOR_R*2}
                fill="#f59e0b" stroke="#fff" strokeWidth="1"
                rx="1"
              />
            )}
          </g>
        ))
      )}

      {/* Anchor dots for non-active paths */}
      {sourcePaths.filter(sp => sp.id !== activePathId).map(sp =>
        sp.path.segments.map((seg, si) => (
          <g key={`dot_${sp.id}_${si}`}>
            <circle cx={seg[0].x} cy={seg[0].y} r={3}
              fill="#6b7280" stroke="#9ca3af" strokeWidth="0.5"
              style={{ cursor: 'pointer' }}
              onClick={() => setActivePath(sp.id)}
            />
          </g>
        ))
      )}

      {/* Hit area overlay — rendered last so it sits on top and captures all mouse events */}
      <rect
        x={0} y={0} width={canvasW} height={canvasH}
        fill="transparent"
        onMouseDown={(e: React.MouseEvent<SVGRectElement>) => onMouseDown(e as unknown as React.MouseEvent<SVGSVGElement>)}
        style={{ cursor: activeTool === 'draw' ? 'crosshair' : 'default' }}
      />
    </>
  )
}
