'use client'
import { useMemo, useState, useEffect, useRef, Suspense } from 'react'
import { Canvas, useThree, useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Environment, useGLTF, TransformControls, PointerLockControls } from '@react-three/drei'
import { Move, RotateCw as RotateIcon, Maximize2, Trash2 } from 'lucide-react'
import * as THREE from 'three'
import { usePlanStore } from '@/lib/store/plan-store'
import { useRoomStore } from '@/lib/store/room-store'
import type { WallMaterialAssignment, MaterialRef, Crop, Furniture } from '@/lib/store/room-store'
import { detectRooms } from '@/lib/plan/graph'
import type { PlanNode, Wall, Opening } from '@/lib/plan/types'

const API_BASE = 'https://interior-materials-api.onrender.com'
const proxied = (url: string) =>
  url.startsWith('http') ? `${API_BASE}/img?url=${encodeURIComponent(url)}` : url

// სურათი → THREE ტექსტურა (crop + repeat + /img proxy) — Scene3D-ის ანალოგი
function useImageTexture(url?: string | null, repeat = 2, crop?: Crop): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!url) { setTex(null); return }
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      const w0 = img.naturalWidth, h0 = img.naturalHeight
      // 1) crop
      const cr = crop ?? { x: 0, y: 0, w: 1, h: 1 }
      const sx = Math.max(0, Math.round(cr.x * w0)), sy = Math.max(0, Math.round(cr.y * h0))
      const sw = Math.max(1, Math.min(w0 - sx, Math.round(cr.w * w0)))
      const sh = Math.max(1, Math.min(h0 - sy, Math.round(cr.h * h0)))
      const cropC = document.createElement('canvas'); cropC.width = sw; cropC.height = sh
      cropC.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
      // 2) თავისუფალი მოტრიალება — repeat-pattern-ით ვავსებ (კიდეები არ ცარიელდება, shear არ ხდება)
      const rot = (((crop?.rot ?? 0) % 360) + 360) % 360
      let src: HTMLCanvasElement = cropC
      if (rot !== 0) {
        const out = document.createElement('canvas'); out.width = sw; out.height = sh
        const octx = out.getContext('2d')!
        const pat = octx.createPattern(cropC, 'repeat')!
        octx.translate(sw / 2, sh / 2)
        octx.rotate((rot * Math.PI) / 180)
        octx.fillStyle = pat
        const big = Math.ceil(Math.hypot(sw, sh)) + 2
        octx.fillRect(-big, -big, big * 2, big * 2)
        src = out
      }
      const t = new THREE.CanvasTexture(src)
      t.colorSpace = THREE.SRGBColorSpace
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(repeat, repeat)
      t.needsUpdate = true
      setTex(t)
    }
    img.onerror = () => { console.warn('[texture] ვერ ჩაიტვირთა:', url, '→', proxied(url)) }
    img.src = proxied(url)
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, crop?.x, crop?.y, crop?.w, crop?.h, crop?.rot])
  useEffect(() => { if (tex) { tex.repeat.set(repeat, repeat); tex.needsUpdate = true } }, [tex, repeat])
  return tex
}

const DOOR_H = 2.1
const WIN_SILL = 0.9
const WIN_H = 1.2

// texRepeat (პატერნის ზომის სლაიდერი) → tiles/მეტრში. მაღალი = პატარა პატერნი.
const tilesPerMeter = (texRepeat = 2) => texRepeat / 3

type Solid = { start: number; len: number; yBase: number; h: number }
type Op = { start: number; width: number; type: 'door' | 'window' }

// კედლის გაყოფა ღიობების გარშემო (door/window)
function splitWall(len: number, h: number, ops: Op[]): Solid[] {
  const sorted = [...ops].sort((a, b) => a.start - b.start)
  const solid: Solid[] = []
  let cursor = 0
  for (const op of sorted) {
    const s = Math.max(cursor, op.start)
    if (s > cursor) solid.push({ start: cursor, len: s - cursor, yBase: 0, h })
    if (op.type === 'door') {
      const lint = h - DOOR_H
      if (lint > 0.02) solid.push({ start: s, len: op.width, yBase: DOOR_H, h: lint })
    } else {
      solid.push({ start: s, len: op.width, yBase: 0, h: WIN_SILL })
      const head = h - WIN_SILL - WIN_H
      if (head > 0.02) solid.push({ start: s, len: op.width, yBase: WIN_SILL + WIN_H, h: head })
    }
    cursor = s + op.width
  }
  if (cursor < len) solid.push({ start: cursor, len: len - cursor, yBase: 0, h })
  return solid
}

const EDGE_COLOR = '#E8E3DB' // კედლის წიბოები (სისქე)

// ტექსტურის სეგმენტ-კლონი: repeat/offset სეგმენტის რეალური ზომა/პოზიციით → უწყვეტი
// (მოტრიალება უკვე ჩაშენებულია სურათში crop-ის ეტაპზე)
function segTexture(base: THREE.Texture | null, s: Solid, tpm: number): THREE.Texture | null {
  if (!base) return null
  const t = base.clone()
  t.repeat.set(tpm * s.len, tpm * s.h)
  t.offset.set(tpm * s.start, tpm * s.yBase)
  t.needsUpdate = true
  return t
}

// ერთი კედლის სეგმენტი — ორმხრივი: +Z მხარე (A) და −Z მხარე (B) ცალ-ცალკე მასალით.
// კლიკი face-ის ნორმალით ცნობს რომელ მხარეს დააჭირე.
function WallSegment({
  s, baseTexA, baseTexB, assignA, assignB, thickness, position, rotY, wallId, selKey, onSelect,
}: {
  s: Solid; baseTexA: THREE.Texture | null; baseTexB: THREE.Texture | null
  assignA?: WallMaterialAssignment; assignB?: WallMaterialAssignment
  thickness: number; position: [number, number, number]; rotY: number
  wallId: string; selKey: string | null; onSelect: (side: 'A' | 'B') => void
}) {
  const tpmA = tilesPerMeter(assignA?.texRepeat ?? 2)
  const tpmB = tilesPerMeter(assignB?.texRepeat ?? 2)
  const texA = useMemo(() => segTexture(baseTexA, s, tpmA), [baseTexA, s.start, s.len, s.yBase, s.h, tpmA])
  const texB = useMemo(() => segTexture(baseTexB, s, tpmB), [baseTexB, s.start, s.len, s.yBase, s.h, tpmB])
  const selA = selKey === `${wallId}#A`
  const selB = selKey === `${wallId}#B`
  const colorA = assignA?.color?.color
  const colorB = assignB?.color?.color
  return (
    <mesh
      position={position}
      rotation={[0, rotY, 0]}
      castShadow
      receiveShadow
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        onSelect(e.face && e.face.normal.z >= 0 ? 'A' : 'B')
      }}
    >
      <boxGeometry args={[s.len, s.h, thickness]} />
      {/* წიბოები (±x, ±y) */}
      <meshStandardMaterial attach="material-0" color={EDGE_COLOR} roughness={0.9} />
      <meshStandardMaterial attach="material-1" color={EDGE_COLOR} roughness={0.9} />
      <meshStandardMaterial attach="material-2" color={EDGE_COLOR} roughness={0.9} />
      <meshStandardMaterial attach="material-3" color={EDGE_COLOR} roughness={0.9} />
      {/* +Z მხარე (A) */}
      <meshStandardMaterial
        attach="material-4"
        key={texA ? 'tA' : 'pA'}
        map={texA ?? undefined}
        color={texA ? '#ffffff' : colorA ?? '#EFEAE2'}
        roughness={0.9}
        emissive={selA ? '#2D6A4F' : '#000000'}
        emissiveIntensity={selA ? 0.25 : 0}
      />
      {/* −Z მხარე (B) */}
      <meshStandardMaterial
        attach="material-5"
        key={texB ? 'tB' : 'pB'}
        map={texB ?? undefined}
        color={texB ? '#ffffff' : colorB ?? '#EFEAE2'}
        roughness={0.9}
        emissive={selB ? '#2D6A4F' : '#000000'}
        emissiveIntensity={selB ? 0.25 : 0}
      />
    </mesh>
  )
}

// კარის ფოთოლი + ჩარჩო / ფანჯრის შუშა + ჩარჩო — ღიობი რომ კარს/ფანჯარას ჰგავდეს
function OpeningVisual({ o, px, pz, rotY, thickness }: {
  o: Opening; px: number; pz: number; rotY: number; thickness: number
}) {
  const isDoor = o.type === 'door'
  const h = isDoor ? DOOR_H : WIN_H
  const yBase = isDoor ? 0 : WIN_SILL
  const yC = yBase + h / 2
  const frameT = thickness + 0.05
  const j = 0.06 // ჩარჩოს სისქე
  const FRAME = '#6b5440'
  return (
    <group position={[px, 0, pz]} rotation={[0, rotY, 0]}>
      {/* ჯამები (გვერდები) */}
      <mesh position={[-(o.width / 2 + j / 2), yC, 0]} castShadow>
        <boxGeometry args={[j, h, frameT]} />
        <meshStandardMaterial color={FRAME} roughness={0.7} />
      </mesh>
      <mesh position={[o.width / 2 + j / 2, yC, 0]} castShadow>
        <boxGeometry args={[j, h, frameT]} />
        <meshStandardMaterial color={FRAME} roughness={0.7} />
      </mesh>
      {/* ლინტელი (თავი) */}
      <mesh position={[0, yBase + h + j / 2, 0]} castShadow>
        <boxGeometry args={[o.width + j * 2, j, frameT]} />
        <meshStandardMaterial color={FRAME} roughness={0.7} />
      </mesh>
      {isDoor ? (
        <>
          {/* კარის ფოთოლი */}
          <mesh position={[0, yC, 0]} castShadow>
            <boxGeometry args={[o.width - 0.02, h - 0.02, 0.04]} />
            <meshStandardMaterial color="#9c7a52" roughness={0.55} />
          </mesh>
          {/* სახელური */}
          <mesh position={[o.width / 2 - 0.12, yC, 0.04]}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.3} />
          </mesh>
        </>
      ) : (
        <>
          {/* შირისთავი (sill) */}
          <mesh position={[0, WIN_SILL, 0]} castShadow>
            <boxGeometry args={[o.width + j * 2, j, frameT]} />
            <meshStandardMaterial color={FRAME} roughness={0.7} />
          </mesh>
          {/* შუშა */}
          <mesh position={[0, yC, 0]}>
            <boxGeometry args={[o.width - 0.02, h - 0.02, 0.02]} />
            <meshStandardMaterial color="#bcd4e6" roughness={0.1} metalness={0.1} transparent opacity={0.35} />
          </mesh>
        </>
      )}
    </group>
  )
}

function WallMesh3D({ wall, a, b, ops, assignA, assignB, selKey, onSelect }: {
  wall: Wall; a: PlanNode; b: PlanNode; ops: Opening[]
  assignA?: WallMaterialAssignment; assignB?: WallMaterialAssignment
  selKey: string | null; onSelect: (side: 'A' | 'B') => void
}) {
  const dx = b.x - a.x
  const dz = b.y - a.y // plan-y → 3D z
  const len = Math.hypot(dx, dz) || 0.001
  const ux = dx / len
  const uz = dz / len
  const rotY = -Math.atan2(uz, ux)
  const openings: Op[] = ops.map((o) => ({ start: o.t * len - o.width / 2, width: o.width, type: o.type }))
  const solids = splitWall(len, wall.height, openings)
  const baseTexA = useImageTexture(assignA?.material?.image, 1, assignA?.crop)
  const baseTexB = useImageTexture(assignB?.material?.image, 1, assignB?.crop)
  return (
    <group>
      {solids.map((s, i) => {
        const c = s.start + s.len / 2
        return (
          <WallSegment
            key={i}
            s={s}
            baseTexA={baseTexA}
            baseTexB={baseTexB}
            assignA={assignA}
            assignB={assignB}
            thickness={wall.thickness}
            position={[a.x + ux * c, s.yBase + s.h / 2, a.y + uz * c]}
            rotY={rotY}
            wallId={wall.id}
            selKey={selKey}
            onSelect={onSelect}
          />
        )
      })}
      {ops.map((o) => {
        const c = o.t * len
        return (
          <OpeningVisual
            key={o.id}
            o={o}
            px={a.x + ux * c}
            pz={a.y + uz * c}
            rotY={rotY}
            thickness={wall.thickness}
          />
        )
      })}
    </group>
  )
}

function RoomFloor({ ids, nodes, mat, selected, onSelect }: {
  ids: string[]; nodes: PlanNode[]
  mat?: MaterialRef; selected: boolean; onSelect: () => void
}) {
  const geo = useMemo(() => {
    const shape = new THREE.Shape()
    ids.forEach((id, i) => {
      const n = nodes.find((nn) => nn.id === id)
      if (!n) return
      if (i === 0) shape.moveTo(n.x, n.y)
      else shape.lineTo(n.x, n.y)
    })
    return new THREE.ShapeGeometry(shape)
  }, [ids, nodes])
  const tex = useImageTexture(mat?.image, 1, mat?.crop)
  // ShapeGeometry-ის UV = shape coords (მეტრებში) → repeat = tiles/მეტრში
  // (მოტრიალება ჩაშენებულია სურათში crop-ის ეტაპზე)
  const tpm = tilesPerMeter(mat?.texRepeat ?? 2)
  useEffect(() => {
    if (!tex) return
    tex.repeat.set(tpm, tpm)
    tex.needsUpdate = true
  }, [tex, tpm])
  // +π/2 X-ზე: shape (x,y) → 3D (x, 0, y) — ემთხვევა კედლების z=node.y-ს
  return (
    <mesh
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, 0.01, 0]}
      receiveShadow
      geometry={geo}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect() }}
    >
      <meshStandardMaterial
        key={tex ? 'tex' : 'plain'}
        map={tex ?? undefined}
        color={tex ? '#ffffff' : '#C8A877'}
        roughness={0.85}
        side={THREE.DoubleSide}
        emissive={selected ? '#2D6A4F' : '#000000'}
        emissiveIntensity={selected ? 0.2 : 0}
      />
    </mesh>
  )
}

// ─── Furniture (Kenney GLB, CC0) ──────────────────────────────────────────────
const MODEL_URLS: Record<string, string> = {
  sofa: '/models/sofa.glb', chair: '/models/chair.glb', table: '/models/table.glb',
  bed: '/models/bed.glb', plant: '/models/plant.glb', wardrobe: '/models/wardrobe.glb',
  desk: '/models/desk.glb', lamp: '/models/lamp.glb',
}
Object.values(MODEL_URLS).forEach((u) => useGLTF.preload(u))

function FurnitureModel({ item, url }: { item: Furniture; url: string }) {
  const { scene } = useGLTF(url)
  const model = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    return c
  }, [scene])
  const { scale, pos } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(model)
    const size = new THREE.Vector3(); const center = new THREE.Vector3()
    box.getSize(size); box.getCenter(center)
    const s = size.x > 0 ? item.width / size.x : 1
    return { scale: s, pos: [-center.x * s, -box.min.y * s, -center.z * s] as [number, number, number] }
  }, [model, item.width])
  return <primitive object={model} scale={scale} position={pos} />
}

// ავეჯის ერთეული — მონიშვნა + გადაადგილება/მოტრიალება/ზომა გიზმოთი
function FurnitureItem({ item }: { item: Furniture }) {
  const { setSelectedFurniture, selectedFurnitureId, transformMode, updateFurniture } = useRoomStore()
  const isSelected = selectedFurnitureId === item.id
  const groupRef = useRef<THREE.Group>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => { setReady(true) }, [])
  const url = MODEL_URLS[item.type]
  if (!url) return null
  const commit = () => {
    const g = groupRef.current
    if (!g) return
    updateFurniture(item.id, {
      x: g.position.x, z: g.position.z,
      rotation: g.rotation.y, scale: Math.max(0.2, g.scale.x),
    })
  }
  const show =
    transformMode === 'translate' ? { showX: true, showY: false, showZ: true }
      : transformMode === 'rotate' ? { showX: false, showY: true, showZ: false }
        : { showX: true, showY: true, showZ: true }
  return (
    <>
      <group
        ref={groupRef}
        position={[item.x, item.y, item.z]}
        rotation={[0, item.rotation, 0]}
        scale={item.scale ?? 1}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setSelectedFurniture(item.id) }}
      >
        <Suspense fallback={null}>
          <FurnitureModel item={item} url={url} />
        </Suspense>
      </group>
      {isSelected && ready && groupRef.current && (
        <TransformControls object={groupRef.current} mode={transformMode} {...show} onObjectChange={commit} />
      )}
    </>
  )
}

// ─── First-person walk ────────────────────────────────────────────────────────
const EYE_H = 1.6
function FirstPersonMovement({ bbox }: { bbox: { cx: number; cz: number; span: number } }) {
  const { camera } = useThree()
  const keys = useRef<Record<string, boolean>>({})
  useEffect(() => {
    camera.position.set(bbox.cx, EYE_H, bbox.cz)
    camera.lookAt(bbox.cx, EYE_H, bbox.cz - 1)
    const down = (e: KeyboardEvent) => { keys.current[e.code] = true }
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      keys.current = {}
    }
  }, [camera, bbox.cx, bbox.cz])
  useFrame((_, delta) => {
    const k = keys.current
    const fwd = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0)
    const str = (k['KeyD'] || k['ArrowRight'] ? 1 : 0) - (k['KeyA'] || k['ArrowLeft'] ? 1 : 0)
    if (fwd === 0 && str === 0) return
    const speed = 3 * delta
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir); dir.y = 0; dir.normalize()
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize()
    camera.position.addScaledVector(dir, fwd * speed)
    camera.position.addScaledVector(right, str * speed)
    camera.position.y = EYE_H
    const half = bbox.span / 2 + 1
    camera.position.x = Math.min(bbox.cx + half, Math.max(bbox.cx - half, camera.position.x))
    camera.position.z = Math.min(bbox.cz + half, Math.max(bbox.cz - half, camera.position.z))
  })
  return null
}

export default function PlanScene3D() {
  const { nodes, walls, openings } = usePlanStore()
  // მასალები/მონიშვნა — არსებული room-store-დან (არსებული Sidebar მართავს)
  const {
    selectedWallKey, wallMaterials, setSelectedWall,
    selectedFloorRoomId, floorMaterials, setSelectedFloor,
    furniture, selectedFurnitureId, setSelectedFurniture,
    transformMode, setTransformMode, removeFurniture, updateFurniture,
    setWallKeys,
  } = useRoomStore()
  // „ყველა კედელზე" — ორივე მხარის key-ები რეგისტრირდება
  useEffect(() => {
    setWallKeys(walls.flatMap((w) => [`${w.id}#A`, `${w.id}#B`]))
  }, [walls, setWallKeys])
  const [firstPerson, setFirstPerson] = useState(false)
  const [locked, setLocked] = useState(false)
  useEffect(() => {
    const onChange = () => setLocked(!!document.pointerLockElement)
    document.addEventListener('pointerlockchange', onChange)
    return () => document.removeEventListener('pointerlockchange', onChange)
  }, [])
  const selFurn = furniture.find((f) => f.id === selectedFurnitureId)
  const furnDeg = selFurn
    ? Math.round(((((selFurn.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * 180) / Math.PI)
    : 0
  const rooms = useMemo(() => detectRooms(nodes, walls), [nodes, walls])
  const opsByWall = useMemo(() => {
    const m = new Map<string, Opening[]>()
    for (const o of openings) {
      if (!m.has(o.wallId)) m.set(o.wallId, [])
      m.get(o.wallId)!.push(o)
    }
    return m
  }, [openings])
  const bbox = useMemo(() => {
    if (!nodes.length) return { cx: 0, cz: 0, span: 8 }
    let minx = Infinity, minz = Infinity, maxx = -Infinity, maxz = -Infinity
    for (const n of nodes) {
      minx = Math.min(minx, n.x); minz = Math.min(minz, n.y)
      maxx = Math.max(maxx, n.x); maxz = Math.max(maxz, n.y)
    }
    return { cx: (minx + maxx) / 2, cz: (minz + maxz) / 2, span: Math.max(maxx - minx, maxz - minz, 4) }
  }, [nodes])
  const d = bbox.span * 1.3 + 5

  const gizmoTools = [
    { m: 'translate' as const, icon: <Move size={15} />, label: 'გადატანა' },
    { m: 'rotate' as const, icon: <RotateIcon size={15} />, label: 'მოტრიალება' },
    { m: 'scale' as const, icon: <Maximize2 size={15} />, label: 'ზომა' },
  ]

  return (
    <div className="relative w-full h-full">
      {selectedFurnitureId && selFurn && !firstPerson && (
        <div className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 flex-col items-stretch gap-1.5 rounded-xl border border-gray-200 bg-white/95 p-1.5 shadow-lg backdrop-blur">
          <div className="flex items-center gap-1">
            {gizmoTools.map((b) => (
              <button
                key={b.m}
                onClick={() => setTransformMode(b.m)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  transformMode === b.m ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {b.icon} {b.label}
              </button>
            ))}
            <div className="mx-0.5 h-5 w-px bg-gray-200" />
            <button
              onClick={() => removeFurniture(selectedFurnitureId)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
            >
              <Trash2 size={15} /> წაშლა
            </button>
          </div>
          {/* ზუსტი მოტრიალების სლაიდერი — გიზმოს ალტერნატივა */}
          <div className="flex items-center gap-2 px-2 py-1">
            <RotateIcon size={13} className="shrink-0 text-gray-400" />
            <input
              type="range" min={0} max={360} step={1}
              value={furnDeg}
              onChange={(e) =>
                updateFurniture(selectedFurnitureId, {
                  rotation: (parseFloat(e.target.value) * Math.PI) / 180,
                })
              }
              className="w-44 accent-gray-900 cursor-pointer"
            />
            <span className="w-9 text-right text-[11px] tabular-nums text-gray-500">{furnDeg}°</span>
          </div>
        </div>
      )}
      <Canvas
        camera={{ position: [bbox.cx + d * 0.5, d * 0.7, bbox.cz + d * 0.8], fov: 48 }}
        shadows
        gl={{ preserveDrawingBuffer: true }}
        onPointerMissed={() => { setSelectedWall(null); setSelectedFloor(null); setSelectedFurniture(null) }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[bbox.cx + 6, 12, bbox.cz + 6]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#D6D0C8" roughness={1} />
        </mesh>
        {rooms.map((r) => (
          <RoomFloor
            key={r.id}
            ids={r.nodeIds}
            nodes={nodes}
            mat={floorMaterials[r.id]}
            selected={selectedFloorRoomId === r.id}
            onSelect={() => setSelectedFloor(r.id)}
          />
        ))}
        {walls.map((w) => {
          const a = nodes.find((n) => n.id === w.a)
          const b = nodes.find((n) => n.id === w.b)
          if (!a || !b) return null
          return (
            <WallMesh3D
              key={w.id}
              wall={w}
              a={a}
              b={b}
              ops={opsByWall.get(w.id) ?? []}
              assignA={wallMaterials[`${w.id}#A`]}
              assignB={wallMaterials[`${w.id}#B`]}
              selKey={selectedWallKey}
              onSelect={(side) => setSelectedWall(`${w.id}#${side}`)}
            />
          )
        })}
        {furniture.map((f) => <FurnitureItem key={f.id} item={f} />)}
        {firstPerson ? (
          <>
            <FirstPersonMovement bbox={bbox} />
            <PointerLockControls selector="#fp-enter" />
          </>
        ) : (
          <OrbitControls makeDefault target={[bbox.cx, 1, bbox.cz]} maxPolarAngle={Math.PI / 2.05} />
        )}
        <Environment preset="apartment" />
      </Canvas>

      {/* ადამიანის ხედის ღილაკი */}
      {!firstPerson && (
        <button
          onClick={() => { setSelectedWall(null); setSelectedFloor(null); setSelectedFurniture(null); setFirstPerson(true) }}
          className="absolute right-4 top-4 z-30 flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white/95 px-3 py-2 text-xs font-medium text-gray-700 shadow-lg backdrop-blur hover:bg-gray-50"
        >
          👁 ადამიანის ხედი
        </button>
      )}

      {/* walk mode overlay */}
      {firstPerson && (
        <>
          <button
            id="fp-enter"
            className={`absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-black/75 px-6 py-4 text-sm font-medium text-white shadow-xl backdrop-blur transition-opacity ${
              locked ? 'pointer-events-none opacity-0' : 'opacity-100'
            }`}
          >
            ▶ დააკლიკე გადასაადგილებლად
          </button>
          <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-xl bg-black/70 px-4 py-2 text-center text-xs text-white backdrop-blur">
            <b>WASD / ისრები</b> — სიარული · <b>მაუსი</b> — ყურება · <b>Esc</b> — კურსორის გათავისუფლება
          </div>
          <button
            onClick={() => setFirstPerson(false)}
            className="absolute right-4 top-4 z-30 rounded-xl bg-white/95 px-3 py-2 text-xs font-medium text-gray-700 shadow-lg backdrop-blur hover:bg-gray-50"
          >
            ✕ გასვლა
          </button>
        </>
      )}
    </div>
  )
}
