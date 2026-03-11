import { PixelMap, MapLayer } from '../types'

/**
 * Render all layers of a PixelMap into a Float32Array of grayscale values [0,1].
 * Width × Height elements, row-major.
 */
export function renderMap(map: PixelMap): Float32Array {
  const { width, height, layers } = map
  const data = new Float32Array(width * height)

  for (const layer of layers) {
    if (!layer.visible) continue
    renderLayer(layer, data, width, height)
  }

  // Clamp to [0,1]
  for (let i = 0; i < data.length; i++) data[i] = Math.max(0, Math.min(1, data[i]))

  return data
}

function renderLayer(layer: MapLayer, data: Float32Array, w: number, h: number) {
  const tmp = new Float32Array(w * h)

  switch (layer.type) {
    case 'linear-gradient': renderLinearGradient(layer, tmp, w, h); break
    case 'radial-gradient': renderRadialGradient(layer, tmp, w, h); break
    case 'rect': renderRect(layer, tmp, w, h); break
    case 'ellipse': renderEllipse(layer, tmp, w, h); break
    case 'brush': renderBrush(layer, tmp, w, h); break
    case 'perlin-noise': renderPerlinNoise(layer, tmp, w, h); break
  }

  // Apply blur
  const blurred = layer.blur > 0 ? gaussianBlur(tmp, w, h, layer.blur) : tmp

  // Blend into data
  const op = layer.opacity
  for (let i = 0; i < data.length; i++) {
    const val = blurred[i] * op
    switch (layer.blendMode) {
      case 'over':     data[i] = data[i] * (1 - op) + blurred[i] * op; break
      case 'add':      data[i] += val; break
      case 'subtract': data[i] -= val; break
      case 'multiply': data[i] *= val; break
    }
  }
}

function renderLinearGradient(layer: MapLayer, data: Float32Array, w: number, h: number) {
  const x0 = (layer.x0 ?? 0) * w
  const y0 = (layer.y0 ?? 0) * h
  const x1 = (layer.x1 ?? 1) * w
  const y1 = (layer.y1 ?? 0) * h
  const c0 = layer.color0 ?? 0
  const c1 = layer.color1 ?? 1

  const dx = x1 - x0; const dy = y1 - y0
  const lenSq = dx*dx + dy*dy
  if (lenSq < 1e-10) return

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const t = Math.max(0, Math.min(1, ((px - x0)*dx + (py - y0)*dy) / lenSq))
      data[py * w + px] = c0 + (c1 - c0) * t
    }
  }
}

function renderRadialGradient(layer: MapLayer, data: Float32Array, w: number, h: number) {
  const cx = (layer.cx ?? 0.5) * w
  const cy = (layer.cy ?? 0.5) * h
  const r  = (layer.radius ?? 0.5) * Math.max(w, h)
  const c0 = layer.color0 ?? 1
  const c1 = layer.color1 ?? 0

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const dist = Math.sqrt((px - cx)**2 + (py - cy)**2)
      const t = Math.max(0, Math.min(1, dist / r))
      data[py * w + px] = c0 + (c1 - c0) * t
    }
  }
}

function renderRect(layer: MapLayer, data: Float32Array, w: number, h: number) {
  const rx = (layer.x ?? 0) * w; const ry = (layer.y ?? 0) * h
  const rw = (layer.width ?? 1) * w; const rh = (layer.height ?? 1) * h
  const val = layer.color0 ?? 1

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      if (px >= rx && px < rx + rw && py >= ry && py < ry + rh) {
        data[py * w + px] = val
      }
    }
  }
}

function renderEllipse(layer: MapLayer, data: Float32Array, w: number, h: number) {
  const cx = (layer.cx ?? 0.5) * w
  const cy = (layer.cy ?? 0.5) * h
  const rx = (layer.width ?? 0.5) * w / 2
  const ry = (layer.height ?? 0.5) * h / 2
  const val = layer.color0 ?? 1

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const nx = (px - cx) / rx; const ny = (py - cy) / ry
      if (nx*nx + ny*ny <= 1) data[py * w + px] = val
    }
  }
}

function renderBrush(_layer: MapLayer, _data: Float32Array, _w: number, _h: number) {
  // Brush strokes are stored as pixel data in the layer's cached data (set externally)
}

function renderPerlinNoise(layer: MapLayer, data: Float32Array, w: number, h: number) {
  const scale = layer.noiseScale ?? 4
  const octaves = Math.round(layer.noiseOctaves ?? 4)
  const seed = Math.round(layer.noiseSeed ?? 0)
  const c0 = layer.color0 ?? 0
  const c1 = layer.color1 ?? 1
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const nx = (px / w) * scale
      const ny = (py / h) * scale
      const v = fbm(nx, ny, octaves, seed)
      data[py * w + px] = c0 + (c1 - c0) * v
    }
  }
}

function hash2D(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 2246822519)) >>> 0
  h ^= h >>> 13; h = Math.imul(h, 1540483477) >>> 0; h ^= h >>> 15
  return (h >>> 0) / 0xffffffff
}

function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const ux = fx*fx*(3-2*fx), uy = fy*fy*(3-2*fy)
  return hash2D(ix,iy,seed)*(1-ux)*(1-uy) + hash2D(ix+1,iy,seed)*ux*(1-uy)
       + hash2D(ix,iy+1,seed)*(1-ux)*uy  + hash2D(ix+1,iy+1,seed)*ux*uy
}

function fbm(x: number, y: number, octaves: number, seed: number): number {
  let vv = 0, a = 1, f = 1, t = 0
  for (let i = 0; i < octaves; i++) {
    vv += smoothNoise(x*f, y*f, seed+i*71) * a; t += a; a *= 0.5; f *= 2
  }
  return vv / t
}

/** Simple box blur approximating Gaussian */
function gaussianBlur(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const radius = Math.ceil(sigma * 2)
  if (radius < 1) return src

  const tmp = new Float32Array(src.length)
  const dst = new Float32Array(src.length)

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0, count = 0
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx
        if (nx >= 0 && nx < w) { sum += src[y * w + nx]; count++ }
      }
      tmp[y * w + x] = sum / count
    }
  }

  // Vertical pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0, count = 0
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy
        if (ny >= 0 && ny < h) { sum += tmp[ny * w + x]; count++ }
      }
      dst[y * w + x] = sum / count
    }
  }

  return dst
}

/**
 * Sample a pixel map at world coordinate (wx, wy), given canvas bounds.
 * Returns [0,1] float.
 */
export function sampleMap(
  mapData: Float32Array | null,
  mapW: number, mapH: number,
  wx: number, wy: number,
  canvasW: number, canvasH: number
): number {
  if (!mapData || mapData.length === 0) return 0

  const u = wx / canvasW
  const vv = wy / canvasH
  const px = Math.max(0, Math.min(mapW - 1, Math.floor(u * mapW)))
  const py = Math.max(0, Math.min(mapH - 1, Math.floor(vv * mapH)))
  return mapData[py * mapW + px]
}
