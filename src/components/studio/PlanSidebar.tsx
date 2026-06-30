'use client'
import { useEffect, useState } from 'react'
import { usePlanStore } from '@/lib/store/plan-store'

const BASE = 'https://interior-materials-api.onrender.com'

export default function PlanSidebar() {
  const { selected, paintWall, paintFloor } = usePlanStore()
  const [colors, setColors] = useState<{ id: string; name: string; color: string }[]>([])

  useEffect(() => {
    fetch(`${BASE}/colors`)
      .then((r) => r.json())
      .then((d) => setColors(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  const apply = (hex: string) => {
    if (!selected) return
    if (selected.type === 'wall') paintWall(selected.id, hex)
    else paintFloor(selected.id, hex)
  }

  return (
    <div className="absolute right-3 top-16 z-30 w-60 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur">
      <p className="mb-2 text-xs font-semibold text-gray-700">
        {selected
          ? selected.type === 'wall'
            ? '🧱 კედელი მონიშნულია'
            : '🪵 იატაკი მონიშნულია'
          : 'მონიშნე კედელი ან იატაკი'}
      </p>
      <p className="mb-2 text-[11px] text-gray-400">3D-ში დააკლიკე ზედაპირს → აირჩიე ფერი</p>
      <div className="grid grid-cols-5 gap-2">
        {colors.map((c) => (
          <button
            key={c.id}
            title={c.name}
            disabled={!selected}
            onClick={() => apply(c.color)}
            className={`aspect-square rounded-lg border-2 border-gray-200 transition-transform ${
              selected ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed opacity-40'
            }`}
            style={{ background: c.color }}
          />
        ))}
      </div>
    </div>
  )
}
