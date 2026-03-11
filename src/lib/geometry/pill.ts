import { Vec2, CubicSegment } from '../types'
import { v } from './vec2'

export interface PillShape {
  // SVG path d string
  d: string
  center: Vec2
  tangent: Vec2
  length: number
  thickness: number
}

/**
 * Generate a pill (stadium/rounded rectangle) shape centered at `center`,
 * oriented along `tangent`, with given length and thickness.
 * Returns an SVG path d string.
 */
export function makePill(
  center: Vec2,
  tangent: Vec2,
  length: number,
  thickness: number
): PillShape {
  const len = Math.max(length, 0.1)
  const thick = Math.max(thickness, 0.1)
  const halfL = len / 2
  const halfT = thick / 2
  const r = halfT  // cap radius = half thickness

  // Pill is drawn in local space, then rotated
  const angle = Math.atan2(tangent.y, tangent.x)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  const transform = (lx: number, ly: number): Vec2 => ({
    x: center.x + lx * cos - ly * sin,
    y: center.y + lx * sin + ly * cos,
  })

  // If length < thickness, fall back to circle
  if (len <= thick) {
    const cr = Math.max(len, thick) / 2
    return {
      d: `M ${(center.x + cr).toFixed(3)} ${center.y.toFixed(3)} A ${cr.toFixed(3)} ${cr.toFixed(3)} 0 1 1 ${(center.x - cr).toFixed(3)} ${center.y.toFixed(3)} A ${cr.toFixed(3)} ${cr.toFixed(3)} 0 1 1 ${(center.x + cr).toFixed(3)} ${center.y.toFixed(3)} Z`,
      center, tangent, length: len, thickness: thick,
    }
  }

  // Flat sides extent
  const fx = halfL - r

  // 4 arc anchors in local space
  const tl = transform(-fx, -halfT)   // top-left arc center
  const tr = transform(fx, -halfT)    // top-right arc center
  const br = transform(fx, halfT)     // bottom-right arc center
  const bl = transform(-fx, halfT)    // bottom-left arc center

  // Control points for semi-circular caps (cubic Bézier arc approximation k≈0.5523)
  const k = r * 0.5523
  const ax = (lx: number, ly: number) => transform(lx, ly)

  // Right cap
  const rc1 = transform(fx, -halfT)  // start of right cap top
  const rc2 = transform(fx, halfT)   // end of right cap bottom
  const lc1 = transform(-fx, halfT)  // start of left cap bottom
  const lc2 = transform(-fx, -halfT) // end of left cap top

  // Use SVG arc for clean caps
  const n = v.perp(tangent) // normal direction
  const rc = transform(halfL - r, 0)   // right cap center
  const lc = transform(-(halfL - r), 0) // left cap center

  const p = (pt: Vec2) => `${pt.x.toFixed(3)},${pt.y.toFixed(3)}`

  // Top-left to Top-right (top edge)
  const topStart = transform(-fx, -halfT)
  const topEnd   = transform(fx, -halfT)
  // Right cap
  const rightCapStart = topEnd
  const rightCapEnd   = transform(fx, halfT)
  // Bottom-right to bottom-left
  const botEnd        = transform(-fx, halfT)
  // Left cap
  const leftCapStart  = botEnd
  const leftCapEnd    = topStart

  const d = [
    `M ${p(topStart)}`,
    `L ${p(topEnd)}`,
    `A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${p(rightCapEnd)}`,
    `L ${p(botEnd)}`,
    `A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${p(leftCapEnd)}`,
    `Z`,
  ].join(' ')

  return { d, center, tangent, length: len, thickness: thick }
}

/**
 * Place pills evenly along a set of sampled points.
 * Returns array of PillShape objects.
 */
export interface PlacedPill {
  d: string
  center: Vec2
}

export function placePillsAlongSamples(
  samples: Array<{ pos: Vec2; tangent: Vec2; normal: Vec2; arcLength: number }>,
  length: number,
  thickness: number,
  spacing: number
): PlacedPill[] {
  if (samples.length === 0 || spacing < 0.1) return []
  const pills: PlacedPill[] = []

  for (const s of samples) {
    const pill = makePill(s.pos, s.tangent, length, thickness)
    pills.push({ d: pill.d, center: s.pos })
  }

  return pills
}
