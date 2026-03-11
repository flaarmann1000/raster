import { BezierPath, CubicSegment, Vec2 } from '../types'
import { v } from '../geometry/vec2'

let idCounter = 0
const uid = () => `path_${++idCounter}_${Date.now()}`

/**
 * Parse an SVG string and extract all path/line/polyline elements
 * as BezierPath objects.
 */
export function parseSVGPaths(svgText: string): BezierPath[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgText, 'image/svg+xml')
  const paths: BezierPath[] = []

  // <path> elements
  doc.querySelectorAll('path').forEach(el => {
    const d = el.getAttribute('d')
    if (d) {
      const parsed = parsePathD(d)
      if (parsed) paths.push(parsed)
    }
  })

  // <line> elements
  doc.querySelectorAll('line').forEach(el => {
    const x1 = parseFloat(el.getAttribute('x1') || '0')
    const y1 = parseFloat(el.getAttribute('y1') || '0')
    const x2 = parseFloat(el.getAttribute('x2') || '0')
    const y2 = parseFloat(el.getAttribute('y2') || '0')
    paths.push(lineToBezierPath({ x: x1, y: y1 }, { x: x2, y: y2 }))
  })

  // <polyline> and <polygon>
  doc.querySelectorAll('polyline, polygon').forEach(el => {
    const pts = parsePointsAttr(el.getAttribute('points') || '')
    const closed = el.tagName === 'polygon'
    if (pts.length >= 2) paths.push(polylineToBezierPath(pts, closed))
  })

  return paths
}

export function lineToBezierPath(a: Vec2, b: Vec2): BezierPath {
  const cp1 = v.lerp(a, b, 1/3)
  const cp2 = v.lerp(a, b, 2/3)
  return { id: uid(), closed: false, segments: [[a, cp1, cp2, b]] }
}

export function polylineToBezierPath(pts: Vec2[], closed: boolean): BezierPath {
  const segments: CubicSegment[] = []
  const n = closed ? pts.length : pts.length - 1
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const cp1 = v.lerp(a, b, 1/3)
    const cp2 = v.lerp(a, b, 2/3)
    segments.push([a, cp1, cp2, b])
  }
  return { id: uid(), closed, segments }
}

function parsePointsAttr(attr: string): Vec2[] {
  const nums = attr.trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n))
  const pts: Vec2[] = []
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i+1] })
  return pts
}

/** Parse SVG path d attribute into a BezierPath */
export function parsePathD(d: string): BezierPath | null {
  const segments: CubicSegment[] = []
  let closed = false
  let cx = 0, cy = 0  // current point
  let startX = 0, startY = 0  // start of current subpath
  let lastCp2: Vec2 | null = null  // for S/s commands

  const tokens = tokenizeD(d)
  let i = 0

  const readNum = (): number => parseFloat(tokens[i++])
  const readVec = (): Vec2 => { const x = readNum(); const y = readNum(); return { x, y } }

  while (i < tokens.length) {
    const cmd = tokens[i++]
    if (!cmd || cmd.length !== 1) continue

    const isRel = cmd === cmd.toLowerCase() && cmd !== 'z' && cmd !== 'Z'

    const abs = (p: Vec2): Vec2 => isRel ? { x: cx + p.x, y: cy + p.y } : p
    const absX = (x: number): number => isRel ? cx + x : x
    const absY = (y: number): number => isRel ? cy + y : y

    switch (cmd.toUpperCase()) {
      case 'M': {
        let first = true
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const p = abs(readVec())
          if (first) { cx = p.x; cy = p.y; startX = cx; startY = cy; first = false }
          else {
            // Implicit L after first M
            const cp1 = { x: cx + (p.x - cx)/3, y: cy + (p.y - cy)/3 }
            const cp2 = { x: cx + 2*(p.x - cx)/3, y: cy + 2*(p.y - cy)/3 }
            segments.push([{ x: cx, y: cy }, cp1, cp2, p])
            cx = p.x; cy = p.y
          }
        }
        break
      }
      case 'L': {
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const p = abs(readVec())
          const cp1 = { x: cx + (p.x - cx)/3, y: cy + (p.y - cy)/3 }
          const cp2 = { x: cx + 2*(p.x - cx)/3, y: cy + 2*(p.y - cy)/3 }
          segments.push([{ x: cx, y: cy }, cp1, cp2, p])
          cx = p.x; cy = p.y; lastCp2 = null
        }
        break
      }
      case 'H': {
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const x = absX(readNum())
          const p = { x, y: cy }
          const cp1 = { x: cx + (p.x - cx)/3, y: cy }
          const cp2 = { x: cx + 2*(p.x - cx)/3, y: cy }
          segments.push([{ x: cx, y: cy }, cp1, cp2, p])
          cx = x; lastCp2 = null
        }
        break
      }
      case 'V': {
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const y = absY(readNum())
          const p = { x: cx, y }
          const cp1 = { x: cx, y: cy + (p.y - cy)/3 }
          const cp2 = { x: cx, y: cy + 2*(p.y - cy)/3 }
          segments.push([{ x: cx, y: cy }, cp1, cp2, p])
          cy = y; lastCp2 = null
        }
        break
      }
      case 'C': {
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const cp1 = abs(readVec())
          const cp2 = abs(readVec())
          const p = abs(readVec())
          segments.push([{ x: cx, y: cy }, cp1, cp2, p])
          lastCp2 = cp2; cx = p.x; cy = p.y
        }
        break
      }
      case 'S': {
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const cp1 = lastCp2 ? { x: 2*cx - lastCp2.x, y: 2*cy - lastCp2.y } : { x: cx, y: cy }
          const cp2 = abs(readVec())
          const p = abs(readVec())
          segments.push([{ x: cx, y: cy }, cp1, cp2, p])
          lastCp2 = cp2; cx = p.x; cy = p.y
        }
        break
      }
      case 'Q': {
        while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
          const qcp = abs(readVec())
          const p = abs(readVec())
          // Convert quadratic to cubic
          const cp1 = { x: cx + 2*(qcp.x - cx)/3, y: cy + 2*(qcp.y - cy)/3 }
          const cp2 = { x: p.x + 2*(qcp.x - p.x)/3, y: p.y + 2*(qcp.y - p.y)/3 }
          segments.push([{ x: cx, y: cy }, cp1, cp2, p])
          cx = p.x; cy = p.y; lastCp2 = null
        }
        break
      }
      case 'Z': {
        if (Math.abs(cx - startX) > 0.01 || Math.abs(cy - startY) > 0.01) {
          const p = { x: startX, y: startY }
          const cp1 = { x: cx + (p.x-cx)/3, y: cy + (p.y-cy)/3 }
          const cp2 = { x: cx + 2*(p.x-cx)/3, y: cy + 2*(p.y-cy)/3 }
          segments.push([{ x: cx, y: cy }, cp1, cp2, p])
        }
        closed = true; cx = startX; cy = startY; lastCp2 = null
        break
      }
    }
  }

  if (segments.length === 0) return null
  return { id: uid(), segments, closed }
}

function tokenizeD(d: string): string[] {
  return d
    .replace(/([MmLlHhVvCcSsQqTtAaZz])/g, ' $1 ')
    .replace(/([eE][+-]?\d+)/g, (m) => m)
    .replace(/-/g, ' -')
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
}
