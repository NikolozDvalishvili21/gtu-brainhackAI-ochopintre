'use client'
import { useRef, useState } from 'react'
import { Check, X, Maximize } from 'lucide-react'
import type { Crop } from '@/lib/store/room-store'

const API_BASE = 'https://interior-materials-api.onrender.com'
const proxied = (url: string) =>
  url.startsWith('http') ? `${API_BASE}/img?url=${encodeURIComponent(url)}` : url

const MIN = 0.08
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

const HANDLES: [string, string][] = [
  ['nw', 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize'],
  ['ne', 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize'],
  ['sw', 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize'],
  ['se', 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize'],
]

export default function CropEditor({
  image, initial, onApply, onClose,
}: {
  image: string
  initial?: Crop
  onApply: (c: Crop) => void
  onClose: () => void
}) {
  const [rect, setRect] = useState<Crop>(initial ?? { x: 0.12, y: 0.12, w: 0.76, h: 0.76 })
  const boxRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ mode: string; sx: number; sy: number; start: Crop } | null>(null)

  function start(e: React.PointerEvent, mode: string) {
    e.preventDefault()
    e.stopPropagation()
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: rect }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  function move(e: React.PointerEvent) {
    const d = drag.current
    const b = boxRef.current?.getBoundingClientRect()
    if (!d || !b) return
    const dx = (e.clientX - d.sx) / b.width
    const dy = (e.clientY - d.sy) / b.height
    const s = d.start
    let { x, y, w, h } = s
    const m = d.mode
    if (m === 'move') {
      x = clamp(s.x + dx, 0, 1 - s.w)
      y = clamp(s.y + dy, 0, 1 - s.h)
    } else {
      if (m.includes('e')) w = clamp(s.w + dx, MIN, 1 - s.x)
      if (m.includes('s')) h = clamp(s.h + dy, MIN, 1 - s.y)
      if (m.includes('w')) {
        const nx = clamp(s.x + dx, 0, s.x + s.w - MIN)
        w = s.w + (s.x - nx)
        x = nx
      }
      if (m.includes('n')) {
        const ny = clamp(s.y + dy, 0, s.y + s.h - MIN)
        h = s.h + (s.y - ny)
        y = ny
      }
    }
    setRect({ x, y, w, h })
  }

  const end = () => { drag.current = null }
  const pct = (v: number) => `${v * 100}%`

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">პატერნის მოჭრა</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        <p className="mb-3 text-xs text-gray-400">გადაიტანე ან გაწიე ჩარჩო — გამოყენდება მხოლოდ შიდა ნაწილი (თეთრი კიდის გარეშე).</p>

        <div
          ref={boxRef}
          className="relative w-full select-none touch-none overflow-hidden rounded-xl bg-gray-100"
          style={{ aspectRatio: '1 / 1' }}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        >
          <img src={proxied(image)} alt="" draggable={false}
            className="pointer-events-none h-full w-full object-contain" />
          <div
            className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
            style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}
            onPointerDown={(e) => start(e, 'move')}
          >
            {HANDLES.map(([id, cls]) => (
              <span key={id} onPointerDown={(e) => start(e, id)}
                className={`absolute h-3.5 w-3.5 rounded-full border-2 border-fuchsia-600 bg-white ${cls}`} />
            ))}
          </div>
        </div>

        <div className="mt-3 flex justify-between">
          <button onClick={() => setRect({ x: 0, y: 0, w: 1, h: 1 })}
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50">
            <Maximize size={13} /> სრული
          </button>
          <button onClick={() => { onApply(rect); onClose() }}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white hover:bg-brand-dark">
            <Check size={14} /> გამოყენება
          </button>
        </div>
      </div>
    </div>
  )
}
