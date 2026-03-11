'use client'
import React, { useCallback } from 'react'
import { useStore } from '@/store/useStore'
import { SourcePath, MappedParam } from '@/lib/types'
import { ParamControl } from '../controls/ParamControl'

export function PathPanel() {
  const { sourcePaths, activePathId, pixelMaps, updatePath, setActivePath, addPath, removePath } = useStore()
  const activeSp = sourcePaths.find(p => p.id === activePathId)

  const updateOffset = useCallback((field: string, val: MappedParam | boolean) => {
    if (!activeSp) return
    updatePath(activeSp.id, {
      offsetSettings: { ...activeSp.offsetSettings, [field]: val }
    })
  }, [activeSp, updatePath])

  const updatePill = useCallback((field: string, val: MappedParam | string | number) => {
    if (!activeSp) return
    updatePath(activeSp.id, {
      pillSettings: { ...activeSp.pillSettings, [field]: val }
    })
  }, [activeSp, updatePath])

  const updateSmooth = useCallback((field: string, val: MappedParam | boolean) => {
    if (!activeSp) return
    updatePath(activeSp.id, {
      smoothingSettings: { ...activeSp.smoothingSettings, [field]: val }
    })
  }, [activeSp, updatePath])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Path list */}
      <div className="p-3 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between mb-2">
          <span className="section-label">Paths</span>
          <button onClick={() => addPath()} className="btn text-[10px] px-2">+ Add</button>
        </div>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {sourcePaths.map(sp => (
            <div
              key={sp.id}
              className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs ${
                sp.id === activePathId ? 'bg-[#4f8ef720] border border-[#4f8ef7]' : 'hover:bg-[#222]'
              }`}
              onClick={() => setActivePath(sp.id)}
            >
              <input
                type="checkbox"
                checked={sp.visible}
                onChange={e => updatePath(sp.id, { visible: e.target.checked })}
                onClick={e => e.stopPropagation()}
                className="accent-[#4f8ef7]"
              />
              <input
                type="text"
                value={sp.label}
                onChange={e => updatePath(sp.id, { label: e.target.value })}
                onClick={e => e.stopPropagation()}
                className="flex-1 bg-transparent border-none outline-none text-xs text-[#ccc]"
              />
              <button
                onClick={e => { e.stopPropagation(); removePath(sp.id) }}
                className="text-[#555] hover:text-red-400 text-xs"
              >×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Active path controls */}
      {activeSp && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Smoothing */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <span className="section-label">Corner Smoothing</span>
              <input
                type="checkbox"
                checked={activeSp.smoothingSettings.enabled}
                onChange={e => updateSmooth('enabled', e.target.checked)}
                className="accent-[#4f8ef7]"
              />
            </div>
            {activeSp.smoothingSettings.enabled && (
              <ParamControl
                label="Radius"
                param={activeSp.smoothingSettings.radius}
                onChange={v => updateSmooth('radius', v)}
                pixelMaps={pixelMaps}
                min={0} max={200}
                unit="px"
              />
            )}
          </section>

          {/* Offset settings */}
          <section>
            <span className="section-label block mb-2">Offsets</span>
            <ParamControl
              label="Count (per side)"
              param={activeSp.offsetSettings.count}
              onChange={v => updateOffset('count', v)}
              pixelMaps={pixelMaps}
              min={0} max={20} step={1}
            />
            <ParamControl
              label="Base distance"
              param={activeSp.offsetSettings.baseDistance}
              onChange={v => updateOffset('baseDistance', v)}
              pixelMaps={pixelMaps}
              min={0} max={200}
              unit="px"
            />
            <ParamControl
              label="Growth per step"
              param={activeSp.offsetSettings.growth}
              onChange={v => updateOffset('growth', v)}
              pixelMaps={pixelMaps}
              min={-100} max={100}
              unit="px"
            />
            <label className="flex items-center gap-2 text-xs text-[#aaa] mt-1">
              <input
                type="checkbox"
                checked={activeSp.offsetSettings.symmetric}
                onChange={e => updateOffset('symmetric', e.target.checked)}
                className="accent-[#4f8ef7]"
              />
              Symmetric (both sides)
            </label>
          </section>

          {/* Pill settings */}
          <section>
            <span className="section-label block mb-2">Pills</span>
            <div className="flex gap-1 mb-3">
              {(['fill','stroke','both'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => updatePill('style', s)}
                  className={`btn flex-1 text-[10px] ${activeSp.pillSettings.style === s ? 'btn-primary' : ''}`}
                >{s}</button>
              ))}
            </div>

            {activeSp.pillSettings.style !== 'stroke' && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-[#aaa] w-20">Fill color</span>
                <input
                  type="color"
                  value={activeSp.pillSettings.fillColor}
                  onChange={e => updatePill('fillColor', e.target.value)}
                  className="w-8 h-6 rounded cursor-pointer border border-[#333]"
                />
                <input
                  type="text"
                  value={activeSp.pillSettings.fillColor}
                  onChange={e => updatePill('fillColor', e.target.value)}
                  className="input-base flex-1"
                />
              </div>
            )}

            {activeSp.pillSettings.style !== 'fill' && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-[#aaa] w-20">Stroke color</span>
                <input
                  type="color"
                  value={activeSp.pillSettings.strokeColor}
                  onChange={e => updatePill('strokeColor', e.target.value)}
                  className="w-8 h-6 rounded cursor-pointer border border-[#333]"
                />
                <input
                  type="number"
                  value={activeSp.pillSettings.strokeWidth}
                  onChange={e => updatePill('strokeWidth', parseFloat(e.target.value) || 1)}
                  className="input-base w-16"
                  step="0.5"
                />
              </div>
            )}

            <ParamControl label="Length" param={activeSp.pillSettings.length}
              onChange={v => updatePill('length', v)} pixelMaps={pixelMaps} min={0.5} max={200} unit="px" />
            <ParamControl label="Thickness" param={activeSp.pillSettings.thickness}
              onChange={v => updatePill('thickness', v)} pixelMaps={pixelMaps} min={0.5} max={100} unit="px" />
            <ParamControl label="Spacing" param={activeSp.pillSettings.spacing}
              onChange={v => updatePill('spacing', v)} pixelMaps={pixelMaps} min={1} max={300} unit="px" />

            <div className="mt-3 mb-1">
              <span className="section-label block mb-1">Falloff by distance</span>
              <span className="text-[10px] text-[#555]">How much each param decreases per pixel away from center line</span>
            </div>
            <ParamControl label="Length falloff" param={activeSp.pillSettings.lengthFalloff}
              onChange={v => updatePill('lengthFalloff', v)} pixelMaps={pixelMaps} min={-5} max={5} step={0.01} />
            <ParamControl label="Thickness falloff" param={activeSp.pillSettings.thicknessFalloff}
              onChange={v => updatePill('thicknessFalloff', v)} pixelMaps={pixelMaps} min={-5} max={5} step={0.01} />
            <ParamControl label="Spacing falloff" param={activeSp.pillSettings.spacingFalloff}
              onChange={v => updatePill('spacingFalloff', v)} pixelMaps={pixelMaps} min={-5} max={5} step={0.01} />
          </section>

        </div>
      )}
    </div>
  )
}

