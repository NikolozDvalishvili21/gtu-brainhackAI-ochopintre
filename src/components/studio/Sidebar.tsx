'use client'
import { useState, useEffect } from 'react'
import { useRoomStore, WallColor, MaterialRef, type Crop, type WallMaterialAssignment } from '../../lib/store/room-store'
import CropEditor from './CropEditor'
import { Crop as CropIcon, Copy, ClipboardPaste, CopyCheck } from 'lucide-react'
import { FURNITURE_CATALOG_LIST } from '@/lib/constants/furniture-catalog'
import { placeSingleItem } from '@/lib/studio/furniture-layout'
import { Layers, Palette, Sofa, X, Loader2 } from 'lucide-react'
import { MaterialTile, MaterialDetail, TexRepeatSlider, TexRotationSlider } from './MaterialCard'

const BASE = 'https://interior-materials-api.onrender.com'

const FLOORS = [
  { id: 'parquet', label: 'პარკეტი', icon: '🪵' },
  { id: 'tile', label: 'ფილა', icon: '⬜' },
  { id: 'plain', label: 'ბეტონი', icon: '⬛' },
]

type Tab = 'walls' | 'floor' | 'furniture'

export default function Sidebar() {
  const {
    materials, setMaterials,
    addFurniture, furniture, removeFurniture,
    selectedFurnitureId, viewMode,
    selectedWallKey, wallMaterials,
    setWallMaterial, clearWallMaterial,
    selectedFloorRoomId, floorMaterials, setFloorMaterial, clearFloorMaterial,
    setWallTexRepeat, setFloorTexRepeat,
    setWallCrop, setFloorCrop,
    setWallTexRotation, setFloorTexRotation,
    applyWallToAll,
    rooms,
  } = useRoomStore()

  const [cropTarget, setCropTarget] = useState<
    { image: string; crop?: Crop; apply: (c: Crop) => void } | null
  >(null)
  const [wallClip, setWallClip] = useState<WallMaterialAssignment | null>(null)

  const [tab, setTab] = useState<Tab>('walls')
  const [wallColors, setWallColors] = useState<WallColor[]>([])
  const [loadingColors, setLoadingColors] = useState(false)
  const [wallpapers, setWallpapers] = useState<MaterialRef[]>([])
  const [floorList, setFloorList] = useState<MaterialRef[]>([])

  useEffect(() => {
    setLoadingColors(true)
    fetch(`${BASE}/colors`)
      .then(r => r.json())
      .then((data: Array<{ id: string; name: string; color: string }>) => {
        setWallColors(data.map(c => ({ id: c.id, name: c.name, color: c.color })))
      })
      .catch(() => {})
      .finally(() => setLoadingColors(false))

    // შპალერი (კედლის tab)
    fetch(`${BASE}/materials?category=wallpaper&limit=50`)
      .then(r => r.json())
      .then(d => setWallpapers((d.items ?? []).filter((m: MaterialRef) => m.image)))
      .catch(() => {})

    // იატაკის მასალები — ფილა + ლამინატი (ASCII slug-ები საიმედო matching-ისთვის)
    Promise.all([
      fetch(`${BASE}/materials?category=iatakis-da-kedlis-filebi&limit=24`).then(r => r.json()),
      fetch(`${BASE}/materials?category=floor-coverings/laminate-flooring&limit=24`).then(r => r.json()),
    ])
      .then(([a, b]) => {
        const items = [...(a.items ?? []), ...(b.items ?? [])].filter((m: MaterialRef) => m.image)
        setFloorList(items)
      })
      .catch(() => {})
  }, [])

  function handleAddFurniture(item: typeof FURNITURE_CATALOG_LIST[0]) {
    const firstRoom = rooms[0]
    const placeRoom = firstRoom
      ? { x: firstRoom.x, y: firstRoom.y, width: firstRoom.width, height: firstRoom.height }
      : { x: 0, y: 0, width: 6, height: 5 }

    const newItem = placeSingleItem(
      placeRoom,
      furniture,
      { type: item.type, label: item.label },
      Date.now().toString()
    )
    if (newItem) addFurniture(newItem)
  }

  const currentAssignment = selectedWallKey ? wallMaterials[selectedWallKey] : null
  const currentColor = currentAssignment?.color ?? null
  const currentMaterial = currentAssignment?.material ?? null
  const currentFloor = selectedFloorRoomId ? floorMaterials[selectedFloorRoomId] : null

  if (viewMode === '2d') return null

  return (
    <>
    <div className="w-72 h-full bg-white border-l border-gray-200 flex flex-col overflow-hidden">

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
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
              currentMaterial ? (
                <div className="space-y-3">
                  <MaterialDetail m={currentMaterial} onClear={() => clearWallMaterial(selectedWallKey)} />
                  <TexRepeatSlider
                    value={currentAssignment?.texRepeat ?? 2}
                    onChange={(n) => setWallTexRepeat(selectedWallKey, n)}
                  />
                  <TexRotationSlider
                    value={currentAssignment?.texRotation ?? 0}
                    onChange={(r) => setWallTexRotation(selectedWallKey, r)}
                  />
                  <button
                    onClick={() => setCropTarget({
                      image: currentMaterial!.image,
                      crop: currentAssignment?.crop,
                      apply: (c) => setWallCrop(selectedWallKey, c),
                    })}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <CropIcon size={13} /> პატერნის მოჭრა
                  </button>
                </div>
              ) : (
              <div className="bg-brand/5 border border-brand/20 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-brand">კედლის მხარე მონიშნულია</p>
                  {currentColor && (
                    <button
                      onClick={() => clearWallMaterial(selectedWallKey)}
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
                  <p className="text-xs text-gray-400">ქვემოდან აირჩიე ფერი ან შპალერი</p>
                )}
              </div>
              )
            ) : (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">3D-ში კლიკე კედლის მხარეზე</p>
                <p className="text-xs text-gray-300 mt-0.5">შემდეგ აირჩიე ფერი</p>
              </div>
            )}

            {/* ვიზუალის გადატანა სხვა კედლებზე */}
            {selectedWallKey && (currentColor || currentMaterial) && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => applyWallToAll(selectedWallKey)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-brand/10 py-2 text-xs font-medium text-brand hover:bg-brand/20"
                >
                  <CopyCheck size={13} /> ყველა კედელზე
                </button>
                <button
                  onClick={() => setWallClip(currentAssignment ?? null)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  <Copy size={13} /> კოპირება
                </button>
              </div>
            )}
            {selectedWallKey && wallClip && currentAssignment !== wallClip && (
              <button
                onClick={() => setWallMaterial(selectedWallKey, wallClip)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand/40 py-2 text-xs font-medium text-brand hover:bg-brand/5"
              >
                <ClipboardPaste size={13} /> ჩასმა აქ
              </button>
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
                          onClick={() => selectedWallKey && setWallMaterial(selectedWallKey, { color: c })}
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
                          onClick={() => selectedWallKey && setWallMaterial(selectedWallKey, { color: c })}
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

            {/* Wallpaper */}
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                შპალერი
              </p>
              {wallpapers.length === 0 ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={16} className="animate-spin text-gray-300" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-0.5">
                  {wallpapers.map(w => (
                    <MaterialTile
                      key={w.id}
                      m={w}
                      active={currentMaterial?.id === w.id}
                      disabled={!selectedWallKey}
                      onClick={() => selectedWallKey && setWallMaterial(selectedWallKey, { material: w })}
                    />
                  ))}
                </div>
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
          <div className="space-y-4">

            {/* Selected floor status */}
            {selectedFloorRoomId ? (
              currentFloor ? (
                <div className="space-y-3">
                  <MaterialDetail m={currentFloor} onClear={() => clearFloorMaterial(selectedFloorRoomId)} />
                  <TexRepeatSlider
                    value={currentFloor.texRepeat ?? 2}
                    onChange={(n) => setFloorTexRepeat(selectedFloorRoomId, n)}
                  />
                  <TexRotationSlider
                    value={currentFloor.texRotation ?? 0}
                    onChange={(r) => setFloorTexRotation(selectedFloorRoomId, r)}
                  />
                  <button
                    onClick={() => setCropTarget({
                      image: currentFloor!.image,
                      crop: currentFloor!.crop,
                      apply: (c) => setFloorCrop(selectedFloorRoomId, c),
                    })}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <CropIcon size={13} /> პატერნის მოჭრა
                  </button>
                </div>
              ) : (
                <div className="bg-brand/5 border border-brand/20 rounded-xl p-3">
                  <p className="text-xs font-semibold text-brand mb-1">იატაკი მონიშნულია</p>
                  <p className="text-xs text-gray-400">ქვემოდან აირჩიე მასალა</p>
                </div>
              )
            ) : (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">3D-ში კლიკე იატაკზე</p>
                <p className="text-xs text-gray-300 mt-0.5">შემდეგ აირჩიე მასალა</p>
              </div>
            )}

            {/* API floor materials */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                ფილა / ლამინატი
              </p>
              {floorList.length === 0 ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={16} className="animate-spin text-gray-300" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-0.5">
                  {floorList.map(m => (
                    <MaterialTile
                      key={m.id}
                      m={m}
                      active={currentFloor?.id === m.id}
                      disabled={!selectedFloorRoomId}
                      onClick={() => selectedFloorRoomId && setFloorMaterial(selectedFloorRoomId, m)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Procedural textures (global default) */}
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                ნაგულისხმევი ტექსტურა
              </p>
              {FLOORS.map(f => (
                <button key={f.id}
                  onClick={() => setMaterials({ floorTexture: f.id })}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left mb-2
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
          </div>
        )}

        {/* ── FURNITURE ── */}
        {tab === 'furniture' && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">ავეჯი დაამატე</p>
            <div className="grid grid-cols-2 gap-2">
              {FURNITURE_CATALOG_LIST.map(item => (
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

    {cropTarget && (
      <CropEditor
        image={cropTarget.image}
        initial={cropTarget.crop}
        onApply={cropTarget.apply}
        onClose={() => setCropTarget(null)}
      />
    )}
    </>
  )
}

// helper: is hex color dark?
function isDark(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 < 128
}