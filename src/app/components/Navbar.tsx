'use client'
import { useRoomStore } from '../store'
import { Box, PenLine, Download, Upload } from 'lucide-react'

export default function Navbar() {
  const { viewMode, setViewMode, rooms } = useRoomStore()
  const totalArea = rooms.reduce((sum, r) => sum + r.width * r.height, 0)

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center px-4 gap-4 z-10 shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4">
        <div className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center">
          <Box size={14} className="text-white" />
        </div>
        <span className="font-semibold text-gray-900 text-sm">Interior AI</span>
      </div>

      {/* View toggle */}
      <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
        <button
          onClick={() => setViewMode('2d')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
            ${viewMode === '2d' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <PenLine size={12} />
          2D გეგმა
        </button>
        <button
          onClick={() => setViewMode('3d')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
            ${viewMode === '3d' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Box size={12} />
          3D ხედი
        </button>
      </div>

      {/* Room info */}
      <div className="text-xs text-gray-400 ml-2">
        {rooms.length} ოთახი · {totalArea.toFixed(1)}მ² სულ
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <button className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
        <Upload size={13} />
        2D ატვირთვა
      </button>
      <button className="flex items-center gap-1.5 bg-brand text-white text-xs px-3 py-2 rounded-lg hover:bg-brand-dark transition-colors font-medium">
        <Download size={13} />
        Export
      </button>
    </header>
  )
}