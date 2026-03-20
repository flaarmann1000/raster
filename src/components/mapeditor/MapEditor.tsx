'use client'
import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useStore } from '@/store/useStore'
import { PixelMap, MapLayer } from '@/lib/types'

export function MapEditor() {
  const pixelMaps = useStore(s => s.pixelMaps)
  const activeMapId = useStore(s => s.activeMapId)
  const addMap = useStore(s => s.addMap)

  const activeMap = pixelMaps.find(m => m.id === activeMapId)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Map list header */}
      <div className="p-3 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between mb-2">
          <span className="section-label">Pixel Maps</span>
          <button
            onClick={() => addMap()}
            className="btn text-[10px] px-2"
          >+ New Map</button>
        </div>
        <div className="space-y-1 max-h-28 overflow-y-auto">
          {pixelMaps.length === 0 && (
            <p className="text-[10px] text-[#444] italic">No maps yet. Create one to use as a parameter source.</p>
          )}
          {pixelMaps.map(m => (
            <MapListItem key={m.id} map={m} />
          ))}
        </div>
      </div>

      {/* Active map editor */}
      {activeMap ? (
        <div className="flex-1 overflow-y-auto">
          <MapEditorDetail map={activeMap} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-[#333] text-xs">
          Select or create a map
        </div>
      )}
    </div>
  )
}

function MapListItem({ map }: { map: PixelMap }) {
  const activeMapId = useStore(s => s.activeMapId)
  const updateMap = useStore(s => s.updateMap)
  const removeMap = useStore(s => s.removeMap)

  const setActiveMap = () => useStore.setState({ activeMapId: map.id })
  const isActive = map.id === activeMapId

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs ${
        isActive ? 'bg-[#4f8ef720] border border-[#4f8ef7]' : 'hover:bg-[#222]'
      }`}
      onClick={setActiveMap}
    >
      {/* Tiny preview */}
      <MapPreviewThumbnail map={map} size={24} />
      <input
        type="text"
        value={map.label}
        onChange={e => updateMap(map.id, { label: e.target.value })}
        onClick={e => e.stopPropagation()}
        className="flex-1 bg-transparent border-none outline-none text-xs text-[#ccc]"
      />
      <button
        onClick={e => { e.stopPropagation(); removeMap(map.id) }}
        className="text-[#555] hover:text-red-400 text-xs"
      >×</button>
    </div>
  )
}

function MapPreviewThumbnail({ map, size }: { map: PixelMap; size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (map.data) {
      const w = map.width, h = map.height
      const imgData = ctx.createImageData(size, size)
      for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
          const sx = Math.floor(px * w / size)
          const sy = Math.floor(py * h / size)
          const val = map.data[sy * w + sx] * 255
          const i = (py * size + px) * 4
          imgData.data[i] = imgData.data[i+1] = imgData.data[i+2] = val
          imgData.data[i+3] = 255
        }
      }
      ctx.putImageData(imgData, 0, 0)
    } else {
      ctx.fillStyle = '#222'
      ctx.fillRect(0, 0, size, size)
    }
  }, [map.data, map.width, map.height, size])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded border border-[#333] flex-shrink-0"
    />
  )
}

const FIT_OPTIONS = ['cover', 'contain', 'fill', 'none'] as const

function MapEditorDetail({ map }: { map: PixelMap }) {
  const updateMap = useStore(s => s.updateMap)
  const addMapLayer = useStore(s => s.addMapLayer)
  const updateMapLayer = useStore(s => s.updateMapLayer)
  const removeMapLayer = useStore(s => s.removeMapLayer)
  const reRenderMap = useStore(s => s.reRenderMap)
  const reorderMapLayers = useStore(s => s.reorderMapLayers)
  const setImageLayerData = useStore(s => s.setImageLayerData)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const dragIndexRef = useRef<number | null>(null)

  // Update preview canvas when map data changes
  useEffect(() => {
    const canvas = previewRef.current
    if (!canvas || !map.data) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width: w, height: h } = map
    const imgData = ctx.createImageData(w, h)
    for (let i = 0; i < w * h; i++) {
      const val = Math.round(map.data[i] * 255)
      imgData.data[i*4] = imgData.data[i*4+1] = imgData.data[i*4+2] = val
      imgData.data[i*4+3] = 255
    }
    ctx.putImageData(imgData, 0, 0)
  }, [map.data, map.width, map.height])

  const decodeImageFile = useCallback((file: File, onDone: (data: Float32Array, url: string) => void) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const url = ev.target?.result as string
      const img = new Image()
      img.onload = () => {
        const offCanvas = document.createElement('canvas')
        offCanvas.width = map.width
        offCanvas.height = map.height
        const ctx = offCanvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, map.width, map.height)
        const imgData = ctx.getImageData(0, 0, map.width, map.height)
        const data = new Float32Array(map.width * map.height)
        for (let i = 0; i < data.length; i++) {
          data[i] = (imgData.data[i*4] * 0.299 + imgData.data[i*4+1] * 0.587 + imgData.data[i*4+2] * 0.114) / 255
        }
        onDone(data, url)
      }
      img.src = url
    }
    reader.readAsDataURL(file)
  }, [map.width, map.height])

  const handleAddImageLayer = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    decodeImageFile(file, (data, url) => {
      addMapLayer(map.id, { type: 'image', imageDataUrl: url, imageData: data })
    })
    e.target.value = ''
  }, [map.id, addMapLayer, decodeImageFile])

  // Display index = map.layers.length - 1 - arrayIndex
  const handleDragStart = (displayIdx: number) => {
    dragIndexRef.current = displayIdx
  }

  const handleDrop = (displayIdx: number) => {
    if (dragIndexRef.current === null || dragIndexRef.current === displayIdx) return
    const fromDisplayIdx = dragIndexRef.current
    const arrayLen = map.layers.length
    const fromArrayIdx = arrayLen - 1 - fromDisplayIdx
    const toArrayIdx = arrayLen - 1 - displayIdx
    reorderMapLayers(map.id, fromArrayIdx, toArrayIdx)
    dragIndexRef.current = null
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const reversedLayers = [...map.layers].reverse()

  return (
    <div className="p-3 space-y-4">
      {/* Map settings */}
      <div>
        <span className="section-label block mb-2">Map Settings</span>
        <div className="flex gap-2 items-center mb-2">
          <span className="text-xs text-[#aaa] w-16">Resolution</span>
          <select
            value={map.width}
            onChange={e => {
              const s = parseInt(e.target.value)
              updateMap(map.id, { width: s, height: s, data: null })
              reRenderMap(map.id)
            }}
            className="input-base flex-1"
          >
            {[64, 128, 256, 512, 1024].map(s => (
              <option key={s} value={s}>{s}×{s}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-[#aaa] w-16">Fit</span>
          <div className="flex gap-1 flex-1">
            {FIT_OPTIONS.map(f => (
              <button
                key={f}
                onClick={() => updateMap(map.id, { fit: f })}
                className={`btn text-[10px] px-1.5 flex-1 ${(map.fit ?? 'cover') === f ? 'btn-primary' : ''}`}
              >{f}</button>
            ))}
          </div>
        </div>

        {map.fit === 'none' && (
          <div className="mt-2 space-y-1">
            {([
              { label: 'Zoom', key: 'mapZoom', min: 0.1, max: 10, step: 0.01, def: 1 },
              { label: 'Offset X', key: 'mapOffsetX', min: -1, max: 1, step: 0.005, def: 0 },
              { label: 'Offset Y', key: 'mapOffsetY', min: -1, max: 1, step: 0.005, def: 0 },
            ] as const).map(({ label, key, min, max, step, def }) => {
              const val = (map as any)[key] ?? def
              return (
                <div key={key} className="flex items-center gap-1">
                  <span className="text-[10px] text-[#666] w-14">{label}</span>
                  <input
                    type="range" min={min} max={max} step={step}
                    value={val}
                    onChange={e => updateMap(map.id, { [key]: parseFloat(e.target.value) } as any)}
                    className="flex-1 accent-[#4f8ef7] h-1"
                  />
                  <input
                    type="number" min={min} max={max} step={step}
                    value={val.toFixed(step < 0.01 ? 3 : 2)}
                    onChange={e => updateMap(map.id, { [key]: parseFloat(e.target.value) || def } as any)}
                    className="input-base w-16 text-right"
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Preview */}
      <div>
        <span className="section-label block mb-2">Preview</span>
        <div className="flex justify-center">
          {map.data ? (
            <canvas
              ref={previewRef}
              width={map.width}
              height={map.height}
              className="rounded border border-[#333] max-w-full"
              style={{ imageRendering: 'pixelated', maxHeight: 180 }}
            />
          ) : (
            <div className="w-full h-24 bg-[#1a1a1a] rounded border border-[#2a2a2a] flex items-center justify-center text-[#444] text-xs">
              No data — add a layer
            </div>
          )}
        </div>
      </div>

      {/* Layers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="section-label">Layers</span>
          <div className="flex gap-1 flex-wrap">
            {(['linear-gradient','radial-gradient','rect','ellipse'] as const).map(t => (
              <button
                key={t}
                title={`Add ${t}`}
                onClick={() => addMapLayer(map.id, { type: t })}
                className="btn text-[10px] px-1.5"
              >{layerTypeShort(t)}</button>
            ))}
            <button
              title="Add Perlin Noise"
              onClick={() => addMapLayer(map.id, { type: 'perlin-noise' })}
              className="btn text-[10px] px-1.5"
            >Perlin</button>
            <label
              title="Add Image layer"
              className="btn text-[10px] px-1.5 cursor-pointer"
            >
              Image
              <input type="file" accept="image/*" className="hidden" onChange={handleAddImageLayer} />
            </label>
          </div>
        </div>
        <div className="space-y-1">
          {map.layers.length === 0 && (
            <p className="text-[10px] text-[#444] italic">No layers. Add a gradient or shape above.</p>
          )}
          {reversedLayers.map((layer, displayIdx) => (
            <div
              key={layer.id}
              draggable
              onDragStart={() => handleDragStart(displayIdx)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(displayIdx)}
            >
              <LayerEditor
                layer={layer}
                mapId={map.id}
                onUpdate={(u) => updateMapLayer(map.id, layer.id, u)}
                onRemove={() => removeMapLayer(map.id, layer.id)}
                onReplaceImage={(file) => {
                  decodeImageFile(file, (data, url) => {
                    setImageLayerData(map.id, layer.id, data, url)
                  })
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function layerTypeShort(t: string) {
  return { 'linear-gradient': 'Lin', 'radial-gradient': 'Rad', 'rect': 'Rect', 'ellipse': 'Elps', 'perlin-noise': 'Perlin', 'image': 'Image' }[t] ?? t
}

interface LayerEditorProps {
  layer: MapLayer
  mapId: string
  onUpdate: (u: Partial<MapLayer>) => void
  onRemove: () => void
  onReplaceImage?: (file: File) => void
}

function LayerEditor({ layer, mapId: _mapId, onUpdate, onRemove, onReplaceImage }: LayerEditorProps) {
  const [open, setOpen] = useState(true)

  const num = (label: string, key: keyof MapLayer, min = 0, max = 1, step = 0.01) => (
    <div className="flex items-center gap-1 mb-1">
      <span className="text-[10px] text-[#666] w-14">{label}</span>
      <input
        type="range" min={min} max={max} step={step}
        value={(layer[key] as number) ?? 0}
        onChange={e => onUpdate({ [key]: parseFloat(e.target.value) })}
        className="flex-1 accent-[#4f8ef7] h-1"
      />
      <input
        type="number" min={min} max={max} step={step}
        value={((layer[key] as number) ?? 0).toFixed(3)}
        onChange={e => onUpdate({ [key]: parseFloat(e.target.value) || 0 })}
        className="input-base w-16 text-right"
      />
    </div>
  )

  const numAny = (label: string, key: string, min = 0, max = 1, step = 0.01) => (
    <div className="flex items-center gap-1 mb-1">
      <span className="text-[10px] text-[#666] w-14">{label}</span>
      <input
        type="range" min={min} max={max} step={step}
        value={((layer as any)[key] as number) ?? 0}
        onChange={e => onUpdate({ [key]: parseFloat(e.target.value) } as any)}
        className="flex-1 accent-[#4f8ef7] h-1"
      />
      <input
        type="number" min={min} max={max} step={step}
        value={(((layer as any)[key] as number) ?? 0).toFixed(step < 1 ? 3 : 0)}
        onChange={e => onUpdate({ [key]: parseFloat(e.target.value) || 0 } as any)}
        className="input-base w-16 text-right"
      />
    </div>
  )

  return (
    <div className="border border-[#2a2a2a] rounded overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1 bg-[#1a1a1a]">
        <input
          type="checkbox" checked={layer.visible}
          onChange={e => onUpdate({ visible: e.target.checked })}
          className="accent-[#4f8ef7]"
        />
        <button className="flex-1 text-left text-xs text-[#aaa]" onClick={() => setOpen(o => !o)}>
          {layer.type} {open ? '▲' : '▼'}
        </button>
        <select
          value={layer.blendMode}
          onChange={e => onUpdate({ blendMode: e.target.value as MapLayer['blendMode'] })}
          className="input-base w-20"
        >
          {['over','add','subtract','multiply'].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <button onClick={onRemove} className="text-[#555] hover:text-red-400 text-xs ml-1">×</button>
      </div>

      {open && (
        <div className="p-2 bg-[#111] space-y-0.5">
          {num('Opacity', 'opacity', 0, 1)}
          {num('Blur', 'blur', 0, 20, 0.5)}

          {layer.type === 'image' && (
            <div className="mb-1">
              {layer.imageDataUrl && (
                <img
                  src={layer.imageDataUrl}
                  alt="layer preview"
                  className="w-full max-h-20 object-contain rounded border border-[#2a2a2a] mb-1"
                  style={{ imageRendering: 'pixelated' }}
                />
              )}
              <label className="btn cursor-pointer block text-center text-[10px]">
                Replace
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file && onReplaceImage) onReplaceImage(file)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          )}

          {layer.type !== 'perlin-noise' && layer.type !== 'image' && (
            <>
              {num('Color 0', 'color0', 0, 1)}
              {num('Color 1', 'color1', 0, 1)}
            </>
          )}

          {(layer.type === 'linear-gradient') && (
            <>
              {num('X0', 'x0')}
              {num('Y0', 'y0')}
              {num('X1', 'x1')}
              {num('Y1', 'y1')}
            </>
          )}
          {(layer.type === 'radial-gradient' || layer.type === 'ellipse') && (
            <>
              {num('CX', 'cx')}
              {num('CY', 'cy')}
              {layer.type === 'radial-gradient' && num('Radius', 'radius', 0, 1)}
            </>
          )}
          {(layer.type === 'rect' || layer.type === 'ellipse') && (
            <>
              {num('X', 'x')}
              {num('Y', 'y')}
              {num('W', 'width')}
              {num('H', 'height')}
            </>
          )}
          {layer.type === 'perlin-noise' && (
            <>
              {num('Color 0', 'color0', 0, 1)}
              {num('Color 1', 'color1', 0, 1)}
              {numAny('Scale', 'noiseScale', 0.1, 20, 0.1)}
              {numAny('Octaves', 'noiseOctaves', 1, 8, 1)}
              {numAny('Seed', 'noiseSeed', 0, 999, 1)}
            </>
          )}
        </div>
      )}
    </div>
  )
}
