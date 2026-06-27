'use client'
import { useState, useEffect } from 'react'
import { useRoomStore, WallColor } from '../../lib/store/room-store'
import { Layers, Palette, Sofa, X, Loader2 } from 'lucide-react'

const BASE = 'https://interior-materials-api.onrender.com'

const FLOORS = [
  { id: 'parquet', label: 'პარკეტი', icon: '🪵' },
  { id: 'tile', label: 'ფილა', icon: '⬜' },
  { id: 'plain', label: 'ბეტონი', icon: '⬛' },
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
  const {
    materials, setMaterials,
    addFurniture, furniture, removeFurniture,
    selectedFurnitureId, viewMode,
    selectedWallKey, wallMaterials,
    setWallColor, clearWallColor,
    rooms,
  } = useRoomStore()

  const [tab, setTab] = useState<Tab>('walls')
  const [wallColors, setWallColors] = useState<WallColor[]>([])
  const [loadingColors, setLoadingColors] = useState(false)

  useEffect(() => {
    setLoadingColors(true)
    fetch(`${BASE}/colors`)
      .then(r => r.json())
      .then((data: Array<{ id: string; name: string; color: string }>) => {
        setWallColors(data.map(c => ({ id: c.id, name: c.name, color: c.color })))
      })
      .catch(() => {})
      .finally(() => setLoadingColors(false))
  }, [])

  function handleAddFurniture(item: typeof FURNITURE_CATALOG[0]) {
    const firstRoom = rooms[0]
    const cx = firstRoom ? firstRoom.x + firstRoom.width / 2 : 2
    const cz = firstRoom ? firstRoom.y + firstRoom.height / 2 : 2
    addFurniture({
      id: Date.now().toString(),
      type: item.type,
      label: item.label,
      x: cx + (Math.random() - 0.5) * 2,
      y: 0,
      z: cz + (Math.random() - 0.5) * 2,
      rotation: 0,
      width: item.width,
      depth: item.depth,
      height: item.height,
      color: item.color,
    })
  }

  const currentAssignment = selectedWallKey ? wallMaterials[selectedWallKey] : null
  const currentColor = currentAssignment?.color ?? null

  if (viewMode === '2d') return null

  return (
    <div className="w-72 h-full bg-white border-l border-gray-100 flex flex-col overflow-hidden">

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {([
          { id: 'walls', label: 'კედლები', icon: <Layers size={14} /> },
          { id: 'floor', label: 'იატაკი', icon: <Palette size={14} /> },
          { id: 'furniture', label: 'ავეჯი', icon: <Sofa size={14} /> },
        ] as { id: Tab; label: string; icon: React.ReactNode }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors
              ${tab === t.id ? 'text-brand border-b-2 border-brand' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">

        {/* ── WALLS ── */}
        {tab === 'walls' && (
          <div className="space-y-4">

            {/* Selected wall status */}
            {selectedWallKey ? (
              <div className="bg-brand/5 border border-brand/20 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-brand">კედელი მონიშნულია</p>
                  {currentColor && (
                    <button
                      onClick={() => clearWallColor(selectedWallKey)}
                      className="text-xs text-gray-400 hover:text-red-400 transition-colors">
                      გასუფთავება
                    </button>
                  )}
                </div>
                {currentColor ? (
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg border border-gray-200 shadow-sm flex-shrink-0"
                      style={{ background: currentColor.color }} />
                    <span className="text-xs text-gray-700">{currentColor.name}</span>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">ქვემოდან აირჩიე ფერი</p>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">3D-ში კლიკე კედელზე</p>
                <p className="text-xs text-gray-300 mt-0.5">შემდეგ აირჩიე ფერი</p>
              </div>
            )}

            {/* Color swatches */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                საღებავის ფერები
              </p>

              {loadingColors ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-gray-300" />
                </div>
              ) : (
                <>
                  {/* Grid swatches */}
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {wallColors.map(c => {
                      const isActive = currentColor?.id === c.id
                      return (
                        <button
                          key={c.id}
                          title={c.name}
                          disabled={!selectedWallKey}
                          onClick={() => selectedWallKey && setWallColor(selectedWallKey, c)}
                          className={`relative aspect-square rounded-lg border-2 transition-all
                            ${isActive
                              ? 'border-brand scale-110 shadow-md'
                              : 'border-gray-200 hover:border-gray-400 hover:scale-105'}
                            ${!selectedWallKey ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                          style={{ background: c.color }}
                        >
                          {isActive && (
                            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold drop-shadow"
                              style={{ color: isDark(c.color) ? '#fff' : '#1a1a1a' }}>
                              ✓
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* List with names */}
                  <div className="space-y-0.5 max-h-48 overflow-y-auto">
                    {wallColors.map(c => {
                      const isActive = currentColor?.id === c.id
                      return (
                        <button
                          key={c.id}
                          disabled={!selectedWallKey}
                          onClick={() => selectedWallKey && setWallColor(selectedWallKey, c)}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors text-left
                            ${isActive ? 'bg-brand/10 text-brand font-medium' : 'hover:bg-gray-50 text-gray-600'}
                            ${!selectedWallKey ? 'opacity-40 cursor-not-allowed' : ''}`}>
                          <div className="w-5 h-5 rounded-md border border-gray-200 flex-shrink-0 shadow-sm"
                            style={{ background: c.color }} />
                          <span className="truncate">{c.name}</span>
                          {isActive && <span className="ml-auto text-brand">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Ceiling color */}
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 font-medium mb-2">ჭერის ფერი</p>
              <div className="flex gap-2">
                {['#FFFFFF', '#F5F0EB', '#F0EBE0', '#E8E8E8'].map(c => (
                  <button key={c}
                    onClick={() => setMaterials({ ceilingColor: c })}
                    className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110
                      ${materials.ceilingColor === c ? 'border-brand scale-110' : 'border-gray-200'}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── FLOOR ── */}
        {tab === 'floor' && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">იატაკის მასალა</p>
            {FLOORS.map(f => (
              <button key={f.id}
                onClick={() => setMaterials({ floorTexture: f.id })}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left
                  ${materials.floorTexture === f.id ? 'border-brand bg-green-50' : 'border-gray-100 hover:border-gray-200'}`}>
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg">
                  {f.icon}
                </div>
                <span className="text-sm font-medium text-gray-700">{f.label}</span>
                {materials.floorTexture === f.id && (
                  <span className="ml-auto text-brand text-xs font-medium">✓</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── FURNITURE ── */}
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
                      <span className="text-gray-700 text-xs">{f.label}</span>
                      <button onClick={() => removeFurniture(f.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors ml-2">
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

// helper: is hex color dark?
function isDark(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 < 128
}