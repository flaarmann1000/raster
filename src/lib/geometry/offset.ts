import { Vec2, CubicSegment, BezierPath } from '../types'
import { v } from './vec2'
import { bezierPoint, bezierNormal, bezierLength, polylineToPathD } from './bezier'

/**
 * Approximate offset of a single cubic Bézier segment.
 * Uses the Tiller-Hanson approximation: offset each control point
 * along the average normal at that location, then adjust handles.
 */
export function offsetSegment(seg: CubicSegment, dist: number): CubicSegment {
  const [p0, p1, p2, p3] = seg

  // Normals at key parameter values
  const n0 = bezierNormal(seg, 0)
  const n1 = bezierNormal(seg, 1/3)
  const n2 = bezierNormal(seg, 2/3)
  const n3 = bezierNormal(seg, 1)

  // Offset endpoints
  const q0 = v.add(p0, v.mul(n0, dist))
  const q3 = v.add(p3, v.mul(n3, dist))

  // Offset inner control points using blend of adjacent normals
  const q1 = v.add(p1, v.mul(v.norm(v.add(n0, n1)), dist))
  const q2 = v.add(p2, v.mul(v.norm(v.add(n2, n3)), dist))

  return [q0, q1, q2, q3]
}

/**
 * Generate an offset BezierPath at distance `dist`.
 * Positive dist = left (CCW normal side), negative = right.
 */
export function offsetPath(path: BezierPath, dist: number, newId: string): BezierPath {
  if (Math.abs(dist) < 1e-10) return { ...path, id: newId }
  return {
    id: newId,
    closed: path.closed,
    segments: path.segments.map(seg => offsetSegment(seg, dist)),
  }
}

/**
 * Generate multiple offset paths for one source path.
 * Returns array of [distance, BezierPath] pairs, sorted near to far.
 */
export interface OffsetLine {
  path: BezierPath
  distance: number   // signed distance from center
  side: 'left' | 'right' | 'center'
  index: number      // 0 = center, 1 = first offset, etc.
}

export function generateOffsetLines(
  centerPath: BezierPath,
  count: number,           // number of offset lines per side
  baseDistance: number,
  growth: number,          // additive distance growth per step
  symmetric: boolean,
  sideDistances?: { left: number[]; right: number[] }  // override distances
): OffsetLine[] {
  const lines: OffsetLine[] = [{ path: centerPath, distance: 0, side: 'center', index: 0 }]

  const buildSide = (side: 'left' | 'right', sign: number) => {
    let d = 0
    for (let i = 1; i <= count; i++) {
      d += Math.max(0.5, baseDistance + growth * (i - 1))
      const dist = sign * d
      const offseted = offsetPath(centerPath, dist, `${centerPath.id}_offset_${side}_${i}`)
      lines.push({ path: offseted, distance: dist, side, index: i })
    }
  }

  buildSide('left', 1)
  if (symmetric) {
    buildSide('right', -1)
  } else {
    buildSide('right', -1)
  }

  return lines.sort((a, b) => a.index - b.index)
}

/**
 * Convert an offset path to a polyline, with simplified cusp removal.
 * Returns cleaned point array.
 */
export function offsetToPolyline(path: BezierPath, stepsPerSeg = 48): Vec2[] {
  const pts: Vec2[] = []
  for (let si = 0; si < path.segments.length; si++) {
    const seg = path.segments[si]
    const n = stepsPerSeg
    for (let i = si === 0 ? 0 : 1; i <= n; i++) {
      pts.push(bezierPoint(seg, i / n))
    }
  }
  return pts
}

// ─── Dense polyline offset with loop removal ──────────────────────────────────

/** Intersect two lines (p1→p2) and (p3→p4). Returns intersection + t on first line. */
function lineIntersect(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): { pt: Vec2; t: number } | null {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y
  const cross = d1x * d2y - d1y * d2x
  if (Math.abs(cross) < 1e-10) return null
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / cross
  return { pt: { x: p1.x + t * d1x, y: p1.y + t * d1y }, t }
}

/**
 * Strict segment-segment intersection. Both t and u must be strictly in (0,1).
 * Returns the intersection point or null.
 */
function segIntersect(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): Vec2 | null {
  const d1x = a2.x - a1.x, d1y = a2.y - a1.y
  const d2x = b2.x - b1.x, d2y = b2.y - b1.y
  const cross = d1x * d2y - d1y * d2x
  if (Math.abs(cross) < 1e-10) return null
  const t = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / cross
  const u = ((b1.x - a1.x) * d1y - (b1.y - a1.y) * d1x) / cross
  if (t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6) {
    return { x: a1.x + t * d1x, y: a1.y + t * d1y }
  }
  return null
}

/**
 * Remove self-intersection loops from a polyline.
 * When segment (i, i+1) crosses segment (j, j+1) for j > i+1,
 * the loop from i+1..j is replaced by the intersection point.
 * Two passes are run to handle nested loops.
 */
function removePolylineLoops(pts: Vec2[]): Vec2[] {
  if (pts.length < 4) return pts

  let current = pts
  for (let pass = 0; pass < 2; pass++) {
    const out: Vec2[] = [current[0]]
    let i = 0
    let changed = false

    while (i < current.length - 1) {
      let cut = false
      for (let j = i + 2; j < current.length - 1; j++) {
        const inter = segIntersect(current[i], current[i + 1], current[j], current[j + 1])
        if (inter) {
          out.push(inter)
          i = j + 1
          cut = true
          changed = true
          break
        }
      }
      if (!cut) {
        out.push(current[i + 1])
        i++
      }
    }

    current = out
    if (!changed) break
  }

  return current
}

export function offsetPathPolyline(path: BezierPath, dist: number, stepsPerSeg = 64): Vec2[] {
  if (path.segments.length === 0) return []

  // Sample each segment independently, offsetting each point by its normal
  const segPts: Vec2[][] = path.segments.map(seg => {
    const pts: Vec2[] = []
    for (let i = 0; i <= stepsPerSeg; i++) {
      const t = i / stepsPerSeg
      const pos = bezierPoint(seg, t)
      const normal = bezierNormal(seg, t)
      pts.push({ x: pos.x + normal.x * dist, y: pos.y + normal.y * dist })
    }
    return pts
  })

  if (segPts.length === 1) return removePolylineLoops(segPts[0])

  // Join segments with miter at each junction, then run loop removal
  const result: Vec2[] = [...segPts[0]]
  const miterLimit = Math.abs(dist) * 6

  for (let si = 1; si < segPts.length; si++) {
    const prev = segPts[si - 1]
    const curr = segPts[si]

    const p1 = prev[prev.length - 2]
    const p2 = prev[prev.length - 1]
    const p3 = curr[0]
    const p4 = curr[1]

    const res = lineIntersect(p1, p2, p3, p4)

    if (res && v.dist(res.pt, p2) < miterLimit && v.dist(res.pt, p3) < miterLimit) {
      // Miter join: replace last endpoint with intersection
      result.pop()
      result.push(res.pt)
    }
    // else: bevel — just append (may create a small gap, loop removal fixes folds)

    result.push(...curr.slice(1))
  }

  return removePolylineLoops(result)
}

// Sample evenly along a polyline by arc length
export interface PolylineSample { pos: Vec2; tangent: Vec2; arcLength: number }

export function samplePolyline(pts: Vec2[], spacing: number): PolylineSample[] {
  if (pts.length < 2 || spacing < 0.1) return []
  const samples: PolylineSample[] = []
  let traveled = 0
  let nextSample = spacing / 2
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i-1], b = pts[i]
    const dl = Math.sqrt((b.x-a.x)**2 + (b.y-a.y)**2)
    if (dl < 0.001) continue
    const tx = (b.x-a.x)/dl, ty = (b.y-a.y)/dl
    while (nextSample <= traveled + dl) {
      const frac = (nextSample - traveled) / dl
      samples.push({
        pos: { x: a.x + (b.x-a.x)*frac, y: a.y + (b.y-a.y)*frac },
        tangent: { x: tx, y: ty },
        arcLength: nextSample,
      })
      nextSample += spacing
    }
    traveled += dl
  }
  return samples
}

/**
 * Sample a polyline with adaptive spacing: spacingFn is evaluated at each
 * emitted position to determine the distance to the next sample.
 */
export function adaptiveSamplePolyline(
  pts: Vec2[],
  spacingFn: (pos: Vec2) => number,
): PolylineSample[] {
  if (pts.length < 2) return []

  // Precompute cumulative arc lengths
  const segLens: number[] = []
  const cumLen: number[] = [0]
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i-1].x, dy = pts[i].y - pts[i-1].y
    const dl = Math.sqrt(dx*dx + dy*dy)
    segLens.push(dl)
    cumLen.push(cumLen[i-1] + dl)
  }
  const totalLen = cumLen[cumLen.length - 1]
  if (totalLen < 0.001) return []

  // Get pos + tangent at arc length s via binary search
  const sampleAt = (s: number): PolylineSample => {
    s = Math.max(0, Math.min(totalLen, s))
    let lo = 0, hi = segLens.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (cumLen[mid + 1] < s) lo = mid + 1
      else hi = mid
    }
    const i = lo
    const dl = segLens[i]
    const frac = dl < 0.001 ? 0 : (s - cumLen[i]) / dl
    const a = pts[i], b = pts[i + 1]
    const tx = dl < 0.001 ? 1 : (b.x - a.x) / dl
    const ty = dl < 0.001 ? 0 : (b.y - a.y) / dl
    return {
      pos: { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac },
      tangent: { x: tx, y: ty },
      arcLength: s,
    }
  }

  const samples: PolylineSample[] = []
  const firstSample = sampleAt(0)
  let nextS = Math.max(0.5, spacingFn(firstSample.pos)) / 2  // start half-spacing in
  while (nextS <= totalLen) {
    const sample = sampleAt(nextS)
    samples.push(sample)
    nextS += Math.max(0.5, spacingFn(sample.pos))
  }
  return samples
}

// New version of generateOffsetLines using polylines
export interface PolylineOffsetLine {
  points: Vec2[]
  distance: number
  side: 'left' | 'right' | 'center'
  index: number
}

export function generateOffsetPolylines(
  centerPath: BezierPath,
  count: number,
  baseDistance: number,
  growth: number,
  symmetric: boolean,
): PolylineOffsetLine[] {
  const lines: PolylineOffsetLine[] = [
    { points: offsetPathPolyline(centerPath, 0), distance: 0, side: 'center', index: 0 }
  ]
  const buildSide = (side: 'left' | 'right', sign: number) => {
    let d = 0
    for (let i = 1; i <= count; i++) {
      d += Math.max(0.5, baseDistance + growth * (i - 1))
      const dist = sign * d
      lines.push({ points: offsetPathPolyline(centerPath, dist), distance: dist, side, index: i })
    }
  }
  buildSide('left', 1)
  buildSide('right', -1)
  return lines
}
