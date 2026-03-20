'use client'
import React, { useCallback } from 'react'
import { MappedParam, PixelMap } from '@/lib/types'
import { useStore } from '@/store/useStore'

const PX_PER_MM = 96 / 25.4

function pxToMm(px: number) { return +(px / PX_PER_MM).toFixed(2) }
function mmToPx(mm: number) { return mm * PX_PER_MM }

interface ParamControlProps {
  label: string
  param: MappedParam
  onChange: (updated: MappedParam) => void
  pixelMaps: PixelMap[]
  min?: number
  max?: number
  step?: number
  unit?: string   // 'px' = convert when displayUnit is mm; anything else = show as-is
}

export function ParamControl({ label, param, onChange, pixelMaps, min, max, step, unit }: ParamControlProps) {
  const displayUnit = useStore(s => s.displayUnit)
  const convertMm = unit === 'px' && displayUnit === 'mm'

  const update = useCallback((partial: Partial<MappedParam>) => {
    onChange({ ...param, ...partial })
  }, [param, onChange])

  const pmin = min ?? param.min ?? 0
  const pmax = max ?? param.max ?? 500

  // Convert stored-px bounds/value → display unit
  const dispMin  = convertMm ? pxToMm(pmin) : pmin
  const dispMax  = convertMm ? pxToMm(pmax) : pmax
  const dispVal  = convertMm ? pxToMm(param.value) : param.value
  const dispStep = step !== undefined
    ? (convertMm ? +(step / PX_PER_MM).toFixed(3) : step)
    : (convertMm ? 0.1 : 0.1)
  const dispUnit = convertMm ? 'mm' : (unit ?? '')

  const handleValueChange = (raw: number) => {
    const px = convertMm ? mmToPx(raw) : raw
    update({ value: px })
  }

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[#aaa]">{label}</span>
        <div className="flex gap-1">
          {(['static', 'map', 'combined'] as const).map(m => (
            <button
              key={m}
              onClick={() => update({ mode: m })}
              className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
                param.mode === m
                  ? 'bg-[#4f8ef7] border-[#4f8ef7] text-white'
                  : 'bg-[#1a1a1a] border-[#333] text-[#777] hover:border-[#555]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {(param.mode === 'static' || param.mode === 'combined') && (
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={dispMin} max={dispMax} step={dispStep}
            value={dispVal}
            onChange={e => handleValueChange(parseFloat(e.target.value))}
            className="flex-1 accent-[#4f8ef7] h-1"
          />
          <input
            type="number"
            min={dispMin} max={dispMax} step={dispStep}
            value={dispVal}
            onChange={e => handleValueChange(parseFloat(e.target.value) || 0)}
            className="input-base w-16 text-right"
          />
          {dispUnit && <span className="text-[10px] text-[#666]">{dispUnit}</span>}
        </div>
      )}

      {(param.mode === 'map' || param.mode === 'combined') && (
        <div className="mt-1 space-y-1">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#666] w-8">Map</span>
            <select
              value={param.mapId ?? ''}
              onChange={e => update({ mapId: e.target.value || null })}
              className="input-base flex-1"
            >
              <option value="">— none —</option>
              {pixelMaps.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#666] w-8">Amp</span>
            <input
              type="number" step="0.1" value={param.amplification}
              onChange={e => update({ amplification: parseFloat(e.target.value) || 1 })}
              className="input-base flex-1"
            />
            <button
              onClick={() => update({ invert: !param.invert })}
              className={`btn text-[10px] px-1.5 ${param.invert ? 'btn-primary' : ''}`}
            >inv</button>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#666] w-8">Mode</span>
            {(['add','multiply','override'] as const).map(bm => (
              <button
                key={bm}
                onClick={() => update({ blendMode: bm })}
                className={`btn text-[10px] px-1.5 ${param.blendMode === bm ? 'btn-primary' : ''}`}
              >{bm}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
