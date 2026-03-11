import { Vec2, CubicSegment, BezierPath } from '../types'
import { v } from './vec2'
import { bezierTangent } from './bezier'

/**
 * Non-destructive corner smoothing.
 * Converts a BezierPath's sharp corners (where adjacent segments meet at an angle)
 * into rounded transitions by inserting arc-approximating curves.
 * Returns a new BezierPath with smoothed corners.
 */
export function smoothPath(path: BezierPath, radius: number): BezierPath {
  if (radius < 1e-4 || path.segments.length === 0) return path

  const result: CubicSegment[] = []
  const numSegs = path.segments.length

  for (let si = 0; si < numSegs; si++) {
    const seg = path.segments[si]
    const [p0, cp1, cp2, p3] = seg

    const isLast = si === numSegs - 1
    if (isLast && !path.closed) {
      result.push(seg)
      continue
    }

    const nextSeg = path.segments[(si + 1) % numSegs]

    // Use proper bezier tangents instead of approximating from control points
    const outTangentRaw = bezierTangent(seg, 1)
    const outDir = v.len(outTangentRaw) > 1e-6
      ? v.norm(outTangentRaw)
      : v.norm(v.sub(p3, cp2))

    const inTangentRaw = bezierTangent(nextSeg, 0)
    const inDir = v.len(inTangentRaw) > 1e-6
      ? v.norm(inTangentRaw)
      : v.norm(v.sub(nextSeg[1], nextSeg[0]))

    const dot = v.dot(outDir, inDir)
    // If nearly collinear (< ~8° bend), no smoothing needed
    if (dot > 0.99) {
      result.push(seg)
      continue
    }

    // Clamp radius to half the shorter segment length
    const seg1Len = v.dist(p0, p3)
    const seg2Len = v.dist(nextSeg[0], nextSeg[3])
    const r = Math.min(radius, seg1Len * 0.45, seg2Len * 0.45)
    if (r < 0.1) {
      result.push(seg)
      continue
    }

    // Move trim point back along the curve from p3 by r (in the backward tangent direction)
    const backDir = { x: -outDir.x, y: -outDir.y }
    const trimPt1 = v.add(p3, v.mul(backDir, r))

    // Move trim point forward along next curve from nextSeg[0] by r
    const trimPt2 = v.add(nextSeg[0], v.mul(inDir, r))

    // Adjust current segment to end at trimPt1
    // Blend cp2 toward the new endpoint to preserve curve shape
    const t1 = r / Math.max(seg1Len, 0.001)
    const newCp2 = v.lerp(cp2, trimPt1, Math.min(t1, 0.9))
    const trimmedSeg: CubicSegment = [p0, cp1, newCp2, trimPt1]
    result.push(trimmedSeg)

    // Insert arc segment between trimPt1 and trimPt2
    // k ≈ arcLen / 3 gives a good cubic Bézier arc approximation
    const arcLen = v.dist(trimPt1, trimPt2)
    const k = arcLen / 3
    const arcSeg: CubicSegment = [
      trimPt1,
      v.add(trimPt1, v.mul(outDir, k)),
      v.add(trimPt2, { x: -inDir.x * k, y: -inDir.y * k }),
      trimPt2,
    ]
    result.push(arcSeg)

    // Adjust next segment to start from trimPt2
    const t2 = r / Math.max(seg2Len, 0.001)
    const newNextCp1 = v.lerp(nextSeg[1], trimPt2, Math.min(t2, 0.9))
    path = {
      ...path,
      segments: path.segments.map((s, i) =>
        i === si + 1 ? [trimPt2, newNextCp1, s[2], s[3]] as CubicSegment : s
      )
    }
  }

  return { ...path, segments: result }
}
