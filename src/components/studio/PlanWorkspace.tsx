'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { PenLine, Box } from 'lucide-react'

const PlanEditor2D = dynamic(() => import('./PlanEditor2D'), { ssr: false })
const PlanScene3D = dynamic(() => import('./PlanScene3D'), { ssr: false })

export default function PlanWorkspace() {
  const [view, setView] = useState<'2d' | '3d'>('2d')
  return (
    <div className="relative h-screen w-full overflow-hidden bg-surface">
      <div className="absolute left-1/2 top-2 z-30 flex -translate-x-1/2 gap-1 rounded-xl border border-gray-200 bg-white/95 p-1 shadow-lg backdrop-blur">
        <button
          onClick={() => setView('2d')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${view === '2d' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          <PenLine size={13} /> 2D გეგმა
        </button>
        <button
          onClick={() => setView('3d')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${view === '3d' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          <Box size={13} /> 3D ხედი
        </button>
      </div>
      {view === '2d' ? <PlanEditor2D /> : <PlanScene3D />}
    </div>
  )
}
