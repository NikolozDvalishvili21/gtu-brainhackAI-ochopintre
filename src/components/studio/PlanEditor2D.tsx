'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import { usePlanStore } from '@/lib/store/plan-store'
import { useRoomStore } from '@/lib/store/room-store'
import { historyFocus } from '@/lib/store/history-focus'
import { FURNITURE_CATALOG, VALID_FURNITURE_TYPES } from '@/lib/constants/furniture-catalog'
import { ROOM_TYPES, ROOM_TYPE_LIST } from '@/lib/constants/room-types'
import { autoFurnishRoom } from '@/lib/auto-furnish'
import { detectRooms, projectOnWall } from '@/lib/plan/graph'
import type { PlanNode } from '@/lib/plan/types'
import { Pencil, MousePointer2, DoorOpen, RectangleHorizontal, Eraser, Trash2, Undo2, Redo2, Sofa, Download, Ruler, Copy, Wand2 } from 'lucide-react'

const SCALE = 70
const GRID = 0.5
const SNAP_PX = 12 // node-ზე მიკვრის რადიუსი ეკრანის პიქსელებში (zoom-ისგან დამოუკიდებელი)
const snapG = (v: number) => Math.round(v / GRID) * GRID

type Tool = 'wall' | 'select' | 'door' | 'window' | 'erase' | 'furniture' | 'measure'

// წერტილი პოლიგონშია? (ray casting)
function pointInPoly(px: number, py: number, pts: { x: number; y: number }[]): boolean {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

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
  const { nodes, walls, openings, addWall, moveNode, removeWall, addOpening, setWallDims, removeOpening, pushHistory, past, future } = usePlanStore()
  const { furniture, addFurniture, updateFurniture, removeFurniture, selectedFurnitureId, setSelectedFurniture, pushFurnHistory, furnPast, furnFuture, roomMeta, setRoomMeta, applyAutoFurnish } = useRoomStore()
  const canUndo = past.length > 0 || furnPast.length > 0
  const canRedo = future.length > 0 || furnFuture.length > 0
  // unified undo/redo — plan (გეომეტრია) + furniture ერთ Ctrl+Z-ზე (focus-ის მიხედვით)
  const unifiedUndo = useCallback(() => {
    const ps = usePlanStore.getState(); const rs = useRoomStore.getState()
    if (historyFocus.store === 'furn' && rs.canUndoFurniture()) rs.undoFurniture()
    else if (ps.canUndo()) ps.undo()
    else if (rs.canUndoFurniture()) rs.undoFurniture()
  }, [])
  const unifiedRedo = useCallback(() => {
    const ps = usePlanStore.getState(); const rs = useRoomStore.getState()
    if (historyFocus.store === 'furn' && rs.canRedoFurniture()) rs.redoFurniture()
    else if (ps.canRedo()) ps.redo()
    else if (rs.canRedoFurniture()) rs.redoFurniture()
  }, [])
  const [size, setSize] = useState({ w: 1000, h: 700 })

  const [tool, setTool] = useState<Tool>('wall')
  const [pan, setPan] = useState({ x: 120, y: 120 })
  const [zoom, setZoom] = useState(1)
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null) // wall chain start (meters)
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null) // meters
  const [drag, setDrag] = useState<{ nodeId: string } | null>(null)
  const [panning, setPanning] = useState<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const [shiftKey, setShiftKey] = useState(false) // Shift → 45° კუთხის ფიქსაცია
  const [furnType, setFurnType] = useState<string>('sofa') // furniture tool-ის აქტიური ტიპი
  const [furnDrag, setFurnDrag] = useState<{ id: string; dx: number; dy: number } | null>(null)
  const furnMovedRef = useRef(false) // ავეჯის drag-ის პირველ მოძრაობაზე history snapshot
  const [lenInput, setLenInput] = useState('') // კედლის სიგრძის ციფრული ველი
  const lenFocus = useRef(false)
  const [hoverWall, setHoverWall] = useState<string | null>(null) // erase tool-ის hover (კედელი)
  const [hoverFurn, setHoverFurn] = useState<string | null>(null) // erase tool-ის hover (ავეჯი)
  const [selWall, setSelWall] = useState<string | null>(null) // select tool: მონიშნული კედელი
  const [selRoom, setSelRoom] = useState<string | null>(null) // select tool: მონიშნული ოთახი
  const [measure, setMeasure] = useState<{ a: { x: number; y: number }; b: { x: number; y: number } | null } | null>(null)
  const selWallObj = selWall ? walls.find(w => w.id === selWall) : null
  const roomsList = detectRooms(nodes, walls)
  const selRoomObj = selRoom ? roomsList.find(r => r.id === selRoom) : null
  const selFurn = furniture.find(f => f.id === selectedFurnitureId)

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
  // კედლის მე-2 წერტილი: node-ზე მიკვრა → კუთხე/სიგრძის snap → grid
  function resolveWallPt(m: { x: number; y: number }, shift: boolean, d: { x: number; y: number } | null): { x: number; y: number } {
    // 1) არსებულ node-ზე მიკვრა (დაკავშირება)
    const mx = wx(m.x), my = wy(m.y)
    let best: PlanNode | null = null, bd = SNAP_PX
    for (const n of nodes) { const dd = Math.hypot(wx(n.x) - mx, wy(n.y) - my); if (dd < bd) { bd = dd; best = n } }
    if (best) return { x: best.x, y: best.y }
    // 2) კუთხე + სიგრძის snap (მხოლოდ draft-ის დროს)
    if (d) {
      let ang = Math.atan2(m.y - d.y, m.x - d.x)
      let len = Math.hypot(m.x - d.x, m.y - d.y)
      const deg = ((ang * 180) / Math.PI + 360) % 360
      const adiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)
      if (shift) {
        ang = (Math.round(deg / 45) * 45 * Math.PI) / 180 // Shift → 45° ფიქსაცია
      } else {
        const n90 = Math.round(deg / 90) * 90
        if (adiff(deg, n90) < 5) ang = (n90 * Math.PI) / 180 // ჰორიზ./ვერტ. მაგნიტი (±5°)
      }
      len = Math.max(0.1, Math.round(len / 0.1) * 0.1) // 0.1მ ბიჯი
      return { x: d.x + Math.cos(ang) * len, y: d.y + Math.sin(ang) * len }
    }
    // 3) grid
    return { x: snapG(m.x), y: snapG(m.y) }
  }
  function hitNode(cx: number, cy: number): PlanNode | null {
    for (const n of nodes) if (Math.hypot(wx(n.x) - cx, wy(n.y) - cy) < 10) return n
    return null
  }
  function hitWall(cx: number, cy: number): string | null {
    const m = toM(cx, cy)
    // მოხვედრის ზღვარი პიქსელებში (zoom-დამოუკიდებელი, ადვილი დასაჭერი)
    let best: string | null = null, bd = 14 / (SCALE * zoom)
    for (const w of walls) {
      const a = nodes.find(n => n.id === w.a), b = nodes.find(n => n.id === w.b)
      if (!a || !b) continue
      const { dist } = projectOnWall(m.x, m.y, a, b)
      if (dist < bd) { bd = dist; best = w.id }
    }
    return best
  }
  // ღიობის (კარი/ფანჯარა) hit-test
  function hitOpening(cx: number, cy: number): string | null {
    for (const o of openings) {
      const w = walls.find(x => x.id === o.wallId); if (!w) continue
      const a = nodes.find(n => n.id === w.a), b = nodes.find(n => n.id === w.b); if (!a || !b) continue
      const ox = a.x + o.t * (b.x - a.x), oy = a.y + o.t * (b.y - a.y)
      if (Math.hypot(wx(ox) - cx, wy(oy) - cy) < Math.max(10, (o.width / 2) * SCALE * zoom)) return o.id
    }
    return null
  }
  // ავეჯის hit-test (ლოკალურ სივრცეში, rotate-ის გათვალისწინებით). f.x→plan.x, f.z→plan.y
  function hitFurniture(cx: number, cy: number): string | null {
    const m = toM(cx, cy)
    for (let i = furniture.length - 1; i >= 0; i--) {
      const f = furniture[i]
      const px = m.x - f.x, py = m.y - f.z
      const r = f.rotation
      const lx = Math.cos(r) * px - Math.sin(r) * py
      const ly = Math.sin(r) * px + Math.cos(r) * py
      if (Math.abs(lx) <= f.width / 2 && Math.abs(ly) <= f.depth / 2) return f.id
    }
    return null
  }
  // ავეჯის ცენტრი უახლოეს კედელს ეკვრება (გასწორება + ზურგით მიდება)
  function snapFurnitureToWall(cx: number, cz: number, depth: number, curRot: number): { x: number; z: number; rotation: number } {
    let best: { d: number; ppx: number; ppy: number; ux: number; uy: number; th: number } | null = null
    for (const w of walls) {
      const a = nodes.find(n => n.id === w.a), b = nodes.find(n => n.id === w.b); if (!a || !b) continue
      const { t, dist } = projectOnWall(cx, cz, a, b)
      const tc = Math.max(0, Math.min(1, t))
      if (!best || dist < best.d) {
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
        best = { d: dist, ppx: a.x + tc * (b.x - a.x), ppy: a.y + tc * (b.y - a.y), ux: (b.x - a.x) / len, uy: (b.y - a.y) / len, th: w.thickness }
      }
    }
    if (!best || best.d > 0.7) return { x: cx, z: cz, rotation: curRot }
    const nx = -best.uy, ny = best.ux // ნორმალი
    const side = (cx - best.ppx) * nx + (cz - best.ppy) * ny >= 0 ? 1 : -1
    const off = depth / 2 + best.th / 2
    return {
      x: best.ppx + nx * side * off,
      z: best.ppy + ny * side * off,
      rotation: -Math.atan2(best.uy, best.ux), // width კედლის გასწვრივ
    }
  }

  // ── interactions ──
  function onDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const { cx, cy } = pos(e)
    // მარჯვენა კლიკი კედლის ხატვისას → ჯაჭვის დასრულება (pan-ის ნაცვლად)
    if (e.button === 2 && tool === 'wall' && draft) { setDraft(null); return }
    // შუა/მარჯვ. ღილაკი → pan
    if (e.button === 1 || e.button === 2) { setPanning({ sx: cx, sy: cy, ox: pan.x, oy: pan.y }); return }
    // select tool: node-ის გადატანა → კედელი → ოთახი → pan
    if (tool === 'select') {
      const n = hitNode(cx, cy)
      if (n) { pushHistory(); setDrag({ nodeId: n.id }); return }
      const wid = hitWall(cx, cy)
      if (wid) { setSelWall(wid); setSelRoom(null); return }
      setSelWall(null)
      const m = toM(cx, cy)
      const room = roomsList.find(r => {
        const pts = r.nodeIds.map(id => nodes.find(nn => nn.id === id)).filter(Boolean) as PlanNode[]
        return pointInPoly(m.x, m.y, pts)
      })
      setSelRoom(room?.id ?? null)
      if (!room) setPanning({ sx: cx, sy: cy, ox: pan.x, oy: pan.y })
      return
    }
    // საზომი ლენტი: ორი კლიკი
    if (tool === 'measure') {
      const p = snapPt(toM(cx, cy))
      setMeasure((prev) => (!prev || prev.b ? { a: p, b: null } : { a: prev.a, b: p }))
      return
    }
    // ავეჯი: არსებულზე კლიკი → მონიშვნა+drag; ცარიელზე → ახალი
    if (tool === 'furniture') {
      const hitId = hitFurniture(cx, cy)
      const mm = toM(cx, cy)
      if (hitId) {
        const f = furniture.find(ff => ff.id === hitId)!
        setSelectedFurniture(hitId)
        furnMovedRef.current = false
        setFurnDrag({ id: hitId, dx: f.x - mm.x, dy: f.z - mm.y })
        return
      }
      const cat = FURNITURE_CATALOG[furnType as keyof typeof FURNITURE_CATALOG]
      const p = snapFurnitureToWall(mm.x, mm.y, cat.depth, 0)
      const id = 'f_' + Math.random().toString(36).slice(2, 9)
      addFurniture({
        id, type: furnType, label: cat.label,
        x: p.x, y: 0, z: p.z, rotation: p.rotation,
        width: cat.width, depth: cat.depth, height: cat.height,
        color: cat.color, scale: 1,
      })
      setSelectedFurniture(id)
      setFurnDrag({ id, dx: p.x - mm.x, dy: p.z - mm.y })
      return
    }
    const raw = toM(cx, cy)
    const m = tool === 'wall' ? resolveWallPt(raw, e.shiftKey, draft) : snapPt(raw)
    if (tool === 'wall') {
      if (!draft) setDraft(m)
      else {
        addWall(draft.x, draft.y, m.x, m.y)
        // ჯაჭვი გრძელდება ბოლო წერტილიდან. დასრულება: Esc ან მარჯვ. კლიკი.
        // არსებულ node-ზე დახურვა (loop) ავტომატურად ამთავრებს ჯაჭვს.
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
      const fid = hitFurniture(cx, cy)
      if (fid) { removeFurniture(fid); return } // ავეჯს პრიორიტეტი
      const oid = hitOpening(cx, cy)
      if (oid) { removeOpening(oid); return } // კარი/ფანჯარა
      const wid = hitWall(cx, cy); if (wid) removeWall(wid)
    }
  }
  // AI გაწყობა — ოთახის ტიპის მიხედვით ავეჯის ავტო-განლაგება
  function handleAutoFurnish() {
    if (!selRoomObj) return
    const meta = roomMeta[selRoomObj.id]
    if (!meta?.type) return
    const pts = selRoomObj.nodeIds.map(id => nodes.find(n => n.id === id)).filter(Boolean) as PlanNode[]
    // ოთახის შიგნით არსებული ავეჯი იცვლება ახლით
    const removeIds = furniture.filter(f => pointInPoly(f.x, f.z, pts)).map(f => f.id)
    const remaining = furniture.filter(f => !removeIds.includes(f.id))
    const items = autoFurnishRoom(selRoomObj, { nodes, walls, openings, existing: remaining, type: meta.type })
    applyAutoFurnish(removeIds, items)
  }

  // ველში აკრეფილი სიგრძით კედლის დასრულება (მიმართულება — კურსორისკენ/snap-ით)
  function commitLen() {
    const L = parseFloat(lenInput)
    if (!draft || !(L > 0)) return
    let dx = 1, dy = 0
    if (mouse) {
      const s = resolveWallPt(mouse, shiftKey, draft)
      const ddx = s.x - draft.x, ddy = s.y - draft.y
      const dd = Math.hypot(ddx, ddy)
      if (dd > 0.001) { dx = ddx / dd; dy = ddy / dd }
    }
    const ex = draft.x + dx * L, ey = draft.y + dy * L
    addWall(draft.x, draft.y, ex, ey)
    setDraft({ x: ex, y: ey }) // ჯაჭვი გრძელდება
  }

  function onMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const { cx, cy } = pos(e)
    setMouse(toM(cx, cy))
    if (e.shiftKey !== shiftKey) setShiftKey(e.shiftKey)
    // ცოცხალი სიგრძე ველში (თუ ველი არ არის ფოკუსში)
    if (draft && tool === 'wall' && !lenFocus.current) {
      const s = resolveWallPt(toM(cx, cy), e.shiftKey, draft)
      setLenInput(Math.hypot(s.x - draft.x, s.y - draft.y).toFixed(2))
    }
    // erase tool: hover-ზე გამოკვეთა (ავეჯს პრიორიტეტი კედელზე)
    if (tool === 'erase') {
      const hf = hitFurniture(cx, cy)
      const h = hf ? null : hitWall(cx, cy)
      if (h !== hoverWall) setHoverWall(h)
      if (hf !== hoverFurn) setHoverFurn(hf)
    } else {
      if (hoverWall) setHoverWall(null)
      if (hoverFurn) setHoverFurn(null)
    }
    if (panning) { setPan({ x: panning.ox + cx - panning.sx, y: panning.oy + cy - panning.sy }); return }
    if (furnDrag) {
      const mm = toM(cx, cy)
      const f = furniture.find(ff => ff.id === furnDrag.id)
      if (f) {
        if (!furnMovedRef.current) { pushFurnHistory(); furnMovedRef.current = true }
        const snapped = snapFurnitureToWall(mm.x + furnDrag.dx, mm.y + furnDrag.dy, f.depth, f.rotation)
        updateFurniture(furnDrag.id, { x: snapped.x, z: snapped.z, rotation: snapped.rotation })
      }
      return
    }
    if (drag) { const m = snapPt(toM(cx, cy)); moveNode(drag.nodeId, m.x, m.y) }
  }
  function onUp() { setPanning(null); setDrag(null); setFurnDrag(null) }
  function exportPlanPNG() {
    const cv = canvasRef.current; if (!cv) return
    const a = document.createElement('a')
    a.href = cv.toDataURL('image/png')
    a.download = `plan-${Date.now()}.png`
    a.click()
  }
  function onWheel(e: React.WheelEvent) {
    const f = e.deltaY < 0 ? 1.1 : 0.9
    setZoom(z => Math.max(0.3, Math.min(3, z * f)))
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      // ველში აკრეფისას shortcut-ები არ ერევა (Backspace/R/Ctrl+Z ა.შ.)
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.key === 'Escape') { setDraft(null); setMeasure(null); return }
      const metaKey = e.ctrlKey || e.metaKey
      // ავეჯის კლავიშები (R — მოტრიალება 15°, Del — წაშლა, Ctrl+D — დუბლიკატი)
      const rs = useRoomStore.getState()
      if (rs.selectedFurnitureId) {
        const f = rs.furniture.find(x => x.id === rs.selectedFurnitureId)
        if (metaKey && e.code === 'KeyD') {
          e.preventDefault()
          if (f) {
            const id = 'f_' + Math.random().toString(36).slice(2, 9)
            rs.addFurniture({ ...f, id, x: f.x + 0.4, z: f.z + 0.4 })
            rs.setSelectedFurniture(id)
          }
          return
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault(); rs.removeFurniture(rs.selectedFurnitureId); return
        }
        if (e.code === 'KeyR') {
          e.preventDefault()
          if (f) rs.updateFurniture(f.id, { rotation: f.rotation + (e.shiftKey ? -1 : 1) * (Math.PI / 12) })
          return
        }
      }
      // მონიშნული კედლის წაშლა
      if (selWall && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault(); removeWall(selWall); setSelWall(null); return
      }
      const meta = e.ctrlKey || e.metaKey
      // e.code = ფიზიკური კლავიში → მუშაობს ქართულ განლაგებაზეც (e.key layout-ს ეყრდნობა)
      if (meta && e.code === 'KeyZ') {
        e.preventDefault()
        if (e.shiftKey) unifiedRedo(); else unifiedUndo()
      } else if (meta && e.code === 'KeyY') {
        e.preventDefault(); unifiedRedo()
      }
    }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  }, [unifiedUndo, unifiedRedo, selWall, removeWall])

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
      // მონიშნული ოთახის კონტური
      if (tool === 'select' && r.id === selRoom) {
        ctx.strokeStyle = '#2D6A4F'; ctx.lineWidth = 3; ctx.setLineDash([7, 4]); ctx.stroke(); ctx.setLineDash([])
      }
      // label: სახელი/ტიპი + ფართობი
      const meta = roomMeta[r.id]
      const typeInfo = meta?.type ? ROOM_TYPES[meta.type] : null
      const title = `${typeInfo ? typeInfo.icon + ' ' : ''}${meta?.name || typeInfo?.label || 'ოთახი'}`
      const lx = wx(r.centroid.x), ly = wy(r.centroid.y)
      ctx.font = '600 12px Inter, sans-serif'; ctx.textAlign = 'center'
      const tw2 = Math.max(80, ctx.measureText(title).width + 16)
      ctx.fillStyle = 'rgba(255,255,255,0.82)'; ctx.fillRect(lx - tw2 / 2, ly - 15, tw2, 28)
      ctx.fillStyle = '#374151'; ctx.fillText(title, lx, ly - 1)
      ctx.fillStyle = '#6B7280'; ctx.font = '10px Inter, sans-serif'; ctx.fillText(`${r.area.toFixed(1)} მ²`, lx, ly + 12)
    }

    // walls
    for (const w of walls) {
      const a = nodes.find(n => n.id === w.a), b = nodes.find(n => n.id === w.b); if (!a || !b) continue
      const del = tool === 'erase' && w.id === hoverWall
      const sel = tool === 'select' && w.id === selWall
      ctx.strokeStyle = del ? '#DC2626' : sel ? '#2D6A4F' : '#2B2B2B'; ctx.lineCap = 'butt'
      ctx.lineWidth = Math.max(3, w.thickness * SCALE * zoom) + (del || sel ? 3 : 0)
      ctx.beginPath(); ctx.moveTo(wx(a.x), wy(a.y)); ctx.lineTo(wx(b.x), wy(b.y)); ctx.stroke()
    }
    // wall length labels (მიდლში, კედლის გვერდზე გადაწეული)
    for (const w of walls) {
      const a = nodes.find(n => n.id === w.a), b = nodes.find(n => n.id === w.b); if (!a || !b) continue
      const len = Math.hypot(b.x - a.x, b.y - a.y); if (len < 0.15) continue
      const ax = wx(a.x), ay = wy(a.y), bx = wx(b.x), by = wy(b.y)
      const dxw = bx - ax, dyw = by - ay, L = Math.hypot(dxw, dyw) || 1
      const ox = (-dyw / L) * 13, oy = (dxw / L) * 13 // პერპენდიკულარული გადაწევა
      const mx2 = (ax + bx) / 2 + ox, my2 = (ay + by) / 2 + oy
      const label = `${len.toFixed(2)} მ`
      ctx.font = '600 10px Inter, sans-serif'; ctx.textAlign = 'center'
      const tw = ctx.measureText(label).width
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(mx2 - tw / 2 - 4, my2 - 8, tw + 8, 15)
      ctx.fillStyle = '#4B5563'; ctx.fillText(label, mx2, my2 + 3)
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

    // furniture footprints
    for (const f of furniture) {
      const sel = f.id === selectedFurnitureId
      const del = tool === 'erase' && f.id === hoverFurn
      const W = f.width * SCALE * zoom, D = f.depth * SCALE * zoom
      ctx.save()
      ctx.translate(wx(f.x), wy(f.z))
      ctx.rotate(-f.rotation)
      ctx.globalAlpha = del ? 0.35 : sel ? 0.5 : 0.42
      ctx.fillStyle = del ? '#DC2626' : f.color
      ctx.fillRect(-W / 2, -D / 2, W, D)
      ctx.globalAlpha = 1
      ctx.strokeStyle = del ? '#DC2626' : sel ? '#2D6A4F' : '#6b5440'
      ctx.lineWidth = del ? 2.5 : sel ? 2.5 : 1
      ctx.strokeRect(-W / 2, -D / 2, W, D)
      // წინა კიდის მარკერი (+depth მხარე)
      ctx.strokeStyle = sel ? '#2D6A4F' : '#9a7b52'; ctx.lineWidth = sel ? 3 : 2
      ctx.beginPath(); ctx.moveTo(-W / 2, D / 2); ctx.lineTo(W / 2, D / 2); ctx.stroke()
      ctx.restore()
      // ხატულა (არ ბრუნავს, ცენტრში)
      const cat = FURNITURE_CATALOG[f.type as keyof typeof FURNITURE_CATALOG]
      if (cat) {
        ctx.font = `${Math.max(12, Math.min(24, D * 0.55))}px serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(cat.icon, wx(f.x), wy(f.z))
        ctx.textBaseline = 'alphabetic'
      }
    }

    // draft wall preview + ცოცხალი ზომა (სიგრძე + კუთხე)
    if (draft && mouse && tool === 'wall') {
      const s = resolveWallPt(mouse, shiftKey, draft)
      ctx.strokeStyle = '#9CA3AF'; ctx.setLineDash([5, 4]); ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(wx(draft.x), wy(draft.y)); ctx.lineTo(wx(s.x), wy(s.y)); ctx.stroke(); ctx.setLineDash([])
      ctx.fillStyle = '#2D6A4F'; ctx.beginPath(); ctx.arc(wx(draft.x), wy(draft.y), 4, 0, Math.PI * 2); ctx.fill()
      // label: სიგრძე მ + კუთხე ° (0°=მარჯვ., 90°=ზემოთ)
      const len = Math.hypot(s.x - draft.x, s.y - draft.y)
      if (len > 0.001) {
        const deg = ((Math.atan2(-(s.y - draft.y), s.x - draft.x) * 180) / Math.PI + 360) % 360
        const label = `${len.toFixed(2)} მ · ${deg.toFixed(0)}°`
        const mx2 = (wx(draft.x) + wx(s.x)) / 2, my2 = (wy(draft.y) + wy(s.y)) / 2
        ctx.font = '600 12px Inter, sans-serif'; ctx.textAlign = 'center'
        const tw = ctx.measureText(label).width
        ctx.fillStyle = 'rgba(45,106,79,0.95)'; ctx.fillRect(mx2 - tw / 2 - 6, my2 - 24, tw + 12, 18)
        ctx.fillStyle = '#fff'; ctx.fillText(label, mx2, my2 - 11)
      }
    }

    // საზომი ლენტი
    if (tool === 'measure' && measure) {
      const b = measure.b ?? mouse
      if (b) {
        const ax = wx(measure.a.x), ay = wy(measure.a.y), bx = wx(b.x), by = wy(b.y)
        ctx.strokeStyle = '#7C3AED'; ctx.setLineDash([6, 4]); ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([])
        for (const [px, py] of [[ax, ay], [bx, by]]) { ctx.fillStyle = '#7C3AED'; ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill() }
        const dist = Math.hypot(b.x - measure.a.x, b.y - measure.a.y)
        const label = `${dist.toFixed(2)} მ`
        const mx2 = (ax + bx) / 2, my2 = (ay + by) / 2
        ctx.font = '600 12px Inter, sans-serif'; ctx.textAlign = 'center'
        const tw = ctx.measureText(label).width
        ctx.fillStyle = 'rgba(124,58,237,0.95)'; ctx.fillRect(mx2 - tw / 2 - 6, my2 - 24, tw + 12, 18)
        ctx.fillStyle = '#fff'; ctx.fillText(label, mx2, my2 - 11)
      }
    }
  }, [nodes, walls, openings, pan, zoom, draft, mouse, tool, size, shiftKey, furniture, selectedFurnitureId, hoverWall, hoverFurn, selWall, measure, selRoom, roomMeta])

  useEffect(() => { draw() }, [draw])

  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'wall', icon: <Pencil size={15} />, label: 'კედელი' },
    { id: 'select', icon: <MousePointer2 size={15} />, label: 'მონიშვნა' },
    { id: 'door', icon: <DoorOpen size={15} />, label: 'კარი' },
    { id: 'window', icon: <RectangleHorizontal size={15} />, label: 'ფანჯარა' },
    { id: 'erase', icon: <Eraser size={15} />, label: 'წაშლა' },
    { id: 'furniture', icon: <Sofa size={15} />, label: 'ავეჯი' },
    { id: 'measure', icon: <Ruler size={15} />, label: 'საზომი' },
  ]

  return (
    <div className="relative flex h-full flex-col bg-surface">
      {/* ავეჯის პალიტრა — ჩანს furniture tool-ის დროს */}
      {tool === 'furniture' && (
        <div className="absolute left-1/2 top-14 z-20 flex -translate-x-1/2 flex-wrap justify-center gap-1 rounded-xl border border-gray-200 bg-white/95 p-1.5 shadow-lg backdrop-blur">
          {VALID_FURNITURE_TYPES.map(ty => {
            const c = FURNITURE_CATALOG[ty]
            return (
              <button key={ty} onClick={() => setFurnType(ty)}
                title={c.label}
                className={`flex flex-col items-center rounded-lg px-2.5 py-1.5 text-lg ${furnType === ty ? 'bg-brand/15 ring-1 ring-brand' : 'hover:bg-gray-100'}`}>
                <span>{c.icon}</span>
                <span className="text-[9px] text-gray-500">{c.label}</span>
              </button>
            )
          })}
        </div>
      )}
      {/* კედლის სიგრძის ციფრული ველი — ჩანს ხაზვისას */}
      {tool === 'wall' && draft && (
        <div className="absolute left-1/2 top-14 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-gray-200 bg-white/95 px-3 py-1.5 shadow-lg backdrop-blur">
          <span className="text-xs text-gray-500">სიგრძე</span>
          <input
            value={lenInput}
            inputMode="decimal"
            onFocus={() => { lenFocus.current = true }}
            onBlur={() => { lenFocus.current = false }}
            onChange={(e) => setLenInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitLen(); (e.target as HTMLInputElement).blur() }
            }}
            className="w-16 rounded-md border border-gray-300 px-2 py-0.5 text-right text-sm focus:border-brand focus:outline-none"
          />
          <span className="text-xs text-gray-400">მ · Enter</span>
        </div>
      )}

      {/* კედლის ზომები — ჩანს select tool-ში კედლის მონიშვნისას */}
      {tool === 'select' && selWallObj && (
        <div className="absolute bottom-9 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-gray-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
          <span className="text-xs font-semibold text-gray-700">კედელი</span>
          <label className="flex items-center gap-1 text-xs text-gray-500">
            სისქე(სმ)
            <input type="number" min={4} step={1} value={Math.round(selWallObj.thickness * 100)}
              onChange={(e) => setWallDims(selWallObj.id, { thickness: (parseFloat(e.target.value) || 4) / 100 })}
              className="w-14 rounded-md border border-gray-300 px-1.5 py-0.5 text-right text-sm focus:border-brand focus:outline-none" />
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-500">
            სიმაღლე(მ)
            <input type="number" min={1} step={0.1} value={selWallObj.height}
              onChange={(e) => setWallDims(selWallObj.id, { height: Math.max(1, parseFloat(e.target.value) || 1) })}
              className="w-16 rounded-md border border-gray-300 px-1.5 py-0.5 text-right text-sm focus:border-brand focus:outline-none" />
          </label>
          <button onClick={() => { removeWall(selWallObj.id); setSelWall(null) }}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50">
            <Trash2 size={13} /> წაშლა
          </button>
        </div>
      )}

      {/* ოთახის სახელი/ტიპი — ჩანს select tool-ში ოთახზე კლიკისას */}
      {tool === 'select' && selRoomObj && (
        <div className="absolute bottom-9 left-1/2 z-20 flex -translate-x-1/2 flex-col gap-2 rounded-xl border border-gray-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-700">ოთახი · {selRoomObj.area.toFixed(1)} მ²</span>
            <input
              value={roomMeta[selRoomObj.id]?.name ?? ''}
              placeholder={roomMeta[selRoomObj.id]?.type ? ROOM_TYPES[roomMeta[selRoomObj.id]!.type!].label : 'სახელი...'}
              onChange={(e) => setRoomMeta(selRoomObj.id, { name: e.target.value })}
              className="w-40 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
            />
            <button
              onClick={handleAutoFurnish}
              disabled={!roomMeta[selRoomObj.id]?.type}
              title={roomMeta[selRoomObj.id]?.type ? 'AI ჩააწყობს ავეჯს ტიპის მიხედვით' : 'ჯერ ტიპი აირჩიე ქვემოთ'}
              className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Wand2 size={13} /> AI გაწყობა
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {ROOM_TYPE_LIST.map((t) => {
              const active = roomMeta[selRoomObj.id]?.type === t.type
              return (
                <button key={t.type}
                  onClick={() => setRoomMeta(selRoomObj.id, { type: t.type })}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium ${active ? 'bg-brand text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                  {t.icon} {t.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ავეჯის ზუსტი ზომა/კუთხე — ჩანს მონიშვნისას */}
      {tool === 'furniture' && selFurn && (
        <div className="absolute bottom-9 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-gray-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
          <span className="text-xs font-semibold text-gray-700">{selFurn.label}</span>
          <label className="flex items-center gap-1 text-xs text-gray-500">
            სიგანე
            <input type="number" min={0.2} step={0.1} value={selFurn.width}
              onChange={(e) => updateFurniture(selFurn.id, { width: Math.max(0.2, parseFloat(e.target.value) || 0.2) })}
              className="w-14 rounded-md border border-gray-300 px-1.5 py-0.5 text-right text-sm focus:border-brand focus:outline-none" />
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-500">
            სიღრმე
            <input type="number" min={0.2} step={0.1} value={selFurn.depth}
              onChange={(e) => updateFurniture(selFurn.id, { depth: Math.max(0.2, parseFloat(e.target.value) || 0.2) })}
              className="w-14 rounded-md border border-gray-300 px-1.5 py-0.5 text-right text-sm focus:border-brand focus:outline-none" />
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-500">
            კუთხე°
            <input type="number" step={5} value={Math.round((((selFurn.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * 180 / Math.PI)}
              onChange={(e) => updateFurniture(selFurn.id, { rotation: (parseFloat(e.target.value) || 0) * Math.PI / 180 })}
              className="w-14 rounded-md border border-gray-300 px-1.5 py-0.5 text-right text-sm focus:border-brand focus:outline-none" />
          </label>
          <button
            onClick={() => {
              const id = 'f_' + Math.random().toString(36).slice(2, 9)
              addFurniture({ ...selFurn, id, x: selFurn.x + 0.4, z: selFurn.z + 0.4 })
              setSelectedFurniture(id)
            }}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100">
            <Copy size={13} /> დუბლიკატი
          </button>
          <button onClick={() => removeFurniture(selFurn.id)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50">
            <Trash2 size={13} /> წაშლა
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-2">
        <span className="mr-3 text-sm font-semibold text-gray-700">Wall-graph რედაქტორი (beta)</span>
        {tools.map(t => (
          <button key={t.id} onClick={() => { setTool(t.id); setDraft(null); setSelWall(null); setSelRoom(null); setMeasure(null) }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${tool === t.id ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {t.icon}{t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={unifiedUndo} disabled={!canUndo} title="დაბრუნება (Ctrl+Z)"
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${canUndo ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}>
            <Undo2 size={15} />
          </button>
          <button onClick={unifiedRedo} disabled={!canRedo} title="გამეორება (Ctrl+Y)"
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${canRedo ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}>
            <Redo2 size={15} />
          </button>
          <button onClick={exportPlanPNG} title="გეგმა → PNG" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
            <Download size={15} /> PNG
          </button>
          <button onClick={() => usePlanStore.getState().clearPlan()} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-red-500 hover:bg-red-50">
            <Trash2 size={15} /> გასუფთავება
          </button>
        </div>
      </div>
      <div ref={wrapRef} className="flex-1 overflow-hidden">
        <canvas ref={canvasRef} width={size.w} height={size.h}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onWheel={onWheel} onContextMenu={e => e.preventDefault()}
          className="block cursor-crosshair" />
      </div>
      <div className="border-t border-gray-100 bg-white px-4 py-1.5 text-xs text-gray-400">
        {tool === 'furniture'
          ? 'ავეჯი: აირჩიე ტიპი → კლიკი გეგმაზე · გადათრევა — გადატანა (კედელს ეკვრება) · R — მოტრიალება · Ctrl+D — დუბლიკატი · Del — წაშლა'
          : tool === 'erase'
            ? 'წაშლა: დააკლიკე კედელს, კარს/ფანჯარას ან ავეჯს → წაიშლება · Ctrl+Z — დაბრუნება'
            : tool === 'select'
              ? 'მონიშვნა: node — გადათრევა · კედელი — სისქე/სიმაღლე · ოთახი — სახელი/ტიპი · Del — წაშლა'
              : tool === 'measure'
                ? 'საზომი: კლიკი → კლიკი = მანძილი · ხელახლა კლიკი — ახალი გაზომვა · Esc — გასუფთავება'
                : 'კედლის ხატვა: კლიკი → კლიკი → … (ჯაჭვი) · Shift — 45° · მარჯვ. კლიკი / Esc — დასრულება · შუა ღილაკი — pan · scroll — zoom'}
      </div>
    </div>
  )
}
