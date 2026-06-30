'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import { usePlanStore } from '@/lib/store/plan-store'
import { detectRooms, projectOnWall } from '@/lib/plan/graph'
import type { PlanNode } from '@/lib/plan/types'
import { Pencil, MousePointer2, DoorOpen, RectangleHorizontal, Eraser, Trash2 } from 'lucide-react'

const SCALE = 70
const GRID = 0.5
const SNAP_PX = 12 // node-ზე მიკვრის რადიუსი ეკრანის პიქსელებში (zoom-ისგან დამოუკიდებელი)
const snapG = (v: number) => Math.round(v / GRID) * GRID

type Tool = 'wall' | 'select' | 'door' | 'window' | 'erase'

function woodPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const t = document.createElement('canvas'); t.width = 64; t.height = 26
  const c = t.getContext('2d'); if (!c) return null
  c.fillStyle = '#cdaa78'; c.fillRect(0, 0, 64, 26)
  c.strokeStyle = '#b1875a'; c.lineWidth = 1
  c.beginPath(); c.moveTo(0, 0.5); c.lineTo(64, 0.5); c.moveTo(0, 25.5); c.lineTo(64, 25.5); c.moveTo(32, 0); c.lineTo(32, 26); c.stroke()
  return ctx.createPattern(t, 'repeat')
}

export default function PlanEditor2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const woodRef = useRef<CanvasPattern | null>(null)
  const { nodes, walls, openings, addWall, moveNode, removeWall, addOpening } = usePlanStore()
  const [size, setSize] = useState({ w: 1000, h: 700 })

  const [tool, setTool] = useState<Tool>('wall')
  const [pan, setPan] = useState({ x: 120, y: 120 })
  const [zoom, setZoom] = useState(1)
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null) // wall chain start (meters)
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null) // meters
  const [drag, setDrag] = useState<{ nodeId: string } | null>(null)
  const [panning, setPanning] = useState<{ sx: number; sy: number; ox: number; oy: number } | null>(null)

  const wx = (m: number) => m * SCALE * zoom + pan.x
  const wy = (m: number) => m * SCALE * zoom + pan.y
  const toM = (cx: number, cy: number) => ({ x: (cx - pan.x) / (SCALE * zoom), y: (cy - pan.y) / (SCALE * zoom) })

  function pos(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = canvasRef.current!.getBoundingClientRect()
    return { cx: e.clientX - r.left, cy: e.clientY - r.top }
  }
  // snap a point (meters) to nearest node — ეკრანის პიქსელებში (zoom-ისგან
  // დამოუკიდებელი, ნაკლებად „წებოვანი"), თორემ grid-ზე
  function snapPt(m: { x: number; y: number }): { x: number; y: number } {
    const mx = wx(m.x), my = wy(m.y)
    let best: PlanNode | null = null, bd = SNAP_PX
    for (const n of nodes) { const d = Math.hypot(wx(n.x) - mx, wy(n.y) - my); if (d < bd) { bd = d; best = n } }
    return best ? { x: best.x, y: best.y } : { x: snapG(m.x), y: snapG(m.y) }
  }
  function hitNode(cx: number, cy: number): PlanNode | null {
    for (const n of nodes) if (Math.hypot(wx(n.x) - cx, wy(n.y) - cy) < 10) return n
    return null
  }
  function hitWall(cx: number, cy: number): string | null {
    const m = toM(cx, cy)
    let best: string | null = null, bd = 0.18
    for (const w of walls) {
      const a = nodes.find(n => n.id === w.a), b = nodes.find(n => n.id === w.b)
      if (!a || !b) continue
      const { dist } = projectOnWall(m.x, m.y, a, b)
      if (dist < bd) { bd = dist; best = w.id }
    }
    return best
  }

  // ── interactions ──
  function onDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const { cx, cy } = pos(e)
    if (e.button === 1 || e.button === 2 || tool === 'select') {
      const n = tool === 'select' ? hitNode(cx, cy) : null
      if (n) { setDrag({ nodeId: n.id }); return }
      setPanning({ sx: cx, sy: cy, ox: pan.x, oy: pan.y }); return
    }
    const m = snapPt(toM(cx, cy))
    if (tool === 'wall') {
      if (!draft) setDraft(m)
      else {
        addWall(draft.x, draft.y, m.x, m.y)
        // არსებულ node-ზე დასრულება ამთავრებს ჯაჭვს (loop-ის ჩაკეტვა / დაკავშირება),
        // მერე თავისუფლად იწყებ ახალ კედელს სხვაგან
        const onNode = nodes.some((n) => Math.hypot(n.x - m.x, n.y - m.y) < 0.01)
        setDraft(onNode ? null : m)
      }
    } else if (tool === 'door' || tool === 'window') {
      const wid = hitWall(cx, cy)
      if (wid) {
        const w = walls.find(x => x.id === wid)!; const a = nodes.find(n => n.id === w.a)!, b = nodes.find(n => n.id === w.b)!
        const { t } = projectOnWall(toM(cx, cy).x, toM(cx, cy).y, a, b)
        addOpening(wid, t, tool)
      }
    } else if (tool === 'erase') {
      const wid = hitWall(cx, cy); if (wid) removeWall(wid)
    }
  }
  function onMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const { cx, cy } = pos(e)
    setMouse(toM(cx, cy))
    if (panning) { setPan({ x: panning.ox + cx - panning.sx, y: panning.oy + cy - panning.sy }); return }
    if (drag) { const m = snapPt(toM(cx, cy)); moveNode(drag.nodeId, m.x, m.y) }
  }
  function onUp() { setPanning(null); setDrag(null) }
  function onWheel(e: React.WheelEvent) {
    const f = e.deltaY < 0 ? 1.1 : 0.9
    setZoom(z => Math.max(0.3, Math.min(3, z * f)))
  }
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setDraft(null) }
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc)
  }, [])

  // canvas fullscreen — კონტეინერის ზომაზე მორგება
  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const apply = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── draw ──
  const draw = useCallback(() => {
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    const { w: CW, h: CH } = size
    if (!woodRef.current) woodRef.current = woodPattern(ctx)
    ctx.clearRect(0, 0, CW, CH); ctx.fillStyle = '#F6F5F2'; ctx.fillRect(0, 0, CW, CH)

    // grid
    const g = GRID * SCALE * zoom
    ctx.strokeStyle = '#E6E7EA'; ctx.lineWidth = 0.5
    for (let x = ((pan.x % g) + g) % g; x < CW; x += g) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke() }
    for (let y = ((pan.y % g) + g) % g; y < CH; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke() }

    // rooms (polygons)
    const rooms = detectRooms(nodes, walls)
    for (const r of rooms) {
      ctx.beginPath()
      r.nodeIds.forEach((id, i) => { const n = nodes.find(nn => nn.id === id)!; const X = wx(n.x), Y = wy(n.y); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y) })
      ctx.closePath()
      ctx.fillStyle = (woodRef.current as CanvasPattern | null) ?? '#EAD9BC'; ctx.fill()
      // label + area
      const lx = wx(r.centroid.x), ly = wy(r.centroid.y)
      ctx.fillStyle = 'rgba(255,255,255,0.82)'; ctx.fillRect(lx - 40, ly - 15, 80, 28)
      ctx.fillStyle = '#374151'; ctx.font = '600 12px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ოთახი', lx, ly - 1)
      ctx.fillStyle = '#6B7280'; ctx.font = '10px Inter, sans-serif'; ctx.fillText(`${r.area.toFixed(1)} მ²`, lx, ly + 12)
    }

    // walls
    for (const w of walls) {
      const a = nodes.find(n => n.id === w.a), b = nodes.find(n => n.id === w.b); if (!a || !b) continue
      ctx.strokeStyle = '#2B2B2B'; ctx.lineCap = 'butt'
      ctx.lineWidth = Math.max(3, w.thickness * SCALE * zoom)
      ctx.beginPath(); ctx.moveTo(wx(a.x), wy(a.y)); ctx.lineTo(wx(b.x), wy(b.y)); ctx.stroke()
    }
    // node joints (fill corners)
    for (const n of nodes) { ctx.fillStyle = '#2B2B2B'; ctx.beginPath(); ctx.arc(wx(n.x), wy(n.y), Math.max(2, 0.06 * SCALE * zoom), 0, Math.PI * 2); ctx.fill() }

    // openings (gap + door arc)
    for (const o of openings) {
      const w = walls.find(x => x.id === o.wallId); if (!w) continue
      const a = nodes.find(n => n.id === w.a)!, b = nodes.find(n => n.id === w.b)!
      const ang = Math.atan2(b.y - a.y, b.x - a.x)
      const ccx = wx(a.x + o.t * (b.x - a.x)), ccy = wy(a.y + o.t * (b.y - a.y))
      const half = (o.width / 2) * SCALE * zoom
      ctx.save(); ctx.translate(ccx, ccy); ctx.rotate(ang)
      ctx.strokeStyle = '#F6F5F2'; ctx.lineWidth = Math.max(4, w.thickness * SCALE * zoom + 2)
      ctx.beginPath(); ctx.moveTo(-half, 0); ctx.lineTo(half, 0); ctx.stroke() // gap
      if (o.type === 'door') { ctx.strokeStyle = '#15803D'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(-half, 0, half * 2, 0, -Math.PI / 2, true); ctx.stroke() }
      else { ctx.strokeStyle = '#3B82F6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-half, 0); ctx.lineTo(half, 0); ctx.stroke() }
      ctx.restore()
    }

    // draft wall preview
    if (draft && mouse && tool === 'wall') {
      const s = snapPt(mouse)
      ctx.strokeStyle = '#9CA3AF'; ctx.setLineDash([5, 4]); ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(wx(draft.x), wy(draft.y)); ctx.lineTo(wx(s.x), wy(s.y)); ctx.stroke(); ctx.setLineDash([])
      ctx.fillStyle = '#2D6A4F'; ctx.beginPath(); ctx.arc(wx(draft.x), wy(draft.y), 4, 0, Math.PI * 2); ctx.fill()
    }
  }, [nodes, walls, openings, pan, zoom, draft, mouse, tool, size])

  useEffect(() => { draw() }, [draw])

  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'wall', icon: <Pencil size={15} />, label: 'კედელი' },
    { id: 'select', icon: <MousePointer2 size={15} />, label: 'მონიშვნა' },
    { id: 'door', icon: <DoorOpen size={15} />, label: 'კარი' },
    { id: 'window', icon: <RectangleHorizontal size={15} />, label: 'ფანჯარა' },
    { id: 'erase', icon: <Eraser size={15} />, label: 'წაშლა' },
  ]

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-2">
        <span className="mr-3 text-sm font-semibold text-gray-700">Wall-graph რედაქტორი (beta)</span>
        {tools.map(t => (
          <button key={t.id} onClick={() => { setTool(t.id); setDraft(null) }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${tool === t.id ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {t.icon}{t.label}
          </button>
        ))}
        <button onClick={() => usePlanStore.getState().clearPlan()} className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-red-500 hover:bg-red-50">
          <Trash2 size={15} /> გასუფთავება
        </button>
      </div>
      <div ref={wrapRef} className="flex-1 overflow-hidden">
        <canvas ref={canvasRef} width={size.w} height={size.h}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onWheel={onWheel} onContextMenu={e => e.preventDefault()}
          className="block cursor-crosshair" />
      </div>
      <div className="border-t border-gray-100 bg-white px-4 py-1.5 text-xs text-gray-400">
        კედლის ხატვა: კლიკი → კლიკი (ჯაჭვი) · Esc — შეწყვეტა · შუა/მარჯვ. ღილაკი — pan · scroll — zoom
      </div>
    </div>
  )
}
