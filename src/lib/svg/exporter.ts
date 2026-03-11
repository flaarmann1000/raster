import { SourcePath, PixelMap, AppState } from '../types'
import { pathToSVGd } from '../geometry/bezier'
import { generateOffsetLines } from '../geometry/offset'
import { smoothPath } from '../geometry/smooth'
import { samplePath } from '../geometry/bezier'
import { makePill } from '../geometry/pill'
import { evalParam } from '../maps/params'
import { v } from '../geometry/vec2'

export function exportSVG(state: AppState, includeGuides = false): string {
  const { sourcePaths, pixelMaps, canvasSize } = state
  const { width, height } = canvasSize

  const mapLookup = (id: string) => pixelMaps.find(m => m.id === id)

  const pillGroups: string[] = []
  const guideLines: string[] = []

  for (const sp of sourcePaths) {
    if (!sp.visible) continue

    const { offsetSettings, pillSettings, smoothingSettings } = sp
    let centerPath = sp.path

    // Non-destructive smoothing
    if (smoothingSettings.enabled) {
      const evalAt = (wx: number, wy: number) => evalParam(smoothingSettings.radius, wx, wy, width, height, mapLookup)
      // Use center of canvas for a representative smoothing radius
      const r = evalAt(width / 2, height / 2)
      centerPath = smoothPath(centerPath, r)
    }

    // Guide lines
    if (includeGuides) {
      guideLines.push(`<path d="${pathToSVGd(centerPath)}" stroke="#ff6600" stroke-width="1" fill="none" opacity="0.6"/>`)
    }

    // Evaluate offset settings at canvas center (static evaluation for count/global params)
    const evalC = (param: typeof offsetSettings.count) =>
      evalParam(param, width/2, height/2, width, height, mapLookup)

    const count = Math.round(Math.max(0, evalC(offsetSettings.count)))
    const baseDistance = Math.max(0, evalC(offsetSettings.baseDistance))
    const growth = evalC(offsetSettings.growth)

    // Generate offset lines
    const offsets = generateOffsetLines(centerPath, count, baseDistance, growth, offsetSettings.symmetric)

    // For each offset line, place pills
    const pathPills: string[] = []

    for (const ol of offsets) {
      const distanceFromCenter = Math.abs(ol.distance)
      const offsetFraction = count > 0 ? distanceFromCenter / (count * baseDistance || 1) : 0

      if (includeGuides) {
        guideLines.push(`<path d="${pathToSVGd(ol.path)}" stroke="#0099ff" stroke-width="0.5" fill="none" opacity="0.4"/>`)
      }

      // Evaluate pill params at a representative point (mid-path)
      // For per-pill evaluation we sample at each pill position
      const evalAtPos = (param: typeof pillSettings.length, wx: number, wy: number) =>
        evalParam(param, wx, wy, width, height, mapLookup)

      // Get spacing for this offset line (account for falloff)
      const baseSpacing = evalAtPos(pillSettings.spacing, width/2, height/2)
      const spacingFalloff = evalAtPos(pillSettings.spacingFalloff, width/2, height/2)
      const spacing = Math.max(1, baseSpacing + spacingFalloff * offsetFraction)

      const samples = samplePath(ol.path, spacing)

      for (const sample of samples) {
        const { pos } = sample

        // Evaluate length with falloff
        const baseLen = evalAtPos(pillSettings.length, pos.x, pos.y)
        const lenFalloff = evalAtPos(pillSettings.lengthFalloff, pos.x, pos.y)
        const pillLen = Math.max(0.5, baseLen - lenFalloff * distanceFromCenter)

        // Evaluate thickness with falloff
        const baseThick = evalAtPos(pillSettings.thickness, pos.x, pos.y)
        const thickFalloff = evalAtPos(pillSettings.thicknessFalloff, pos.x, pos.y)
        const pillThick = Math.max(0.5, baseThick - thickFalloff * distanceFromCenter)

        const pill = makePill(pos, sample.tangent, pillLen, pillThick)

        let pillSVG = ''
        const style = pillSettings.style
        if (style === 'fill' || style === 'both') {
          pillSVG += `<path d="${pill.d}" fill="${pillSettings.fillColor}"`
          if (style === 'both') pillSVG += ` stroke="${pillSettings.strokeColor}" stroke-width="${pillSettings.strokeWidth}"`
          pillSVG += `/>`
        } else {
          pillSVG = `<path d="${pill.d}" fill="none" stroke="${pillSettings.strokeColor}" stroke-width="${pillSettings.strokeWidth}"/>`
        }
        pathPills.push(pillSVG)
      }
    }

    if (pathPills.length > 0) {
      pillGroups.push(`<g id="pills_${sp.id}">\n${pathPills.join('\n')}\n</g>`)
    }
  }

  const guideGroup = guideLines.length > 0
    ? `<g id="guides" opacity="0.7">\n${guideLines.join('\n')}\n</g>\n`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${guideGroup}<g id="pills">
${pillGroups.join('\n')}
</g>
</svg>`
}
