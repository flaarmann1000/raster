import { Vec2, CubicSegment, BezierPath } from '../types'
import { v } from './vec2'

/** Evaluate cubic Bézier at t ∈ [0,1] */
export function bezierPoint(seg: CubicSegment, t: number): Vec2 {
  const [p0, p1, p2, p3] = seg
  const mt = 1 - t
  return {
    x: mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x,
    y: mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y,
  }
}

/** First derivative (tangent vector) */
export function bezierTangent(seg: CubicSegment, t: number): Vec2 {
  const [p0, p1, p2, p3] = seg
  const mt = 1 - t
  return {
    x: 3*(mt*mt*(p1.x-p0.x) + 2*mt*t*(p2.x-p1.x) + t*t*(p3.x-p2.x)),
    y: 3*(mt*mt*(p1.y-p0.y) + 2*mt*t*(p2.y-p1.y) + t*t*(p3.y-p2.y)),
  }
}

/** Unit normal (perpendicular to tangent, pointing left) */
export function bezierNormal(seg: CubicSegment, t: number): Vec2 {
  return v.perp(v.norm(bezierTangent(seg, t)))
}

/** Approximate arc length of segment using adaptive subdivision */
export function bezierLength(seg: CubicSegment, steps = 64): number {
  let len = 0
  let prev = bezierPoint(seg, 0)
  for (let i = 1; i <= steps; i++) {
    const cur = bezierPoint(seg, i / steps)
    len += v.dist(prev, cur)
    prev = cur
  }
  return len
}

/** Sample evenly-spaced points along a BezierPath by arc length */
export interface SampledPoint {
  pos: Vec2
  tangent: Vec2
  normal: Vec2
  t: number
  segIndex: number
  arcLength: number  // cumulative distance from start
}

export function samplePath(path: BezierPath, spacing: number): SampledPoint[] {
  if (path.segments.length === 0) return []

  // Build a lookup table: cumulative arc length for each segment
  const segLengths = path.segments.map(s => bezierLength(s))
  const totalLength = segLengths.reduce((a, b) => a + b, 0)
  if (totalLength < 1e-6 || spacing < 1e-6) return []

  const samples: SampledPoint[] = []
  let traveled = 0
  let nextSample = 0

  for (let si = 0; si < path.segments.length; si++) {
    const seg = path.segments[si]
    const segLen = segLengths[si]
    const steps = Math.max(64, Math.ceil(segLen / 2))

    let prevPos = bezierPoint(seg, 0)
    let prevT = 0
    let localLen = 0

    for (let step = 1; step <= steps; step++) {
      const t = step / steps
      const pos = bezierPoint(seg, t)
      const dl = v.dist(prevPos, pos)
      localLen += dl
      traveled += dl

      while (nextSample <= traveled) {
        // interpolate position
        const frac = dl > 1e-10 ? (nextSample - (traveled - dl)) / dl : 0
        const samplePos = v.lerp(prevPos, pos, frac)
        const sampleT = prevT + (t - prevT) * frac

        const tangent = v.norm(bezierTangent(seg, sampleT))
        const normal = v.perp(tangent)

        samples.push({ pos: samplePos, tangent, normal, t: sampleT, segIndex: si, arcLength: nextSample })
        nextSample += spacing
      }

      prevPos = pos
      prevT = t
    }
  }

  return samples
}

/** Get a point at a specific arc length along the path */
export function samplePathAtLength(path: BezierPath, targetLen: number): SampledPoint | null {
  if (path.segments.length === 0) return null
  let traveled = 0
  for (let si = 0; si < path.segments.length; si++) {
    const seg = path.segments[si]
    const segLen = bezierLength(seg)
    if (traveled + segLen >= targetLen || si === path.segments.length - 1) {
      const localTarget = targetLen - traveled
      const t = Math.max(0, Math.min(1, localTarget / segLen))
      const pos = bezierPoint(seg, t)
      const tangent = v.norm(bezierTangent(seg, t))
      const normal = v.perp(tangent)
      return { pos, tangent, normal, t, segIndex: si, arcLength: targetLen }
    }
    traveled += segLen
  }
  return null
}

/** Compute total arc length of a path */
export function pathLength(path: BezierPath): number {
  return path.segments.map(s => bezierLength(s)).reduce((a, b) => a + b, 0)
}

/** Split a BezierPath into a series of point-by-point polyline (for display) */
export function pathToPolyline(path: BezierPath, stepsPerSeg = 32): Vec2[] {
  const pts: Vec2[] = []
  for (let si = 0; si < path.segments.length; si++) {
    const seg = path.segments[si]
    const n = si === path.segments.length - 1 ? stepsPerSeg + 1 : stepsPerSeg
    for (let i = si === 0 ? 0 : 1; i < n; i++) {
      pts.push(bezierPoint(seg, i / stepsPerSeg))
    }
  }
  return pts
}

/** Convert polyline to SVG path d string */
export function polylineToPathD(pts: Vec2[], closed = false): string {
  if (pts.length === 0) return ''
  const parts = [`M ${pts[0].x} ${pts[0].y}`]
  for (let i = 1; i < pts.length; i++) parts.push(`L ${pts[i].x} ${pts[i].y}`)
  if (closed) parts.push('Z')
  return parts.join(' ')
}

/** Convert BezierPath to SVG path d string (exact cubic curves) */
export function pathToSVGd(path: BezierPath): string {
  if (path.segments.length === 0) return ''
  const segs = path.segments
  const parts = [`M ${segs[0][0].x.toFixed(3)} ${segs[0][0].y.toFixed(3)}`]
  for (const seg of segs) {
    parts.push(`C ${seg[1].x.toFixed(3)} ${seg[1].y.toFixed(3)} ${seg[2].x.toFixed(3)} ${seg[2].y.toFixed(3)} ${seg[3].x.toFixed(3)} ${seg[3].y.toFixed(3)}`)
  }
  if (path.closed) parts.push('Z')
  return parts.join(' ')
}
