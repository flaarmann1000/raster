'use client'
import React from 'react'
import { useStore } from '@/store/useStore'
import { CubicSegment } from '@/lib/types'

export function RightPanel() {
  const activePathId = useStore(s => s.activePathId)
  const sourcePaths = useStore(s => s.sourcePaths)
  const activeSp = sourcePaths.find(p => p.id === activePathId)

  return (
    <div
      className="panel flex flex-col h-full overflow-hidden"
      style={{ width: 256, borderLeft: '1px solid #2a2a2a', flexShrink: 0 }}
    >
      <div className="p-3 border-b border-[#2a2a2a]">
        <span className="section-label">Point Editor</span>
      </div>

      {activeSp ? (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {activeSp.path.segments.map((seg, si) => (
            <SegmentEditor
              key={si}
              seg={seg}
              si={si}
              pathId={activeSp.id}
              isLast={si === activeSp.path.segments.length - 1}
            />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-[#444] text-xs p-4 text-center">
          Select a path to edit points
        </div>
      )}
    </div>
  )
}

function SegmentEditor({
  seg, si, pathId, isLast,
}: { seg: CubicSegment; si: number; pathId: string; isLast: boolean }) {
  const movePoint = useStore(s => s.movePoint)
  const pushHistory = useStore(s => s.pushHistory)
  const [open, setOpen] = React.useState(false)

  const setPt = (ptIdx: 0 | 1 | 2 | 3, axis: 'x' | 'y', val: number) => {
    const cur = seg[ptIdx]
    movePoint(pathId, si, ptIdx, axis === 'x' ? { x: val, y: cur.y } : { x: cur.x, y: val })
    pushHistory()
  }

  const rows: [string, 0 | 1 | 2 | 3][] = [['anchor', 0], ['cp1', 1], ['cp2', 2]]
  if (isLast) rows.push(['end', 3])

  return (
    <div className="border border-[#2a2a2a] rounded overflow-hidden">
      <button
        className="w-full text-left px-2 py-1 text-xs text-[#aaa] hover:bg-[#1a1a1a] flex justify-between"
        onClick={() => setOpen(o => !o)}
      >
        <span>Seg {si + 1}: ({seg[0].x.toFixed(1)}, {seg[0].y.toFixed(1)})</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="p-2 space-y-1 bg-[#111]">
          {rows.map(([label, ptIdx]) => {
            const pt = seg[ptIdx]
            return (
              <div key={label} className="flex items-center gap-1">
                <span className="text-[10px] text-[#555] w-10">{label}</span>
                <span className="text-[10px] text-[#555]">X</span>
                <input type="number" value={pt.x.toFixed(1)} step="0.5"
                  onChange={e => setPt(ptIdx, 'x', parseFloat(e.target.value) || 0)}
                  className="input-base w-16" />
                <span className="text-[10px] text-[#555]">Y</span>
                <input type="number" value={pt.y.toFixed(1)} step="0.5"
                  onChange={e => setPt(ptIdx, 'y', parseFloat(e.target.value) || 0)}
                  className="input-base w-16" />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
