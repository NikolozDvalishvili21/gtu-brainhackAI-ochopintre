'use client'
import { useRef, useEffect, useState } from 'react'
import { useRoomStore } from '../store'

const SCALE = 60 // px per meter
const GRID = 0.5  // 0.5m grid

export default function Editor2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { room, setRoom, setRoomGenerated, setViewMode } = useRoomStore()
  const [width, setWidth] = useState(room.width)
  const [height, setHeight] = useState(room.height)
  const [dragging, setDragging] = useState(false)
  const [startCorner, setStartCorner] = useState<{x:number,y:number}|null>(null)

  const snap = (v: number) => Math.round(v / GRID) * GRID

  useEffect(() => {
    draw()
  }, [room, width, height])

  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)

    const offsetX = (W - room.width * SCALE) / 2
    const offsetY = (H - room.height * SCALE) / 2

    // Grid
    ctx.strokeStyle = '#E5E7EB'
    ctx.lineWidth = 0.5
    for (let x = 0; x <= room.width; x += GRID) {
      ctx.beginPath()
      ctx.moveTo(offsetX + x * SCALE, offsetY)
      ctx.lineTo(offsetX + x * SCALE, offsetY + room.height * SCALE)
      ctx.stroke()
    }
    for (let y = 0; y <= room.height; y += GRID) {
      ctx.beginPath()
      ctx.moveTo(offsetX, offsetY + y * SCALE)
      ctx.lineTo(offsetX + room.width * SCALE, offsetY + y * SCALE)
      ctx.stroke()
    }

    // Floor fill
    ctx.fillStyle = '#FEF9F3'
    ctx.fillRect(offsetX, offsetY, room.width * SCALE, room.height * SCALE)

    // Walls (thick border)
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 8
    ctx.strokeRect(offsetX, offsetY, room.width * SCALE, room.height * SCALE)

    // Dimensions
    ctx.fillStyle = '#6B7280'
    ctx.font = '12px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${room.width}m`, offsetX + room.width * SCALE / 2, offsetY - 10)
    ctx.save()
    ctx.translate(offsetX - 16, offsetY + room.height * SCALE / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(`${room.height}m`, 0, 0)
    ctx.restore()

    // Door indicator
    ctx.strokeStyle = '#2D6A4F'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 3])
    const doorX = offsetX + 1.5 * SCALE
    ctx.beginPath()
    ctx.moveTo(doorX, offsetY + room.height * SCALE)
    ctx.lineTo(doorX + 0.9 * SCALE, offsetY + room.height * SCALE)
    ctx.stroke()
    ctx.arc(doorX, offsetY + room.height * SCALE, 0.9 * SCALE, -Math.PI / 2, 0)
    ctx.stroke()
    ctx.setLineDash([])

    // Window indicator
    ctx.strokeStyle = '#60A5FA'
    ctx.lineWidth = 4
    const winX = offsetX + room.width * SCALE / 2 - 0.6 * SCALE
    ctx.beginPath()
    ctx.moveTo(winX, offsetY)
    ctx.lineTo(winX + 1.2 * SCALE, offsetY)
    ctx.stroke()

    // Compass
    ctx.fillStyle = '#2D6A4F'
    ctx.font = 'bold 14px Inter'
    ctx.textAlign = 'left'
    ctx.fillText('N ↑', offsetX + room.width * SCALE + 10, offsetY + 20)
  }

  function handleGenerate() {
    setRoom({ ...room, width, height, walls: [] })
    setRoomGenerated(true)
    setTimeout(() => setViewMode('3d'), 300)
  }

  return (
    <div className="flex flex-col items-center gap-4 h-full p-4">
      <div className="flex gap-4 items-center bg-white rounded-xl px-4 py-2 shadow-sm border border-gray-100">
        <label className="text-sm text-gray-600 font-medium">სიგანე (მ):</label>
        <input
          type="number" min={2} max={20} step={0.5} value={width}
          onChange={e => { setWidth(+e.target.value); setRoom({...room, width: +e.target.value}) }}
          className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center"
        />
        <label className="text-sm text-gray-600 font-medium">სიღრმე (მ):</label>
        <input
          type="number" min={2} max={20} step={0.5} value={height}
          onChange={e => { setHeight(+e.target.value); setRoom({...room, height: +e.target.value}) }}
          className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center"
        />
        <button
          onClick={handleGenerate}
          className="bg-brand text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors"
        >
          3D-ში გადასვლა →
        </button>
      </div>

      <div className="flex-1 w-full flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={700} height={500}
          className="bg-white rounded-2xl shadow-sm border border-gray-100"
        />
      </div>

      <p className="text-xs text-gray-400">
        ზომები შეცვალე და 3D-ში გადახვედი — ოთახი ავტომატურად გენერირდება
      </p>
    </div>
  )
}
