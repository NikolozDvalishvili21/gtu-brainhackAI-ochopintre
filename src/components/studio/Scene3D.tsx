'use client'
import { useRef, useMemo } from 'react'
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Environment, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useRoomStore, Furniture } from '@/lib/store/room-store'

// Texture generator (procedural)
function useTexture(type: string, color: string) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512; canvas.height = 512
    const ctx = canvas.getContext('2d')!

    if (type === 'parquet') {
      ctx.fillStyle = '#C8A882'
      ctx.fillRect(0, 0, 512, 512)
      ctx.strokeStyle = '#A0825A'
      ctx.lineWidth = 2
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 4; j++) {
          const x = i * 64, y = j * 128
          ctx.strokeRect(x + 2, y + 2, 60, 124)
          // wood grain
          ctx.strokeStyle = '#B8926A'
          ctx.lineWidth = 0.5
          for (let g = 0; g < 5; g++) {
            ctx.beginPath()
            ctx.moveTo(x + 8 + g * 10, y + 4)
            ctx.lineTo(x + 8 + g * 10, y + 122)
            ctx.stroke()
          }
          ctx.strokeStyle = '#A0825A'
          ctx.lineWidth = 2
        }
      }
    } else if (type === 'tile') {
      ctx.fillStyle = '#E8E4DF'
      ctx.fillRect(0, 0, 512, 512)
      ctx.strokeStyle = '#C4BDB6'
      ctx.lineWidth = 3
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          ctx.strokeRect(i * 64 + 2, j * 64 + 2, 60, 60)
        }
      }
    } else if (type === 'wallpaper-stripe') {
      ctx.fillStyle = color || '#F5F0EB'
      ctx.fillRect(0, 0, 512, 512)
      ctx.fillStyle = color === '#F5F0EB' ? '#E8E2DA' : '#00000015'
      for (let i = 0; i < 16; i += 2) {
        ctx.fillRect(i * 32, 0, 32, 512)
      }
    } else if (type === 'wallpaper-dots') {
      ctx.fillStyle = color || '#F5F0EB'
      ctx.fillRect(0, 0, 512, 512)
      ctx.fillStyle = '#00000020'
      for (let i = 0; i < 16; i++) {
        for (let j = 0; j < 16; j++) {
          ctx.beginPath()
          ctx.arc(i * 32 + 16, j * 32 + 16, 4, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    } else {
      ctx.fillStyle = color || '#F5F0EB'
      ctx.fillRect(0, 0, 512, 512)
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(3, 3)
    return tex
  }, [type, color])
}

function Room() {
  const { room, materials } = useRoomStore()
  const W = room.width, D = room.height, H = 2.8

  const wallTex = useTexture(materials.wallTexture, materials.wallColor)
  const floorTex = useTexture(materials.floorTexture, '#C8A882')
  const plainWall = useTexture('plain', materials.wallColor)

  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 })
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 })
  const ceilMat = new THREE.MeshStandardMaterial({ color: materials.ceilingColor, roughness: 0.95 })

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <primitive object={floorMat} attach="material" />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H, 0]}>
        <planeGeometry args={[W, D]} />
        <primitive object={ceilMat} attach="material" />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, H / 2, -D / 2]} receiveShadow castShadow>
        <boxGeometry args={[W, H, 0.15]} />
        <primitive object={wallMat} attach="material" />
      </mesh>

      {/* Front wall (transparent/open) - left side only for visibility */}
      <mesh position={[-W/2 + 0.075, H / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.15, H, D]} />
        <primitive object={wallMat} attach="material" />
      </mesh>

      <mesh position={[W/2 - 0.075, H / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.15, H, D]} />
        <primitive object={wallMat} attach="material" />
      </mesh>

      {/* Baseboard */}
      <mesh position={[0, 0.05, -D / 2 + 0.1]}>
        <boxGeometry args={[W - 0.15, 0.1, 0.04]} />
        <meshStandardMaterial color="#E8E2DA" roughness={0.7} />
      </mesh>

      {/* Window on back wall */}
      <mesh position={[W * 0.2, H * 0.6, -D / 2 + 0.1]}>
        <boxGeometry args={[1.2, 1.4, 0.05]} />
        <meshStandardMaterial color="#C8E6F5" transparent opacity={0.4} roughness={0.1} metalness={0.1} />
      </mesh>
      <mesh position={[W * 0.2, H * 0.6, -D / 2 + 0.08]}>
        <boxGeometry args={[1.25, 1.45, 0.04]} />
        <meshStandardMaterial color="#DEB887" roughness={0.8} />
      </mesh>
    </group>
  )
}

function FurnitureItem({ item }: { item: Furniture }) {
  const { setSelectedFurniture, selectedFurnitureId } = useRoomStore()
  const isSelected = selectedFurnitureId === item.id
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (meshRef.current && isSelected) {
      meshRef.current.rotation.y += 0.005
    }
  })

  const getFurnitureMesh = () => {
    const mat = <meshStandardMaterial color={item.color} roughness={0.7} />
    switch (item.type) {
      case 'sofa':
        return (
          <group position={[item.x, item.y, item.z]} rotation={[0, item.rotation, 0]}>
            {/* Base */}
            <mesh position={[0, 0.2, 0]} castShadow>
              <boxGeometry args={[item.width, 0.4, item.depth]} />
              <meshStandardMaterial color={item.color} roughness={0.8} />
            </mesh>
            {/* Back */}
            <mesh position={[0, 0.55, -item.depth/2 + 0.15]} castShadow>
              <boxGeometry args={[item.width, 0.7, 0.2]} />
              <meshStandardMaterial color={item.color} roughness={0.8} />
            </mesh>
            {/* Armrests */}
            {[-1, 1].map(side => (
              <mesh key={side} position={[side * (item.width/2 - 0.1), 0.4, 0]} castShadow>
                <boxGeometry args={[0.2, 0.4, item.depth]} />
                <meshStandardMaterial color={item.color} roughness={0.8} />
              </mesh>
            ))}
            {isSelected && <mesh position={[0, 1.2, 0]}><sphereGeometry args={[0.08]} /><meshStandardMaterial color="#2D6A4F" /></mesh>}
          </group>
        )
      case 'table':
        return (
          <group position={[item.x, item.y, item.z]} rotation={[0, item.rotation, 0]}>
            <mesh position={[0, item.height - 0.04, 0]} castShadow>
              <boxGeometry args={[item.width, 0.06, item.depth]} />
              <meshStandardMaterial color={item.color} roughness={0.4} metalness={0.1} />
            </mesh>
            {[[-1,-1],[1,-1],[-1,1],[1,1]].map(([x,z],i) => (
              <mesh key={i} position={[x*(item.width/2-0.06), item.height/2, z*(item.depth/2-0.06)]} castShadow>
                <boxGeometry args={[0.06, item.height, 0.06]} />
                <meshStandardMaterial color="#5C3D2E" roughness={0.6} />
              </mesh>
            ))}
          </group>
        )
      case 'chair':
        return (
          <group position={[item.x, item.y, item.z]} rotation={[0, item.rotation, 0]}>
            <mesh position={[0, 0.45, 0]} castShadow>
              <boxGeometry args={[0.5, 0.06, 0.5]} />
              <meshStandardMaterial color={item.color} roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.75, -0.22]} castShadow>
              <boxGeometry args={[0.5, 0.6, 0.06]} />
              <meshStandardMaterial color={item.color} roughness={0.8} />
            </mesh>
            {[[-0.2,-0.2],[0.2,-0.2],[-0.2,0.2],[0.2,0.2]].map(([x,z],i) => (
              <mesh key={i} position={[x, 0.22, z]} castShadow>
                <boxGeometry args={[0.04, 0.45, 0.04]} />
                <meshStandardMaterial color="#5C3D2E" roughness={0.7} />
              </mesh>
            ))}
          </group>
        )
      case 'bed':
        return (
          <group position={[item.x, item.y, item.z]} rotation={[0, item.rotation, 0]}>
            <mesh position={[0, 0.25, 0]} castShadow>
              <boxGeometry args={[item.width, 0.3, item.depth]} />
              <meshStandardMaterial color="#8B7355" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.5, 0]} castShadow>
              <boxGeometry args={[item.width - 0.1, 0.2, item.depth - 0.1]} />
              <meshStandardMaterial color={item.color} roughness={0.95} />
            </mesh>
            <mesh position={[0, 0.65, -item.depth/2 + 0.15]} castShadow>
              <boxGeometry args={[item.width, 0.8, 0.1]} />
              <meshStandardMaterial color="#8B7355" roughness={0.7} />
            </mesh>
          </group>
        )
      case 'plant':
        return (
          <group position={[item.x, item.y, item.z]}>
            <mesh position={[0, 0.2, 0]}>
              <cylinderGeometry args={[0.15, 0.12, 0.4, 8]} />
              <meshStandardMaterial color="#7C5C42" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.65, 0]}>
              <sphereGeometry args={[0.3, 8, 8]} />
              <meshStandardMaterial color="#2D6A4F" roughness={0.95} />
            </mesh>
            <mesh position={[0.2, 0.55, 0]}>
              <sphereGeometry args={[0.2, 8, 8]} />
              <meshStandardMaterial color="#52B788" roughness={0.95} />
            </mesh>
          </group>
        )
      default:
        return (
          <mesh ref={meshRef} position={[item.x, item.y + item.height/2, item.z]}
            onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setSelectedFurniture(item.id) }}
            castShadow>
            <boxGeometry args={[item.width, item.height, item.depth]} />
            <meshStandardMaterial color={item.color} roughness={0.7} />
          </mesh>
        )
    }
  }

  return (
    <group onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); setSelectedFurniture(item.id) }}>
      {getFurnitureMesh()}
      {isSelected && (
        <mesh position={[item.x, 0.01, item.z]}>
          <ringGeometry args={[Math.max(item.width, item.depth) * 0.6, Math.max(item.width, item.depth) * 0.65, 32]} />
          <meshStandardMaterial color="#2D6A4F" transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  )
}

export default function Scene3D() {
  const { furniture, room, setSelectedFurniture } = useRoomStore()

  return (
    <div className="w-full h-full canvas-container">
      <Canvas
        camera={{ position: [room.width * 0.7, room.height * 1.5, room.height * 1.2], fov: 50 }}
        shadows
        onClick={() => setSelectedFurniture(null)}
      >
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[room.width / 2, 4, room.height / 2]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <pointLight position={[0, 2.5, 0]} intensity={0.3} color="#FFF5E0" />

        <Room />
        {furniture.map(item => <FurnitureItem key={item.id} item={item} />)}

        <OrbitControls
          target={[0, 1, 0]}
          maxPolarAngle={Math.PI / 2}
          minDistance={2}
          maxDistance={15}
        />
        <Environment preset="apartment" />
      </Canvas>
    </div>
  )
}
