'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import { useRoomStore, type Door, type RoomShape, type Tool } from '@/lib/store/room-store'

const SCALE = 70
const GRID = 0.5
const WALL_T = 8
const CANVAS_W = 900
const CANVAS_H = 620
const MIN_ZOOM = 0.4
const MAX_ZOOM = 3.0

type DrawState =
  | { phase: 'idle' }
  | { phase: 'drawing-room'; x1: number; y1: number; x2: number; y2: number }
  | { phase: 'drawing-partition'; x1: number; y1: number; x2: number; y2: number }
  | { phase: 'placing-door' | 'placing-window'; preview: { roomId: string; side: Door['wallSide']; offset: number } | null }

type DragState = { id: string; type: 'room'; startX: number; startY: number; origX: number; origY: number } | null
type PanState = { startX: number; startY: number; origPanX: number; origPanY: number } | null

function snapV(v: number) { return Math.round(v / GRID) * GRID }
function toPx(m: number) { return m * SCALE }

export default function Editor2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const store = useRoomStore()
  const {
    rooms, partitions, doors, windows, activeTool, setActiveTool,
    addRoom, updateRoom, removeRoom, addPartition, removePartition,
    addDoor, removeDoor, addWindow, removeWindow,
    selectedId, selectedType, setSelected, setViewMode, setRoomGenerated,
    clearAll,
  } = store

  const [drawState, setDrawState] = useState<DrawState>({ phase: 'idle' })
  const [drag, setDrag] = useState<DragState>(null)
  const [pan, setPan] = useState<PanState>(null)
  const [panOffset, setPanOffset] = useState({ x: 40, y: 40 })
  const [zoom, setZoom] = useState(1)
  const [mouseM, setMouseM] = useState<{ x: number; y: number } | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  function canvasToMeters(cx: number, cy: number) {
    return {
      x: snapV((cx - panOffset.x) / (SCALE * zoom)),
      y: snapV((cy - panOffset.y) / (SCALE * zoom)),
    }
  }

  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { cx: e.clientX - rect.left, cy: e.clientY - rect.top }
  }

  function wx(m: number) { return m * SCALE * zoom + panOffset.x }
  function wy(m: number) { return m * SCALE * zoom + panOffset.y }
  function ws(m: number) { return m * SCALE * zoom }

  function hitWall(cx: number, cy: number): { roomId: string; side: Door['wallSide']; offset: number } | null {
    const THRESH = 14
    for (const room of rooms) {
      const rx = wx(room.x), ry = wy(room.y), rw = ws(room.width), rh = ws(room.height)
      if (Math.abs(cy - ry) < THRESH && cx >= rx && cx <= rx + rw)
        return { roomId: room.id, side: 'top', offset: snapV((cx - rx) / (SCALE * zoom)) }
      if (Math.abs(cy - (ry + rh)) < THRESH && cx >= rx && cx <= rx + rw)
        return { roomId: room.id, side: 'bottom', offset: snapV((cx - rx) / (SCALE * zoom)) }
      if (Math.abs(cx - rx) < THRESH && cy >= ry && cy <= ry + rh)
        return { roomId: room.id, side: 'left', offset: snapV((cy - ry) / (SCALE * zoom)) }
      if (Math.abs(cx - (rx + rw)) < THRESH && cy >= ry && cy <= ry + rh)
        return { roomId: room.id, side: 'right', offset: snapV((cy - ry) / (SCALE * zoom)) }
    }
    return null
  }

  function hitRoom(cx: number, cy: number): string | null {
    const m = canvasToMeters(cx, cy)
    for (const r of [...rooms].reverse()) {
      if (m.x >= r.x && m.x <= r.x + r.width && m.y >= r.y && m.y <= r.y + r.height)
        return r.id
    }
    return null
  }

  function hitPartition(cx: number, cy: number): string | null {
    const THRESH = 8
    for (const p of partitions) {
      const px1 = wx(p.x1), py1 = wy(p.y1), px2 = wx(p.x2), py2 = wy(p.y2)
      const len = Math.sqrt((px2 - px1) ** 2 + (py2 - py1) ** 2)
      if (len === 0) continue
      const t = Math.max(0, Math.min(1, ((cx - px1) * (px2 - px1) + (cy - py1) * (py2 - py1)) / (len * len)))
      const dx = cx - (px1 + t * (px2 - px1)), dy = cy - (py1 + t * (py2 - py1))
      if (Math.sqrt(dx * dx + dy * dy) < THRESH) return p.id
    }
    return null
  }

  function hitDoor(cx: number, cy: number): string | null {
    for (const d of doors) {
      const room = rooms.find(r => r.id === d.roomId); if (!room) continue
      const pos = getDoorCenter(room, d)
      if (Math.abs(cx - pos.cx) < 20 && Math.abs(cy - pos.cy) < 20) return d.id
    }
    return null
  }

  function hitWindow(cx: number, cy: number): string | null {
    for (const w of windows) {
      const room = rooms.find(r => r.id === w.roomId); if (!room) continue
      const pos = getWindowCenter(room, w)
      if (Math.abs(cx - pos.cx) < 20 && Math.abs(cy - pos.cy) < 20) return w.id
    }
    return null
  }

  function getDoorCenter(room: RoomShape, d: Door) {
    const rx = wx(room.x), ry = wy(room.y), rw = ws(room.width), rh = ws(room.height)
    switch (d.wallSide) {
      case 'top': return { cx: rx + ws(d.offset) + ws(d.width) / 2, cy: ry }
      case 'bottom': return { cx: rx + ws(d.offset) + ws(d.width) / 2, cy: ry + rh }
      case 'left': return { cx: rx, cy: ry + ws(d.offset) + ws(d.width) / 2 }
      case 'right': return { cx: rx + rw, cy: ry + ws(d.offset) + ws(d.width) / 2 }
    }
  }

  function getWindowCenter(room: RoomShape, w: { wallSide: Door['wallSide']; offset: number; width: number }) {
    const rx = wx(room.x), ry = wy(room.y), rw = ws(room.width), rh = ws(room.height)
    switch (w.wallSide) {
      case 'top': return { cx: rx + ws(w.offset) + ws(w.width) / 2, cy: ry }
      case 'bottom': return { cx: rx + ws(w.offset) + ws(w.width) / 2, cy: ry + rh }
      case 'left': return { cx: rx, cy: ry + ws(w.offset) + ws(w.width) / 2 }
      case 'right': return { cx: rx + rw, cy: ry + ws(w.offset) + ws(w.width) / 2 }
    }
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

    ctx.fillStyle = '#F8F7F4'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    // Grid
    const gridPx = GRID * SCALE * zoom
    ctx.strokeStyle = zoom > 1.5 ? '#DCDBD7' : '#E5E7EB'
    ctx.lineWidth = 0.5
    const startX = ((panOffset.x % gridPx) + gridPx) % gridPx
    const startY = ((panOffset.y % gridPx) + gridPx) % gridPx
    for (let x = startX; x < CANVAS_W; x += gridPx) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke()
    }
    for (let y = startY; y < CANVAS_H; y += gridPx) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke()
    }

    // Rooms
    for (const room of rooms) {
      const rx = wx(room.x), ry = wy(room.y), rw = ws(room.width), rh = ws(room.height)
      const isSel = selectedId === room.id && selectedType === 'room'

      ctx.fillStyle = room.color
      ctx.fillRect(rx, ry, rw, rh)

      ctx.strokeStyle = isSel ? '#2D6A4F' : '#1a1a1a'
      ctx.lineWidth = (isSel ? WALL_T + 2 : WALL_T) * zoom
      ctx.strokeRect(rx, ry, rw, rh)

      if (zoom > 0.5) {
        ctx.fillStyle = '#6B7280'
        ctx.font = `${11 * zoom}px Inter, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(room.label, rx + rw / 2, ry + rh / 2)
        ctx.fillStyle = '#9CA3AF'
        ctx.fillText(`${room.width}მ`, rx + rw / 2, ry - 8 * zoom)
        ctx.save()
        ctx.translate(rx - 12 * zoom, ry + rh / 2)
        ctx.rotate(-Math.PI / 2)
        ctx.fillText(`${room.height}მ`, 0, 0)
        ctx.restore()
      }

      if (isSel) {
        ctx.fillStyle = '#2D6A4F'
        for (const [hx, hy] of [[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]]) {
          ctx.beginPath(); ctx.arc(hx as number, hy as number, 5, 0, Math.PI * 2); ctx.fill()
        }
      }
    }

    // Partitions
    for (const p of partitions) {
      const isSel = selectedId === p.id && selectedType === 'partition'
      ctx.strokeStyle = isSel ? '#2D6A4F' : '#374151'
      ctx.lineWidth = (isSel ? 7 : 5) * zoom
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(wx(p.x1), wy(p.y1))
      ctx.lineTo(wx(p.x2), wy(p.y2))
      ctx.stroke()
    }

    // Doors
    for (const d of doors) {
      const room = rooms.find(r => r.id === d.roomId); if (!room) continue
      const rx = wx(room.x), ry = wy(room.y), rw = ws(room.width), rh = ws(room.height)
      const dw = ws(d.width), wallT = WALL_T * zoom
      const isSel = selectedId === d.id && selectedType === 'door'
      ctx.save()
      ctx.strokeStyle = isSel ? '#2D6A4F' : '#15803D'
      ctx.lineWidth = 2 * zoom
      switch (d.wallSide) {
        case 'top': {
          const dx = rx + ws(d.offset)
          ctx.fillStyle = '#F8F7F4'; ctx.fillRect(dx, ry - wallT / 2, dw, wallT + 1)
          ctx.setLineDash([4, 3])
          ctx.beginPath(); ctx.moveTo(dx, ry); ctx.lineTo(dx, ry - dw); ctx.stroke()
          ctx.beginPath(); ctx.arc(dx, ry, dw, -Math.PI / 2, 0); ctx.stroke()
          break
        }
        case 'bottom': {
          const dx = rx + ws(d.offset)
          ctx.fillStyle = '#F8F7F4'; ctx.fillRect(dx, ry + rh - wallT / 2, dw, wallT + 1)
          ctx.setLineDash([4, 3])
          ctx.beginPath(); ctx.moveTo(dx, ry + rh); ctx.lineTo(dx, ry + rh + dw); ctx.stroke()
          ctx.beginPath(); ctx.arc(dx, ry + rh, dw, 0, Math.PI / 2); ctx.stroke()
          break
        }
        case 'left': {
          const dy = ry + ws(d.offset)
          ctx.fillStyle = '#F8F7F4'; ctx.fillRect(rx - wallT / 2, dy, wallT + 1, dw)
          ctx.setLineDash([4, 3])
          ctx.beginPath(); ctx.moveTo(rx, dy); ctx.lineTo(rx - dw, dy); ctx.stroke()
          ctx.beginPath(); ctx.arc(rx, dy, dw, Math.PI, Math.PI * 3 / 2); ctx.stroke()
          break
        }
        case 'right': {
          const dy = ry + ws(d.offset)
          ctx.fillStyle = '#F8F7F4'; ctx.fillRect(rx + rw - wallT / 2, dy, wallT + 1, dw)
          ctx.setLineDash([4, 3])
          ctx.beginPath(); ctx.moveTo(rx + rw, dy); ctx.lineTo(rx + rw + dw, dy); ctx.stroke()
          ctx.beginPath(); ctx.arc(rx + rw, dy, dw, -Math.PI, -Math.PI / 2); ctx.stroke()
          break
        }
      }
      ctx.setLineDash([])
      ctx.restore()
    }

    // Windows
    for (const w of windows) {
      const room = rooms.find(r => r.id === w.roomId); if (!room) continue
      const rx = wx(room.x), ry = wy(room.y), rw = ws(room.width), rh = ws(room.height)
      const ww = ws(w.width), wallT = WALL_T * zoom
      const isSel = selectedId === w.id && selectedType === 'window'
      ctx.save()
      switch (w.wallSide) {
        case 'top': {
          const wsx = rx + ws(w.offset)
          ctx.fillStyle = '#F8F7F4'; ctx.fillRect(wsx, ry - wallT / 2, ww, wallT + 1)
          ctx.strokeStyle = '#93C5FD'; ctx.lineWidth = 4 * zoom
          ctx.beginPath(); ctx.moveTo(wsx, ry); ctx.lineTo(wsx + ww, ry); ctx.stroke()
          ctx.strokeStyle = isSel ? '#2D6A4F' : '#3B82F6'; ctx.lineWidth = 1.5 * zoom
          ctx.beginPath(); ctx.moveTo(wsx, ry - 3); ctx.lineTo(wsx + ww, ry - 3); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(wsx, ry + 3); ctx.lineTo(wsx + ww, ry + 3); ctx.stroke()
          break
        }
        case 'bottom': {
          const wsx = rx + ws(w.offset)
          ctx.fillStyle = '#F8F7F4'; ctx.fillRect(wsx, ry + rh - wallT / 2, ww, wallT + 1)
          ctx.strokeStyle = '#93C5FD'; ctx.lineWidth = 4 * zoom
          ctx.beginPath(); ctx.moveTo(wsx, ry + rh); ctx.lineTo(wsx + ww, ry + rh); ctx.stroke()
          ctx.strokeStyle = isSel ? '#2D6A4F' : '#3B82F6'; ctx.lineWidth = 1.5 * zoom
          ctx.beginPath(); ctx.moveTo(wsx, ry + rh - 3); ctx.lineTo(wsx + ww, ry + rh - 3); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(wsx, ry + rh + 3); ctx.lineTo(wsx + ww, ry + rh + 3); ctx.stroke()
          break
        }
        case 'left': {
          const wsy = ry + ws(w.offset)
          ctx.fillStyle = '#F8F7F4'; ctx.fillRect(rx - wallT / 2, wsy, wallT + 1, ww)
          ctx.strokeStyle = '#93C5FD'; ctx.lineWidth = 4 * zoom
          ctx.beginPath(); ctx.moveTo(rx, wsy); ctx.lineTo(rx, wsy + ww); ctx.stroke()
          ctx.strokeStyle = isSel ? '#2D6A4F' : '#3B82F6'; ctx.lineWidth = 1.5 * zoom
          ctx.beginPath(); ctx.moveTo(rx - 3, wsy); ctx.lineTo(rx - 3, wsy + ww); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(rx + 3, wsy); ctx.lineTo(rx + 3, wsy + ww); ctx.stroke()
          break
        }
        case 'right': {
          const wsy = ry + ws(w.offset)
          ctx.fillStyle = '#F8F7F4'; ctx.fillRect(rx + rw - wallT / 2, wsy, wallT + 1, ww)
          ctx.strokeStyle = '#93C5FD'; ctx.lineWidth = 4 * zoom
          ctx.beginPath(); ctx.moveTo(rx + rw, wsy); ctx.lineTo(rx + rw, wsy + ww); ctx.stroke()
          ctx.strokeStyle = isSel ? '#2D6A4F' : '#3B82F6'; ctx.lineWidth = 1.5 * zoom
          ctx.beginPath(); ctx.moveTo(rx + rw - 3, wsy); ctx.lineTo(rx + rw - 3, wsy + ww); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(rx + rw + 3, wsy); ctx.lineTo(rx + rw + 3, wsy + ww); ctx.stroke()
          break
        }
      }
      ctx.restore()
    }

    // Drawing preview
    if (drawState.phase === 'drawing-room' || drawState.phase === 'drawing-partition') {
      const { x1, y1, x2, y2 } = drawState
      ctx.strokeStyle = '#2D6A4F'; ctx.lineWidth = 2; ctx.setLineDash([6, 3])
      if (drawState.phase === 'drawing-room') {
        const rx = wx(Math.min(x1, x2)), ry = wy(Math.min(y1, y2))
        const rw = ws(Math.abs(x2 - x1)), rh = ws(Math.abs(y2 - y1))
        ctx.fillStyle = 'rgba(45,106,79,0.06)'; ctx.fillRect(rx, ry, rw, rh)
        ctx.strokeRect(rx, ry, rw, rh)
        ctx.setLineDash([])
        ctx.fillStyle = '#6B7280'; ctx.font = '11px Inter'; ctx.textAlign = 'center'
        ctx.fillText(`${Math.abs(x2 - x1).toFixed(1)}×${Math.abs(y2 - y1).toFixed(1)}მ`, rx + rw / 2, ry - 8)
      } else {
        ctx.beginPath(); ctx.moveTo(wx(x1), wy(y1)); ctx.lineTo(wx(x2), wy(y2)); ctx.stroke()
      }
      ctx.setLineDash([])
    }

    // Door/window hover
    if ((drawState.phase === 'placing-door' || drawState.phase === 'placing-window') && drawState.preview) {
      const { roomId, side, offset } = drawState.preview
      const room = rooms.find(r => r.id === roomId)
      if (room) {
        const rx = wx(room.x), ry = wy(room.y), rw = ws(room.width), rh = ws(room.height)
        const size = ws(drawState.phase === 'placing-door' ? 0.9 : 1.2)
        ctx.fillStyle = drawState.phase === 'placing-door' ? 'rgba(21,128,61,0.3)' : 'rgba(59,130,246,0.3)'
        switch (side) {
          case 'top': ctx.fillRect(rx + ws(offset), ry - 4, size, 8); break
          case 'bottom': ctx.fillRect(rx + ws(offset), ry + rh - 4, size, 8); break
          case 'left': ctx.fillRect(rx - 4, ry + ws(offset), 8, size); break
          case 'right': ctx.fillRect(rx + rw - 4, ry + ws(offset), 8, size); break
        }
      }
    }

    // Crosshair
    if (mouseM && (activeTool === 'room' || activeTool === 'partition')) {
      const cx = wx(mouseM.x), cy = wy(mouseM.y)
      ctx.strokeStyle = 'rgba(45,106,79,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3])
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, CANVAS_H); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(CANVAS_W, cy); ctx.stroke()
      ctx.setLineDash([])
    }

    ctx.fillStyle = '#9CA3AF'; ctx.font = '11px Inter'; ctx.textAlign = 'right'
    ctx.fillText(`${Math.round(zoom * 100)}%`, CANVAS_W - 8, CANVAS_H - 8)
    ctx.fillStyle = '#9CA3AF'; ctx.font = 'bold 12px Inter'; ctx.textAlign = 'left'
    ctx.fillText('N ↑', CANVAS_W - 44, 24)

  }, [rooms, partitions, doors, windows, drawState, selectedId, selectedType, mouseM, activeTool, zoom, panOffset])

  useEffect(() => { draw() }, [draw])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setZoom(z => {
        const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * delta))
        setPanOffset(p => ({
          x: cx - (cx - p.x) * (nz / z),
          y: cy - (cy - p.y) * (nz / z),
        }))
        return nz
      })
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const { cx, cy } = getCanvasPos(e)
    const m = canvasToMeters(cx, cy)

    if (activeTool === 'select') {
      const dId = hitDoor(cx, cy); if (dId) { setSelected(dId, 'door'); return }
      const wId = hitWindow(cx, cy); if (wId) { setSelected(wId, 'window'); return }
      const pId = hitPartition(cx, cy); if (pId) { setSelected(pId, 'partition'); return }
      const rId = hitRoom(cx, cy)
      if (rId) {
        setSelected(rId, 'room')
        const room = rooms.find(r => r.id === rId)!
        setDrag({ id: rId, type: 'room', startX: cx, startY: cy, origX: room.x, origY: room.y })
        return
      }
      setPan({ startX: cx, startY: cy, origPanX: panOffset.x, origPanY: panOffset.y })
      setSelected(null, null)
      return
    }

    if (activeTool === 'erase') {
      const dId = hitDoor(cx, cy); if (dId) { removeDoor(dId); return }
      const wId = hitWindow(cx, cy); if (wId) { removeWindow(wId); return }
      const pId = hitPartition(cx, cy); if (pId) { removePartition(pId); return }
      const rId = hitRoom(cx, cy); if (rId) { removeRoom(rId); setSelected(null, null); return }
      return
    }

    if (activeTool === 'room') {
      setDrawState({ phase: 'drawing-room', x1: m.x, y1: m.y, x2: m.x, y2: m.y }); return
    }
    if (activeTool === 'partition') {
      setDrawState({ phase: 'drawing-partition', x1: m.x, y1: m.y, x2: m.x, y2: m.y }); return
    }
    if (activeTool === 'door') {
      const hit = hitWall(cx, cy)
      if (hit) { addDoor({ id: Date.now().toString(), wallSide: hit.side, roomId: hit.roomId, offset: hit.offset, width: 0.9, opensInward: true }); setActiveTool('select') }
      return
    }
    if (activeTool === 'window') {
      const hit = hitWall(cx, cy)
      if (hit) { addWindow({ id: Date.now().toString(), wallSide: hit.side, roomId: hit.roomId, offset: hit.offset, width: 1.2 }); setActiveTool('select') }
      return
    }
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const { cx, cy } = getCanvasPos(e)
    const m = canvasToMeters(cx, cy)
    setMouseM(m)

    if (pan) {
      setPanOffset({ x: pan.origPanX + cx - pan.startX, y: pan.origPanY + cy - pan.startY })
      return
    }
    if (drag) {
      const dm = canvasToMeters(cx, cy)
      const orig = canvasToMeters(drag.startX, drag.startY)
      updateRoom(drag.id, { x: snapV(drag.origX + dm.x - orig.x), y: snapV(drag.origY + dm.y - orig.y) })
      return
    }
    if (drawState.phase === 'drawing-room' || drawState.phase === 'drawing-partition') {
      setDrawState({ ...drawState, x2: m.x, y2: m.y }); return
    }
    if (activeTool === 'door' || activeTool === 'window') {
      setDrawState({ phase: activeTool === 'door' ? 'placing-door' : 'placing-window', preview: hitWall(cx, cy) })
    }
  }

  function onMouseUp() {
    if (pan) { setPan(null); return }
    if (drag) { setDrag(null); return }

    if (drawState.phase === 'drawing-room') {
      const { x1, y1, x2, y2 } = drawState
      const rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1)
      if (rw >= 1 && rh >= 1) {
        const COLORS = ['#FEF9F3', '#F0F4FF', '#F0FFF4', '#FFF5F0', '#F5F0FF']
        addRoom({
          id: Date.now().toString(),
          x: Math.min(x1, x2), y: Math.min(y1, y2),
          width: rw, height: rh,
          label: `ოთახი ${rooms.length + 1}`,
          color: COLORS[rooms.length % COLORS.length],
        })
      }
      setDrawState({ phase: 'idle' }); return
    }
    if (drawState.phase === 'drawing-partition') {
      const { x1, y1, x2, y2 } = drawState
      if (Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) >= 0.5)
        addPartition({ id: Date.now().toString(), x1, y1, x2, y2 })
      setDrawState({ phase: 'idle' }); return
    }
  }

  function onMouseLeave() {
    setMouseM(null); setPan(null)
    if (drawState.phase === 'placing-door' || drawState.phase === 'placing-window')
      setDrawState({ phase: 'idle' })
  }

  const getCursor = () => {
    if (pan || drag) return 'grabbing'
    const map: Record<Tool, string> = {
      select: 'default', room: 'crosshair', partition: 'crosshair',
      door: 'cell', window: 'cell', erase: 'not-allowed',
    }
    return map[activeTool]
  }

  const tools: { id: Tool; icon: string; label: string }[] = [
    { id: 'select', icon: '↖', label: 'არჩევა' },
    { id: 'room', icon: '⬜', label: 'ოთახი' },
    { id: 'partition', icon: '─', label: 'კედელი' },
    { id: 'door', icon: '🚪', label: 'კარი' },
    { id: 'window', icon: '🪟', label: 'ფანჯარა' },
    { id: 'erase', icon: '✕', label: 'წაშლა' },
  ]

  const selectedRoom = selectedType === 'room' ? rooms.find(r => r.id === selectedId) : null

  return (
    <div className="flex h-full">
      {/* Left toolbar */}
      <div className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-3 gap-1">
        {tools.map(t => (
          <button key={t.id} onClick={() => setActiveTool(t.id)} title={t.label}
            className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all
              ${activeTool === t.id ? 'bg-brand text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
            <span className="text-base leading-none">{t.icon}</span>
            <span className="text-[9px] leading-none">{t.label}</span>
          </button>
        ))}

        <div className="w-10 h-px bg-gray-100 my-1" />

        <button onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.2))}
          className="w-11 h-8 rounded-lg text-gray-500 hover:bg-gray-50 text-sm font-medium transition-colors">+</button>
        <span className="text-[9px] text-gray-400">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.max(MIN_ZOOM, z / 1.2))}
          className="w-11 h-8 rounded-lg text-gray-500 hover:bg-gray-50 text-sm font-medium transition-colors">−</button>
        <button onClick={() => { setZoom(1); setPanOffset({ x: 40, y: 40 }) }}
          className="w-11 h-7 rounded-lg text-[9px] text-gray-400 hover:bg-gray-50 transition-colors">Reset</button>

        <div className="flex-1" />

        <button onClick={() => setShowClearConfirm(true)}
          className="w-11 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 text-red-400 hover:bg-red-50 transition-colors"
          title="ყველაფრის წაშლა">
          <span className="text-base leading-none">🗑</span>
          <span className="text-[9px] leading-none">გასუფთ.</span>
        </button>

        <button onClick={() => { setRoomGenerated(true); setViewMode('3d') }}
          className="w-11 h-11 rounded-xl bg-brand text-white flex flex-col items-center justify-center gap-0.5 hover:bg-brand-dark transition-colors">
          <span className="text-sm leading-none font-medium">3D</span>
          <span className="text-[9px] leading-none">ხედი</span>
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden flex items-center justify-center bg-surface relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_W} height={CANVAS_H}
          style={{ cursor: getCursor(), display: 'block' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          className="rounded-2xl shadow-sm border border-gray-200"
        />

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-gray-400 bg-white/80 px-3 py-1 rounded-full border border-gray-200 pointer-events-none">
          scroll → zoom · drag ცარიელ ადგილზე → pan
        </div>

        {showClearConfirm && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-2xl">
            <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-200 max-w-xs w-full mx-4">
              <p className="text-sm font-medium text-gray-900 mb-1">ყველაფრის წაშლა?</p>
              <p className="text-xs text-gray-500 mb-4">ყველა ოთახი, კარი და ფანჯარა წაიშლება. ეს შეუქცევადია.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  გაუქმება
                </button>
                <button onClick={() => { clearAll(); setShowClearConfirm(false) }}
                  className="flex-1 py-2 text-sm bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors">
                  წაშლა
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right properties panel */}
      <div className="w-52 bg-white border-l border-gray-200 p-3 flex flex-col gap-3 overflow-y-auto">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">თვისებები</p>

        {selectedRoom && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">სახელი</label>
              <input value={selectedRoom.label}
                onChange={e => updateRoom(selectedRoom.id, { label: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">სიგანე (მ)</label>
              <input type="number" min={1} max={30} step={0.5} value={selectedRoom.width}
                onChange={e => updateRoom(selectedRoom.id, { width: +e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">სიღრმე (მ)</label>
              <input type="number" min={1} max={30} step={0.5} value={selectedRoom.height}
                onChange={e => updateRoom(selectedRoom.id, { height: +e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">ფერი</label>
              <div className="flex flex-wrap gap-1.5">
                {['#FEF9F3','#F0F4FF','#F0FFF4','#FFF5F0','#F5F0FF','#FFFBF0'].map(c => (
                  <button key={c} onClick={() => updateRoom(selectedRoom.id, { color: c })}
                    className={`w-7 h-7 rounded-lg border-2 transition-all ${selectedRoom.color === c ? 'border-brand scale-110' : 'border-gray-200'}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-2">
              {(selectedRoom.width * selectedRoom.height).toFixed(1)} მ²
            </div>
            <button onClick={() => { removeRoom(selectedRoom.id); setSelected(null, null) }}
              className="w-full py-1.5 text-xs text-red-400 border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
              ოთახის წაშლა
            </button>
          </div>
        )}

        {selectedType === 'door' && selectedId && (
          <div className="space-y-2">
            <p className="text-xs text-gray-600">კარი არჩეულია</p>
            <button onClick={() => { removeDoor(selectedId); setSelected(null, null) }}
              className="w-full py-1.5 text-xs text-red-400 border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
              კარის წაშლა
            </button>
          </div>
        )}

        {selectedType === 'window' && selectedId && (
          <div className="space-y-2">
            <p className="text-xs text-gray-600">ფანჯარა არჩეულია</p>
            <button onClick={() => { removeWindow(selectedId); setSelected(null, null) }}
              className="w-full py-1.5 text-xs text-red-400 border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
              ფანჯრის წაშლა
            </button>
          </div>
        )}

        {selectedType === 'partition' && selectedId && (
          <div className="space-y-2">
            <p className="text-xs text-gray-600">გადატიხვრა არჩეულია</p>
            <button onClick={() => { removePartition(selectedId); setSelected(null, null) }}
              className="w-full py-1.5 text-xs text-red-400 border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
              წაშლა
            </button>
          </div>
        )}

        {!selectedId && (
          <div className="text-xs text-gray-400 space-y-2 mt-2">
            <p className="font-medium text-gray-500">მინიშნებები:</p>
            <p>🖱 scroll → zoom</p>
            <p>🖱 drag ცარიელზე → pan</p>
            <p>⬜ drag → ოთახი</p>
            <p>─ drag → კედელი</p>
            <p>🚪 კლიკე კედელზე</p>
            <p>🪟 კლიკე კედელზე</p>
            <p>✕ კლიკე → წაშლა</p>
          </div>
        )}
      </div>
    </div>
  )
}