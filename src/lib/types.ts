// ─── Primitives ────────────────────────────────────────────────────────────────
export interface Vec2 { x: number; y: number }

export type CubicSegment = [Vec2, Vec2, Vec2, Vec2] // P0 CP1 CP2 P3

export interface BezierPath {
  id: string
  segments: CubicSegment[]
  closed: boolean
}

// ─── Parameter value (static or map-driven) ───────────────────────────────────
export type MapBlendMode = 'add' | 'multiply' | 'override'

export interface MappedParam {
  mode: 'static' | 'map' | 'combined'
  value: number                // static value (or base for combined)
  mapId: string | null         // which pixel map to use
  amplification: number        // map value × this
  invert: boolean
  blendMode: MapBlendMode
  min: number
  max: number
}

export function defaultParam(value: number): MappedParam {
  return { mode: 'static', value, mapId: null, amplification: 1, invert: false, blendMode: 'add', min: 0, max: 9999 }
}

// ─── Offset settings ──────────────────────────────────────────────────────────
export interface OffsetSettings {
  count: MappedParam          // number of offset lines per side
  baseDistance: MappedParam   // base offset distance
  growth: MappedParam         // distance growth per step
  symmetric: boolean
}

// ─── Pill settings ────────────────────────────────────────────────────────────
export type PillStyle = 'fill' | 'stroke' | 'both'

export interface PillSettings {
  length: MappedParam
  thickness: MappedParam
  spacing: MappedParam
  style: PillStyle
  fillColor: string
  strokeColor: string
  strokeWidth: number
  // falloff by distance from center line
  lengthFalloff: MappedParam   // 0=none, >0=decay further out
  thicknessFalloff: MappedParam
  spacingFalloff: MappedParam
}

// ─── Smoothing settings ───────────────────────────────────────────────────────
export interface SmoothingSettings {
  enabled: boolean
  radius: MappedParam
}

// ─── Source path (one source line) ───────────────────────────────────────────
export interface SourcePath {
  id: string
  path: BezierPath
  visible: boolean
  label: string
  offsetSettings: OffsetSettings
  pillSettings: PillSettings
  smoothingSettings: SmoothingSettings
}

// ─── Pixel map ────────────────────────────────────────────────────────────────
export type MapLayerType = 'linear-gradient' | 'radial-gradient' | 'rect' | 'ellipse' | 'brush' | 'perlin-noise'

export interface MapLayer {
  id: string
  type: MapLayerType
  // gradient specific
  x0?: number; y0?: number; x1?: number; y1?: number
  cx?: number; cy?: number; radius?: number
  // shape specific
  x?: number; y?: number; width?: number; height?: number
  angle?: number
  // common
  color0?: number; color1?: number  // 0-1 grayscale values
  opacity: number
  blendMode: 'over' | 'add' | 'subtract' | 'multiply'
  blur: number
  visible: boolean
  // perlin noise specific
  noiseScale?: number
  noiseOctaves?: number
  noiseSeed?: number
}

export interface PixelMap {
  id: string
  label: string
  width: number
  height: number
  layers: MapLayer[]
  // cached rendered data (0-1 floats)
  data: Float32Array | null
  // for uploaded images
  imageDataUrl?: string
}

// ─── Canvas viewport ─────────────────────────────────────────────────────────
export interface Viewport {
  x: number; y: number  // pan offset
  scale: number
}

// ─── App view mode ───────────────────────────────────────────────────────────
export type ViewMode = 'guide' | 'map' | 'render' | 'combined'

export type ActiveTool = 'select' | 'draw' | 'pan'

// ─── App state ───────────────────────────────────────────────────────────────
export interface AppState {
  sourcePaths: SourcePath[]
  pixelMaps: PixelMap[]
  viewport: Viewport
  viewMode: ViewMode
  activeTool: ActiveTool
  activePathId: string | null
  activePointIndex: number | null
  activeMapId: string | null
  showGuides: boolean
  showOffsets: boolean
  canvasSize: { width: number; height: number }
  backgroundColor: string
  history: HistoryEntry[]
  historyIndex: number
}

export interface HistoryEntry {
  sourcePaths: SourcePath[]
  pixelMaps: PixelMap[]
}
