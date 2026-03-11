'use client'
import React, { useCallback } from 'react'
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

export function Toolbar() {
  const {
    activeTool, setActiveTool, viewMode, setViewMode,
    showGuides, showOffsets, toggleGuides, toggleOffsets,
    undo, redo, addPath, sourcePaths, pixelMaps, canvasSize,
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
        // Update the just-added path with parsed geometry
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
