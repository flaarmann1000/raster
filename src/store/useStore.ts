'use client'
import { create } from 'zustand'
import { AppState, SourcePath, PixelMap, BezierPath, CubicSegment,
  defaultParam, MappedParam, ViewMode, ActiveTool, Viewport, HistoryEntry, MapLayer } from '@/lib/types'
import { renderMap } from '@/lib/maps/renderer'

let _idCounter = 0
const uid = (prefix = 'id') => `${prefix}_${++_idCounter}_${Date.now()}`

function defaultPillSettings() {
  return {
    length: defaultParam(20),
    thickness: defaultParam(6),
    spacing: defaultParam(24),
    style: 'fill' as const,
    fillColor: '#ffffff',
    strokeColor: '#ffffff',
    strokeWidth: 1,
    lengthFalloff: { ...defaultParam(0), min: -1000 },
    thicknessFalloff: { ...defaultParam(0), min: -1000 },
    spacingFalloff: { ...defaultParam(0), min: -1000 },
  }
}

function defaultOffsetSettings() {
  return {
    count: { ...defaultParam(3), max: 20 },
    baseDistance: defaultParam(18),
    growth: { ...defaultParam(0), min: -1000 },
    symmetric: true,
  }
}

function defaultSmoothingSettings() {
  return { enabled: false, radius: defaultParam(20) }
}

export function createDefaultPath(points?: Array<{x:number,y:number}>): SourcePath {
  const pts = points ?? [
    { x: 100, y: 400 },
    { x: 300, y: 200 },
    { x: 500, y: 400 },
    { x: 700, y: 260 },
  ]
  const segments: CubicSegment[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i+1]
    segments.push([a, { x: a.x+(b.x-a.x)*0.33, y: a.y+(b.y-a.y)*0.33 }, { x: a.x+(b.x-a.x)*0.67, y: a.y+(b.y-a.y)*0.67 }, b])
  }
  const id = uid('sp')
  return {
    id,
    label: 'Path 1',
    visible: true,
    path: { id, segments, closed: false },
    offsetSettings: defaultOffsetSettings(),
    pillSettings: defaultPillSettings(),
    smoothingSettings: defaultSmoothingSettings(),
  }
}

interface StoreActions {
  addPath: (sp?: SourcePath) => void
  removePath: (id: string) => void
  updatePath: (id: string, update: Partial<SourcePath>) => void
  setActivePath: (id: string | null) => void
  setActivePoint: (index: number | null) => void
  movePoint: (pathId: string, segIndex: number, pointIndex: 0|1|2|3, pos: {x:number,y:number}) => void
  addMap: (map?: Partial<PixelMap>) => void
  removeMap: (id: string) => void
  updateMap: (id: string, update: Partial<PixelMap>) => void
  addMapLayer: (mapId: string, layer: Partial<MapLayer>) => void
  updateMapLayer: (mapId: string, layerId: string, update: Partial<MapLayer>) => void
  removeMapLayer: (mapId: string, layerId: string) => void
  reRenderMap: (mapId: string) => void
  setViewport: (vp: Partial<Viewport>) => void
  setViewMode: (m: ViewMode) => void
  setActiveTool: (t: ActiveTool) => void
  toggleGuides: () => void
  toggleOffsets: () => void
  pushHistory: () => void
  undo: () => void
  redo: () => void
  setCanvasSize: (w: number, h: number) => void
  setBackgroundColor: (c: string) => void
}

const initialPath = createDefaultPath()

const INITIAL_STATE: AppState = {
  sourcePaths: [initialPath],
  pixelMaps: [],
  viewport: { x: 0, y: 0, scale: 1 },
  viewMode: 'combined',
  activeTool: 'select',
  activePathId: initialPath.id,
  activePointIndex: null,
  activeMapId: null,
  showGuides: true,
  showOffsets: true,
  canvasSize: { width: 800, height: 800 },
  backgroundColor: '#111111',
  history: [],
  historyIndex: -1,
}

export const useStore = create<AppState & StoreActions>((set, get) => ({
  ...INITIAL_STATE,

  addPath: (sp) => {
    const newSp = sp ?? createDefaultPath()
    set(s => ({
      sourcePaths: [...s.sourcePaths, newSp],
      activePathId: newSp.id,
    }))
    get().pushHistory()
  },

  removePath: (id) => {
    set(s => ({
      sourcePaths: s.sourcePaths.filter(p => p.id !== id),
      activePathId: s.activePathId === id ? (s.sourcePaths.find(p => p.id !== id)?.id ?? null) : s.activePathId,
    }))
    get().pushHistory()
  },

  updatePath: (id, update) => {
    set(s => ({
      sourcePaths: s.sourcePaths.map(p => p.id === id ? { ...p, ...update } : p)
    }))
  },

  setActivePath: (id) => set({ activePathId: id, activePointIndex: null }),
  setActivePoint: (index) => set({ activePointIndex: index }),

  movePoint: (pathId, segIndex, pointIndex, pos) => {
    set(s => {
      const paths = s.sourcePaths.map(sp => {
        if (sp.id !== pathId) return sp
        const segs = sp.path.segments.map(seg => [...seg] as CubicSegment)
        const seg = segs[segIndex]

        if (pointIndex === 0) {
          // Start anchor: drag cp1 along, sync with previous segment's end
          const dx = pos.x - seg[0].x, dy = pos.y - seg[0].y
          seg[0] = pos
          seg[1] = { x: seg[1].x + dx, y: seg[1].y + dy }
          if (segIndex > 0) {
            const prev = segs[segIndex - 1]
            prev[3] = pos
            prev[2] = { x: prev[2].x + dx, y: prev[2].y + dy }
          }
        } else if (pointIndex === 3) {
          // End anchor of last segment: drag cp2 along, sync with next segment's start
          const dx = pos.x - seg[3].x, dy = pos.y - seg[3].y
          seg[3] = pos
          seg[2] = { x: seg[2].x + dx, y: seg[2].y + dy }
          if (segIndex < segs.length - 1) {
            const next = segs[segIndex + 1]
            next[0] = pos
            next[1] = { x: next[1].x + dx, y: next[1].y + dy }
          }
        } else {
          // cp1 (1) or cp2 (2): move freely
          seg[pointIndex] = pos
        }

        return { ...sp, path: { ...sp.path, segments: segs } }
      })
      return { sourcePaths: paths }
    })
  },

  addMap: (partial) => {
    const id = uid('map')
    const { canvasSize } = get()
    const map: PixelMap = {
      id,
      label: `Map ${get().pixelMaps.length + 1}`,
      width: canvasSize.width,
      height: canvasSize.height,
      layers: [],
      data: null,
      ...partial,
    }
    set(s => ({ pixelMaps: [...s.pixelMaps, map], activeMapId: id }))
  },

  removeMap: (id) => {
    set(s => ({
      pixelMaps: s.pixelMaps.filter(m => m.id !== id),
      activeMapId: s.activeMapId === id ? null : s.activeMapId,
    }))
  },

  updateMap: (id, update) => {
    set(s => ({ pixelMaps: s.pixelMaps.map(m => m.id === id ? { ...m, ...update } : m) }))
  },

  addMapLayer: (mapId, layerPartial) => {
    const perlinDefaults = layerPartial.type === 'perlin-noise'
      ? { noiseScale: 4, noiseOctaves: 4, noiseSeed: 0 }
      : {}
    const layer: MapLayer = {
      id: uid('layer'),
      type: 'linear-gradient',
      opacity: 1,
      blendMode: 'over',
      blur: 0,
      visible: true,
      color0: 0,
      color1: 1,
      x0: 0, y0: 0, x1: 1, y1: 0,
      ...perlinDefaults,
      ...layerPartial,
    }
    set(s => ({
      pixelMaps: s.pixelMaps.map(m =>
        m.id === mapId ? { ...m, layers: [...m.layers, layer] } : m
      )
    }))
    get().reRenderMap(mapId)
  },

  updateMapLayer: (mapId, layerId, update) => {
    set(s => ({
      pixelMaps: s.pixelMaps.map(m =>
        m.id === mapId
          ? { ...m, layers: m.layers.map(l => l.id === layerId ? { ...l, ...update } : l) }
          : m
      )
    }))
    get().reRenderMap(mapId)
  },

  removeMapLayer: (mapId, layerId) => {
    set(s => ({
      pixelMaps: s.pixelMaps.map(m =>
        m.id === mapId ? { ...m, layers: m.layers.filter(l => l.id !== layerId) } : m
      )
    }))
    get().reRenderMap(mapId)
  },

  reRenderMap: (mapId) => {
    const map = get().pixelMaps.find(m => m.id === mapId)
    if (!map) return
    const data = renderMap(map)
    set(s => ({
      pixelMaps: s.pixelMaps.map(m => m.id === mapId ? { ...m, data } : m)
    }))
  },

  setViewport: (vp) => set(s => ({ viewport: { ...s.viewport, ...vp } })),
  setViewMode: (m) => set({ viewMode: m }),
  setActiveTool: (t) => set({ activeTool: t }),
  toggleGuides: () => set(s => ({ showGuides: !s.showGuides })),
  toggleOffsets: () => set(s => ({ showOffsets: !s.showOffsets })),

  pushHistory: () => {
    const { sourcePaths, pixelMaps, history, historyIndex } = get()
    const entry: HistoryEntry = {
      sourcePaths: JSON.parse(JSON.stringify(sourcePaths)),
      pixelMaps: JSON.parse(JSON.stringify(pixelMaps)),
    }
    const newHistory = [...history.slice(0, historyIndex + 1), entry].slice(-50)
    set({ history: newHistory, historyIndex: newHistory.length - 1 })
  },

  undo: () => {
    const { history, historyIndex } = get()
    if (historyIndex <= 0) return
    const entry = history[historyIndex - 1]
    set({ ...entry, historyIndex: historyIndex - 1 })
  },

  redo: () => {
    const { history, historyIndex } = get()
    if (historyIndex >= history.length - 1) return
    const entry = history[historyIndex + 1]
    set({ ...entry, historyIndex: historyIndex + 1 })
  },

  setCanvasSize: (w, h) => set({ canvasSize: { width: w, height: h } }),
  setBackgroundColor: (c) => set({ backgroundColor: c }),
}))
