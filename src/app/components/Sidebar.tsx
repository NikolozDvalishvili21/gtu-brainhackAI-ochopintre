'use client'
import { useState } from 'react'
import { useRoomStore, Furniture } from '../store'
import { Armchair, Sofa, BedDouble, TreePine, UtensilsCrossed, Palette, Layers, X } from 'lucide-react'

const WALLPAPERS = [
  { id: 'plain', label: 'გლუვი', colors: ['#F5F0EB', '#E8E2DA', '#D4C5B0', '#C9D8C5', '#C5C9D8', '#D8C5C5'] },
  { id: 'wallpaper-stripe', label: 'ზოლები', colors: ['#F5F0EB', '#E8D5C4', '#D4E8D4', '#D4D4E8'] },
  { id: 'wallpaper-dots', label: 'წერტილები', colors: ['#F5F0EB', '#FCF3E8', '#E8F3FC', '#F3E8FC'] },
]

const FLOORS = [
  { id: 'parquet', label: 'პარკეტი' },
  { id: 'tile', label: 'ფილა' },
  { id: 'plain', label: 'ბეტონი' },
]

const FURNITURE_CATALOG = [
  { type: 'sofa', label: 'დივანი', icon: '🛋️', width: 2.2, depth: 0.9, height: 0.8, color: '#8B7355' },
  { type: 'chair', label: 'სავარძელი', icon: '🪑', width: 0.6, depth: 0.6, height: 0.9, color: '#6B5B45' },
  { type: 'table', label: 'მაგიდა', icon: '🪵', width: 1.2, depth: 0.7, height: 0.75, color: '#C8A882' },
  { type: 'bed', label: 'საწოლი', icon: '🛏️', width: 1.6, depth: 2.1, height: 0.5, color: '#E8DDD0' },
  { type: 'plant', label: 'მცენარე', icon: '🌿', width: 0.4, depth: 0.4, height: 1.0, color: '#2D6A4F' },
  { type: 'wardrobe', label: 'კარადა', icon: '🚪', width: 1.8, depth: 0.6, height: 2.2, color: '#D4B896' },
  { type: 'desk', label: 'წერის მაგიდა', icon: '🖥️', width: 1.4, depth: 0.7, height: 0.75, color: '#E8C99A' },
  { type: 'lamp', label: 'ნათება', icon: '💡', width: 0.3, depth: 0.3, height: 1.6, color: '#F5F0EB' },
]

type Tab = 'walls' | 'floor' | 'furniture'

export default function Sidebar() {
  const { materials, setMaterials, addFurniture, room, furniture, selectedFurnitureId, removeFurniture, viewMode } = useRoomStore()
  const [tab, setTab] = useState<Tab>('walls')

  function handleAddFurniture(item: typeof FURNITURE_CATALOG[0]) {
    const newItem: Furniture = {
      id: Date.now().toString(),
      type: item.type,
      label: item.label,
      x: (Math.random() - 0.5) * (room.width - item.width - 0.5),
      y: 0,
      z: (Math.random() - 0.5) * (room.height - item.depth - 0.5),
      rotation: 0,
      width: item.width,
      depth: item.depth,
      height: item.height,
      color: item.color,
    }
    addFurniture(newItem)
  }

  if (viewMode === '2d') return null

  return (
    <div className="w-72 h-full bg-white border-l border-gray-100 flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {([
          { id: 'walls', label: 'კედლები', icon: <Layers size={14} /> },
          { id: 'floor', label: 'იატაკი', icon: <Palette size={14} /> },
          { id: 'furniture', label: 'ავეჯი', icon: <Sofa size={14} /> },
        ] as {id: Tab, label: string, icon: React.ReactNode}[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors
              ${tab === t.id ? 'text-brand border-b-2 border-brand' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">

        {tab === 'walls' && (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">შპალერი / ფერი</p>
            {WALLPAPERS.map(wp => (
              <div key={wp.id}>
                <p className="text-xs text-gray-600 mb-2">{wp.label}</p>
                <div className="flex flex-wrap gap-2">
                  {wp.colors.map(color => (
                    <button key={color}
                      onClick={() => setMaterials({ wallTexture: wp.id, wallColor: color })}
                      className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110
                        ${materials.wallColor === color && materials.wallTexture === wp.id
                          ? 'border-brand scale-110' : 'border-gray-200'}`}
                      style={{ background: color }}
                    />
                  ))}
                </div>
              </div>
            ))}

            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-600 mb-2">ჭერის ფერი</p>
              <div className="flex gap-2">
                {['#FFFFFF', '#F5F0EB', '#F0EBE0', '#E8E8E8'].map(c => (
                  <button key={c} onClick={() => setMaterials({ ceilingColor: c })}
                    className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110
                      ${materials.ceilingColor === c ? 'border-brand scale-110' : 'border-gray-200'}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 border border-gray-100">
              <p className="font-medium text-gray-700 mb-1">პარტნიორები</p>
              <p className="mb-2">შპალერი ჩვენი პარტნიორი კომპანიებისგან:</p>
              {['Dekor+', 'WallArt GE', 'InteriorPro'].map(p => (
                <div key={p} className="flex items-center justify-between py-1">
                  <span>{p}</span>
                  <span className="text-brand cursor-pointer hover:underline">კატალოგი →</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'floor' && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">იატაკის მასალა</p>
            {FLOORS.map(f => (
              <button key={f.id} onClick={() => setMaterials({ floorTexture: f.id })}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left
                  ${materials.floorTexture === f.id ? 'border-brand bg-green-50' : 'border-gray-100 hover:border-gray-200'}`}>
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg">
                  {f.id === 'parquet' ? '🪵' : f.id === 'tile' ? '⬜' : '⬛'}
                </div>
                <span className="text-sm font-medium text-gray-700">{f.label}</span>
                {materials.floorTexture === f.id && <span className="ml-auto text-brand text-xs">✓</span>}
              </button>
            ))}

            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 border border-gray-100 mt-4">
              <p className="font-medium text-gray-700 mb-1">პარტნიორები</p>
              {['FloorMaster', 'Parquet GE', 'TileWorld'].map(p => (
                <div key={p} className="flex items-center justify-between py-1">
                  <span>{p}</span>
                  <span className="text-brand cursor-pointer hover:underline">კატალოგი →</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'furniture' && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">ავეჯი დაამატე</p>
            <div className="grid grid-cols-2 gap-2">
              {FURNITURE_CATALOG.map(item => (
                <button key={item.type}
                  onClick={() => handleAddFurniture(item)}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl border border-gray-100 hover:border-brand hover:bg-green-50 transition-all text-center">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-xs text-gray-600 font-medium">{item.label}</span>
                </button>
              ))}
            </div>

            {furniture.length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">ოთახში</p>
                <div className="space-y-1">
                  {furniture.map(f => (
                    <div key={f.id}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors
                        ${selectedFurnitureId === f.id ? 'bg-green-50 border border-brand' : 'hover:bg-gray-50'}`}>
                      <span className="text-gray-700">{f.label}</span>
                      <button onClick={() => removeFurniture(f.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
