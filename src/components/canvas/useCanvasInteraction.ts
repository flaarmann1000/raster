'use client'
import { useStore } from '@/store/useStore'
import { Vec2 } from '@/lib/types'

export interface CanvasPoint { x: number; y: number }

/** Convert a mouse event to SVG world coordinates.
 *  getBoundingClientRect() already accounts for the CSS translate,
 *  so we only divide by scale. */
export function clientToWorld(
  e: { clientX: number; clientY: number },
  svgEl: SVGSVGElement,
  viewport: { x: number; y: number; scale: number }
): Vec2 {
  const rect = svgEl.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left) / viewport.scale,
    y: (e.clientY - rect.top)  / viewport.scale,
  }
}

/**
 * pointIndex maps directly to the CubicSegment tuple:
 *   0 = start anchor, 1 = cp1, 2 = cp2, 3 = end anchor (last seg only)
 */
export interface HitResult {
  pathId: string
  segIndex: number
  pointIndex: 0 | 1 | 2 | 3
  dist: number
}

export function hitTestPath(
  paths: ReturnType<typeof useStore.getState>['sourcePaths'],
  world: Vec2,
  activePathId: string | null,
  hitRadius = 8
): HitResult | null {
  let best: HitResult | null = null

  for (const sp of paths) {
    for (let si = 0; si < sp.path.segments.length; si++) {
      const seg = sp.path.segments[si]
      const isActive = sp.id === activePathId

      const test = (ptIdx: 0 | 1 | 2 | 3, pt: Vec2) => {
        const d = Math.hypot(world.x - pt.x, world.y - pt.y)
        if (d < hitRadius && (!best || d < best.dist)) {
          best = { pathId: sp.id, segIndex: si, pointIndex: ptIdx, dist: d }
        }
      }

      test(0, seg[0])              // start anchor — all paths
      if (isActive) {
        test(1, seg[1])            // cp1
        test(2, seg[2])            // cp2
      }
      if (si === sp.path.segments.length - 1) {
        test(3, seg[3])            // end anchor of last segment
      }
    }
  }

  return best
}
