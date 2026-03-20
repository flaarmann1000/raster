import { MappedParam, PixelMap } from '../types'
import { sampleMap } from './renderer'

/**
 * Evaluate a MappedParam at a given world position.
 * mapLookup: function to find a PixelMap by id.
 */
export function evalParam(
  param: MappedParam,
  wx: number, wy: number,
  canvasW: number, canvasH: number,
  mapLookup: (id: string) => PixelMap | undefined
): number {
  let base = param.value

  if ((param.mode === 'map' || param.mode === 'combined') && param.mapId) {
    const map = mapLookup(param.mapId)
    if (map && map.data) {
      let sample = sampleMap(map.data, map.width, map.height, wx, wy, canvasW, canvasH, map.fit, map.mapZoom, map.mapOffsetX, map.mapOffsetY)
      if (param.invert) sample = 1 - sample

      switch (param.blendMode) {
        case 'add':
          base = param.mode === 'map'
            ? sample * param.amplification
            : base + sample * param.amplification
          break
        case 'multiply':
          base = base * sample * param.amplification
          break
        case 'override':
          base = sample * param.amplification
          break
      }
    }
  }

  return Math.max(param.min, Math.min(param.max, base))
}
