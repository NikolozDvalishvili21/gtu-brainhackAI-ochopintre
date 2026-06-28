'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRoomStore } from '@/lib/store/room-store'
import { Sparkles, Loader2, X, Download } from 'lucide-react'

function buildPrompt(): string {
  const s = useRoomStore.getState()
  const wallColors = new Set<string>()
  const wallpapers = new Set<string>()
  for (const a of Object.values(s.wallMaterials)) {
    if (a.color) wallColors.add(a.color.name)
    if (a.material) wallpapers.add(a.material.name)
  }
  const floors = new Set<string>()
  for (const m of Object.values(s.floorMaterials)) floors.add(m.name)
  const furniture = Array.from(new Set(s.furniture.map((f) => f.label)))

  const bits: string[] = []
  if (wallColors.size) bits.push(`კედლის ფერები: ${Array.from(wallColors).join(', ')}`)
  if (wallpapers.size) bits.push(`შპალერი: ${Array.from(wallpapers).join(', ')}`)
  if (floors.size) bits.push(`იატაკი: ${Array.from(floors).join(', ')}`)
  if (furniture.length) bits.push(`ავეჯი: ${furniture.join(', ')}`)
  return bits.length ? `გამოყენებული მასალები — ${bits.join('; ')}.` : ''
}

type Ref = { kind: 'wallpaper' | 'floor'; name: string; url: string }

function buildRefs(): Ref[] {
  const s = useRoomStore.getState()
  const byUrl = new Map<string, Ref>()
  for (const a of Object.values(s.wallMaterials)) {
    if (a.material?.image) {
      byUrl.set(a.material.image, { kind: 'wallpaper', name: a.material.name, url: a.material.image })
    }
  }
  for (const m of Object.values(s.floorMaterials)) {
    if (m.image) byUrl.set(m.image, { kind: 'floor', name: m.name, url: m.image })
  }
  return Array.from(byUrl.values())
}

function captureCanvas(): { base64: string; mimeType: string } {
  const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
  if (!canvas) throw new Error('3D სცენა ვერ მოიძებნა')
  const dataUrl = canvas.toDataURL('image/png')
  return { base64: dataUrl.split(',')[1], mimeType: 'image/png' }
}

export default function RenderButton() {
  const viewMode = useRoomStore((s) => s.viewMode)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const disabled = viewMode !== '3d'

  async function run() {
    setOpen(true)
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const { base64, mimeType } = captureCanvas()
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType, prompt: buildPrompt(), refs: buildRefs() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'რენდერი ვერ მოხერხდა')
      setResult(`data:image/png;base64,${data.image}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'შეცდომა')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={run}
        disabled={disabled || loading}
        title={disabled ? 'ჯერ გადადი 3D ხედზე' : 'ფოტორეალისტური რენდერი (AI)'}
        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
        რენდერი
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="relative w-full max-w-2xl rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <Sparkles size={15} className="text-fuchsia-600" />
                ფოტორეალისტური რენდერი
              </h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            <div className="flex min-h-[280px] items-center justify-center rounded-xl bg-gray-50">
              {loading && (
                <div className="flex flex-col items-center gap-3 py-12 text-gray-500">
                  <Loader2 size={28} className="animate-spin text-fuchsia-500" />
                  <p className="text-sm">AI ხატავს შენი ოთახის ფოტოს...</p>
                  <p className="text-xs text-gray-400">ჩვეულებრივ 5–10 წამი</p>
                </div>
              )}
              {error && <p className="px-6 py-12 text-center text-sm text-red-500">{error}</p>}
              {result && (
                <img src={result} alt="რენდერი" className="max-h-[70vh] w-full rounded-xl object-contain" />
              )}
            </div>

            {result && (
              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={run}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  თავიდან რენდერი
                </button>
                <a
                  href={result}
                  download="interior-render.png"
                  className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-white hover:bg-brand-dark"
                >
                  <Download size={13} /> ჩამოტვირთვა
                </a>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
