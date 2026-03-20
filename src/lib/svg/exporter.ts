import { SourcePath, PixelMap, AppState } from '../types'
import { pathToSVGd, polylineToPathD } from '../geometry/bezier'
import { generateOffsetPolylines, adaptiveSamplePolyline } from '../geometry/offset'
import { smoothPath } from '../geometry/smooth'
import { makePill } from '../geometry/pill'
import { evalParam } from '../maps/params'

export function exportSVG(state: AppState, includeGuides = false): string {
  const { sourcePaths, pixelMaps, canvasSize, backgroundColor } = state
  const { width, height } = canvasSize

  const mapLookup = (id: string) => pixelMaps.find(m => m.id === id)

  const pillGroups: string[] = []
  const guideLines: string[] = []

  for (const sp of sourcePaths) {
    if (!sp.visible) continue

    const { offsetSettings, pillSettings, smoothingSettings } = sp

    const evalAt = (param: typeof pillSettings.length, wx: number, wy: number) =>
      evalParam(param, wx, wy, width, height, mapLookup)

    // Non-destructive smoothing
    let centerPath = sp.path
    if (smoothingSettings.enabled) {
      const r = evalAt(smoothingSettings.radius, width / 2, height / 2)
      centerPath = smoothPath(centerPath, r)
    }

    if (includeGuides) {
      guideLines.push(`<path d="${pathToSVGd(centerPath)}" stroke="#ff6600" stroke-width="1" fill="none" opacity="0.6"/>`)
    }

    // Evaluate global offset params at canvas center
    const count = Math.round(Math.max(0, evalAt(offsetSettings.count, width/2, height/2)))
    const baseDistance = evalAt(offsetSettings.baseDistance, width/2, height/2)
    const growth = evalAt(offsetSettings.growth, width/2, height/2)

    // Use same polyline pipeline as the render engine (includes loop removal)
    const offsets = generateOffsetPolylines(centerPath, count, baseDistance, growth, offsetSettings.symmetric)

    const pathPills: string[] = []

    for (const ol of offsets) {
      const distFromCenter = Math.abs(ol.distance)

      if (includeGuides && ol.side !== 'center') {
        guideLines.push(`<path d="${polylineToPathD(ol.points, false)}" stroke="#0099ff" stroke-width="0.5" fill="none" opacity="0.4"/>`)
      }

      const spacingFalloff = evalAt(pillSettings.spacingFalloff, width/2, height/2)

      // Adaptive sampling — identical to RenderEngine
      const samples = adaptiveSamplePolyline(ol.points, (pos) => {
        const baseSpacing = evalAt(pillSettings.spacing, pos.x, pos.y)
        return Math.max(1, baseSpacing + spacingFalloff * (distFromCenter / Math.max(Math.abs(baseDistance), 1)))
      })

      for (const sample of samples) {
        const { pos } = sample

        const pillLen = Math.max(0.5,
          evalAt(pillSettings.length, pos.x, pos.y) -
          evalAt(pillSettings.lengthFalloff, pos.x, pos.y) * distFromCenter
        )
        const pillThick = Math.max(0.5,
          evalAt(pillSettings.thickness, pos.x, pos.y) -
          evalAt(pillSettings.thicknessFalloff, pos.x, pos.y) * distFromCenter
        )

        const pill = makePill(pos, sample.tangent, pillLen, pillThick)
        const style = pillSettings.style

        let pillSVG: string
        if (style === 'stroke') {
          pillSVG = `<path d="${pill.d}" fill="none" stroke="${pillSettings.strokeColor}" stroke-width="${pillSettings.strokeWidth}"/>`
        } else if (style === 'both') {
          pillSVG = `<path d="${pill.d}" fill="${pillSettings.fillColor}" stroke="${pillSettings.strokeColor}" stroke-width="${pillSettings.strokeWidth}"/>`
        } else {
          pillSVG = `<path d="${pill.d}" fill="${pillSettings.fillColor}"/>`
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
<rect width="${width}" height="${height}" fill="${backgroundColor}"/>
${guideGroup}<g id="pills">
${pillGroups.join('\n')}
</g>
</svg>`
}
