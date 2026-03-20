'use client'
import React, { useCallback, useState, useRef, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { ActiveTool, ViewMode } from '@/lib/types'
import { parseSVGPaths } from '@/lib/svg/parser'
import { exportSVG } from '@/lib/svg/exporter'
import { createDefaultPath } from '@/store/useStore'

const TOOLS: { id: ActiveTool; icon: string; title: string }[] = [
  { id: 'select', icon: '↖', title: 'Select / Edit (V)' },
  { id: 'draw',   icon: '✏', title: 'Draw path (P)' },
  { id: 'pan',    icon: '✋', title: 'Pan (Space)' },
]

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: 'guide',    label: 'Guide' },
  { id: 'render',   label: 'Render' },
  { id: 'map',      label: 'Maps' },
  { id: 'combined', label: 'All' },
]

const PX_PER_MM = 96 / 25.4  // 3.7795...

function pxToMm(px: number) { return +(px / PX_PER_MM).toFixed(1) }
function mmToPx(mm: number) { return Math.round(mm * PX_PER_MM) }

// ─── Canvas size popover ───────────────────────────────────────────────────────

function CanvasSizeMenu({ canvasSize, setCanvasSize }: {
  canvasSize: { width: number; height: number }
  setCanvasSize: (w: number, h: number) => void
}) {
  const unit = useStore(s => s.displayUnit)
  const setUnit = useStore(s => s.setDisplayUnit)
  const [open, setOpen] = useState(false)
  const [w, setW] = useState(canvasSize.width)
  const [h, setH] = useState(canvasSize.height)
  const ref = useRef<HTMLDivElement>(null)

  // Sync local state when canvas changes externally
  useEffect(() => {
    setW(canvasSize.width)
    setH(canvasSize.height)
  }, [canvasSize.width, canvasSize.height])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [open])

  const displayW = unit === 'mm' ? pxToMm(w) : w
  const displayH = unit === 'mm' ? pxToMm(h) : h

  const applyW = (val: number) => {
    const px = unit === 'mm' ? mmToPx(val) : Math.round(val)
    if (px > 0) setW(px)
  }
  const applyH = (val: number) => {
    const px = unit === 'mm' ? mmToPx(val) : Math.round(val)
    if (px > 0) setH(px)
  }

  const apply = () => {
    setCanvasSize(w, h)
    setOpen(false)
  }

  const label = unit === 'mm'
    ? `${pxToMm(canvasSize.width)}×${pxToMm(canvasSize.height)} mm`
    : `${canvasSize.width}×${canvasSize.height}`

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`btn text-xs ${open ? 'btn-primary' : ''}`}
        title="Canvas size"
      >
        {label}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-[#1a1a1a] border border-[#333] rounded shadow-xl p-3 w-52">
          {/* Unit toggle */}
          <div className="flex gap-1 mb-3">
            {(['px', 'mm'] as const).map(u => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={`btn flex-1 text-xs ${unit === u ? 'btn-primary' : ''}`}
              >{u}</button>
            ))}
          </div>

          {/* Width */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-[#888] w-6">W</span>
            <input
              type="number"
              value={displayW}
              min={1}
              step={unit === 'mm' ? 0.1 : 1}
              onChange={e => applyW(parseFloat(e.target.value) || 1)}
              className="input-base flex-1"
            />
            <span className="text-[10px] text-[#555]">{unit}</span>
          </div>

          {/* Height */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-[#888] w-6">H</span>
            <input
              type="number"
              value={displayH}
              min={1}
              step={unit === 'mm' ? 0.1 : 1}
              onChange={e => applyH(parseFloat(e.target.value) || 1)}
              className="input-base flex-1"
            />
            <span className="text-[10px] text-[#555]">{unit}</span>
          </div>

          {/* Presets */}
          <div className="mb-3">
            <span className="text-[10px] text-[#555] block mb-1">Presets</span>
            <div className="grid grid-cols-2 gap-1">
              {[
                { label: 'Square S', w: 500, h: 500 },
                { label: 'Square M', w: 800, h: 800 },
                { label: 'Square L', w: 1200, h: 1200 },
                { label: 'A4', w: mmToPx(210), h: mmToPx(297) },
                { label: 'A4 land.', w: mmToPx(297), h: mmToPx(210) },
                { label: '16:9 HD', w: 1920, h: 1080 },
              ].map(p => (
                <button
                  key={p.label}
                  onClick={() => { setW(p.w); setH(p.h) }}
                  className="btn text-[10px] px-1.5"
                >{p.label}</button>
              ))}
            </div>
          </div>

          <button onClick={apply} className="btn btn-primary w-full text-xs">Apply</button>
        </div>
      )}
    </div>
  )
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

export function Toolbar() {
  const {
    activeTool, setActiveTool, viewMode, setViewMode,
    showGuides, showOffsets, toggleGuides, toggleOffsets,
    undo, redo, addPath, sourcePaths, pixelMaps, canvasSize, setCanvasSize,
    backgroundColor, setBackgroundColor,
  } = useStore()

  // Keyboard shortcuts
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'v' || e.key === 'V') setActiveTool('select')
      if (e.key === 'p' || e.key === 'P') setActiveTool('draw')
      if (e.key === ' ') { e.preventDefault(); setActiveTool('pan') }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setActiveTool, undo, redo])

  const handleImportSVG = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const paths = parseSVGPaths(text)
      paths.forEach(p => {
        addPath(createDefaultPath(undefined))
        const state = useStore.getState()
        const newSp = state.sourcePaths[state.sourcePaths.length - 1]
        state.updatePath(newSp.id, {
          path: p,
          label: `Imported ${state.sourcePaths.length}`,
        })
      })
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [addPath])

  const handleExport = useCallback(() => {
    const state = useStore.getState()
    const svg = exportSVG(state, false)
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'raster-export.svg'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleExportWithGuides = useCallback(() => {
    const state = useStore.getState()
    const svg = exportSVG(state, true)
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'raster-export-guides.svg'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-[#2a2a2a] bg-[#111] flex-shrink-0">
      {/* Logo */}
      <div className="text-sm font-bold text-[#4f8ef7] mr-2 tracking-wide">RASTER</div>

      {/* Tools */}
      <div className="flex gap-1 border-r border-[#2a2a2a] pr-3">
        {TOOLS.map(t => (
          <button
            key={t.id}
            title={t.title}
            onClick={() => setActiveTool(t.id)}
            className={`btn px-2.5 text-base ${activeTool === t.id ? 'btn-primary' : ''}`}
          >{t.icon}</button>
        ))}
      </div>

      {/* View modes */}
      <div className="flex gap-1 border-r border-[#2a2a2a] pr-3">
        {VIEW_MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setViewMode(m.id)}
            className={`btn text-xs ${viewMode === m.id ? 'btn-primary' : ''}`}
          >{m.label}</button>
        ))}
      </div>

      {/* Visibility toggles */}
      <div className="flex gap-1 border-r border-[#2a2a2a] pr-3">
        <button onClick={toggleGuides} className={`btn text-xs ${showGuides ? 'btn-primary' : ''}`}>
          Center lines
        </button>
        <button onClick={toggleOffsets} className={`btn text-xs ${showOffsets ? 'btn-primary' : ''}`}>
          Offsets
        </button>
      </div>

      {/* Undo/Redo */}
      <div className="flex gap-1 border-r border-[#2a2a2a] pr-3">
        <button onClick={undo} className="btn text-xs">↩ Undo</button>
        <button onClick={redo} className="btn text-xs">↪ Redo</button>
      </div>

      {/* Canvas size */}
      <div className="flex items-center gap-1.5 border-r border-[#2a2a2a] pr-3">
        <span className="text-xs text-[#aaa]">Canvas</span>
        <CanvasSizeMenu canvasSize={canvasSize} setCanvasSize={setCanvasSize} />
      </div>

      {/* Background color */}
      <div className="flex items-center gap-1.5 border-r border-[#2a2a2a] pr-3">
        <span className="text-xs text-[#aaa]">Background</span>
        <input
          type="color"
          value={backgroundColor}
          onChange={e => setBackgroundColor(e.target.value)}
          className="w-7 h-6 rounded cursor-pointer border border-[#333]"
          title="Background color"
        />
      </div>

      {/* Import */}
      <label className="btn text-xs cursor-pointer">
        Import SVG
        <input type="file" accept=".svg,image/svg+xml" className="hidden" onChange={handleImportSVG} />
      </label>

      {/* Export */}
      <button onClick={handleExport} className="btn btn-primary text-xs">Export SVG</button>
      <button onClick={handleExportWithGuides} className="btn text-xs">+ Guides</button>
    </div>
  )
}
