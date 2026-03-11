'use client'
import { Toolbar } from '@/components/panels/Toolbar'
import { LeftPanel } from '@/components/panels/LeftPanel'
import { Canvas } from '@/components/canvas/Canvas'
import { RightPanel } from '@/components/panels/RightPanel'

export default function Home() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel />
        <Canvas />
        <RightPanel />
      </div>
    </div>
  )
}
