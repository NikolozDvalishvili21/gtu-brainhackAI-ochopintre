'use client'
import { useMemo, useState, useEffect, Suspense } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Environment, useGLTF } from '@react-three/drei'
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
      const w = img.naturalWidth, h = img.naturalHeight
      const cr = crop ?? { x: 0, y: 0, w: 1, h: 1 }
      const sx = Math.max(0, Math.round(cr.x * w)), sy = Math.max(0, Math.round(cr.y * h))
      const sw = Math.max(1, Math.min(w - sx, Math.round(cr.w * w)))
      const sh = Math.max(1, Math.min(h - sy, Math.round(cr.h * h)))
      const c = document.createElement('canvas'); c.width = sw; c.height = sh
      c.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(repeat, repeat)
      t.needsUpdate = true
      setTex(t)
    }
    img.onerror = () => {}
    img.src = proxied(url)
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, crop?.x, crop?.y, crop?.w, crop?.h])
  useEffect(() => { if (tex) { tex.repeat.set(repeat, repeat); tex.needsUpdate = true } }, [tex, repeat])
  return tex
}

const DOOR_H = 2.1
const WIN_SILL = 0.9
const WIN_H = 1.2

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

function WallMesh3D({ wall, a, b, ops, assign, selected, onSelect }: {
  wall: Wall; a: PlanNode; b: PlanNode; ops: Opening[]
  assign?: WallMaterialAssignment; selected: boolean; onSelect: () => void
}) {
  const dx = b.x - a.x
  const dz = b.y - a.y // plan-y → 3D z
  const len = Math.hypot(dx, dz) || 0.001
  const ux = dx / len
  const uz = dz / len
  const rotY = -Math.atan2(uz, ux)
  const openings: Op[] = ops.map((o) => ({ start: o.t * len - o.width / 2, width: o.width, type: o.type }))
  const solids = splitWall(len, wall.height, openings)
  const tex = useImageTexture(assign?.material?.image, assign?.texRepeat ?? 2, assign?.crop)
  const color = assign?.color?.color
  return (
    <group onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect() }}>
      {solids.map((s, i) => {
        const c = s.start + s.len / 2
        return (
          <mesh
            key={i}
            position={[a.x + ux * c, s.yBase + s.h / 2, a.y + uz * c]}
            rotation={[0, rotY, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[s.len, s.h, wall.thickness]} />
            <meshStandardMaterial
              key={tex ? 'tex' : 'plain'}
              map={tex ?? undefined}
              color={tex ? '#ffffff' : color ?? '#EFEAE2'}
              roughness={0.9}
              emissive={selected ? '#2D6A4F' : '#000000'}
              emissiveIntensity={selected ? 0.25 : 0}
            />
          </mesh>
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
  const tex = useImageTexture(mat?.image, mat?.texRepeat ?? 2, mat?.crop)
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
  return (
    <group position={[item.x, item.y, item.z]} rotation={[0, item.rotation, 0]} scale={item.scale ?? 1}>
      <primitive object={model} scale={scale} position={pos} />
    </group>
  )
}

export default function PlanScene3D() {
  const { nodes, walls, openings } = usePlanStore()
  // მასალები/მონიშვნა — არსებული room-store-დან (არსებული Sidebar მართავს)
  const {
    selectedWallKey, wallMaterials, setSelectedWall,
    selectedFloorRoomId, floorMaterials, setSelectedFloor,
    furniture,
  } = useRoomStore()
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

  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [bbox.cx + d * 0.5, d * 0.7, bbox.cz + d * 0.8], fov: 48 }}
        shadows
        gl={{ preserveDrawingBuffer: true }}
        onPointerMissed={() => { setSelectedWall(null); setSelectedFloor(null) }}
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
              assign={wallMaterials[w.id]}
              selected={selectedWallKey === w.id}
              onSelect={() => setSelectedWall(w.id)}
            />
          )
        })}
        {furniture.map((f) =>
          MODEL_URLS[f.type] ? (
            <Suspense key={f.id} fallback={null}>
              <FurnitureModel item={f} url={MODEL_URLS[f.type]} />
            </Suspense>
          ) : null,
        )}
        <OrbitControls target={[bbox.cx, 1, bbox.cz]} maxPolarAngle={Math.PI / 2.05} />
        <Environment preset="apartment" />
      </Canvas>
    </div>
  )
}
