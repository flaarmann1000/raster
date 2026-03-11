'use client'
import React, { useState } from 'react'
import { PathPanel } from './PathPanel'
import { MapEditor } from '../mapeditor/MapEditor'

type Tab = 'paths' | 'maps'

export function LeftPanel() {
  const [tab, setTab] = useState<Tab>('paths')

  return (
    <div className="panel w-72 flex flex-col overflow-hidden h-full">
      {/* Tab bar */}
      <div className="flex border-b border-[#2a2a2a]">
        {([['paths', 'Paths & Pills'], ['maps', 'Pixel Maps']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 py-2 text-xs transition-colors ${
              tab === id
                ? 'text-[#4f8ef7] border-b border-[#4f8ef7]'
                : 'text-[#666] hover:text-[#aaa]'
            }`}
          >{label}</button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === 'paths' ? <PathPanel /> : <MapEditor />}
      </div>
    </div>
  )
}
