'use client'
import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import * as THREE from 'three'
import { usePlanStore } from '@/lib/store/plan-store'
import { detectRooms } from '@/lib/plan/graph'
import type { PlanNode, Wall, Opening } from '@/lib/plan/types'

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

function WallMesh3D({ wall, a, b, ops }: { wall: Wall; a: PlanNode; b: PlanNode; ops: Opening[] }) {
  const dx = b.x - a.x
  const dz = b.y - a.y // plan-y → 3D z
  const len = Math.hypot(dx, dz) || 0.001
  const ux = dx / len
  const uz = dz / len
  const rotY = -Math.atan2(uz, ux)
  const openings: Op[] = ops.map((o) => ({ start: o.t * len - o.width / 2, width: o.width, type: o.type }))
  const solids = splitWall(len, wall.height, openings)
  return (
    <group>
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
            <meshStandardMaterial color="#EFEAE2" roughness={0.9} />
          </mesh>
        )
      })}
    </group>
  )
}

function RoomFloor({ ids, nodes }: { ids: string[]; nodes: PlanNode[] }) {
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
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow geometry={geo}>
      <meshStandardMaterial color="#C8A877" roughness={0.85} side={THREE.DoubleSide} />
    </mesh>
  )
}

export default function PlanScene3D() {
  const { nodes, walls, openings } = usePlanStore()
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
      <Canvas camera={{ position: [bbox.cx + d * 0.5, d * 0.7, bbox.cz + d * 0.8], fov: 48 }} shadows>
        <ambientLight intensity={0.5} />
        <directionalLight position={[bbox.cx + 6, 12, bbox.cz + 6]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#D6D0C8" roughness={1} />
        </mesh>
        {rooms.map((r) => <RoomFloor key={r.id} ids={r.nodeIds} nodes={nodes} />)}
        {walls.map((w) => {
          const a = nodes.find((n) => n.id === w.a)
          const b = nodes.find((n) => n.id === w.b)
          if (!a || !b) return null
          return <WallMesh3D key={w.id} wall={w} a={a} b={b} ops={opsByWall.get(w.id) ?? []} />
        })}
        <OrbitControls target={[bbox.cx, 1, bbox.cz]} maxPolarAngle={Math.PI / 2.05} />
        <Environment preset="apartment" />
      </Canvas>
    </div>
  )
}
