'use client'
import { useRef, useMemo } from 'react'
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Environment, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useRoomStore, Furniture } from '@/lib/store/room-store'

const WALL_H = 2.8;
const WALL_THICKNESS = 0.15;

// ─── Textures ────────────────────────────────────────────────────────────────

function useProceduralTexture(type: string, color: string) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    if (type === "parquet") {
      ctx.fillStyle = "#C8A882";
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = "#A0825A";
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 4; j++) {
          const x = i * 64,
            y = j * 128;
          ctx.strokeRect(x + 2, y + 2, 60, 124);
          ctx.strokeStyle = "#B8926A";
          ctx.lineWidth = 0.5;
          for (let g = 0; g < 5; g++) {
            ctx.beginPath();
            ctx.moveTo(x + 8 + g * 10, y + 4);
            ctx.lineTo(x + 8 + g * 10, y + 122);
            ctx.stroke();
          }
          ctx.strokeStyle = "#A0825A";
          ctx.lineWidth = 2;
        }
      }
    } else if (type === "tile") {
      ctx.fillStyle = "#E8E4DF";
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = "#C4BDB6";
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++)
        for (let j = 0; j < 8; j++)
          ctx.strokeRect(i * 64 + 2, j * 64 + 2, 60, 60);
    } else if (type === "wallpaper-stripe") {
      ctx.fillStyle = color || "#F5F0EB";
      ctx.fillRect(0, 0, 512, 512);
      ctx.fillStyle = "#00000015";
      for (let i = 0; i < 16; i += 2) ctx.fillRect(i * 32, 0, 32, 512);
    } else if (type === "wallpaper-dots") {
      ctx.fillStyle = color || "#F5F0EB";
      ctx.fillRect(0, 0, 512, 512);
      ctx.fillStyle = "#00000020";
      for (let i = 0; i < 16; i++)
        for (let j = 0; j < 16; j++) {
          ctx.beginPath();
          ctx.arc(i * 32 + 16, j * 32 + 16, 4, 0, Math.PI * 2);
          ctx.fill();
        }
    } else {
      ctx.fillStyle = color || "#F5F0EB";
      ctx.fillRect(0, 0, 512, 512);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  }, [type, color]);
}

// ─── Single Room in 3D ───────────────────────────────────────────────────────

/**
 * 2D coordinate system:  x → right,  y → down
 * 3D coordinate system:  x → right,  y → up,  z → "forward" (screen toward viewer)
 *
 * Mapping:  3D_x = 2D_x   |   3D_z = 2D_y
 * Origin of each room is its top-left corner in 2D.
 * In 3D we centre the room so the pivot is at room centre (easier math).
 */
function RoomMesh({
  room,
  doors,
  windows,
}: {
  room: RoomShape;
  doors: Door[];
  windows: WindowEl[];
}) {
  const { materials } = useRoomStore();
  const wallTex = useProceduralTexture(
    materials.wallTexture,
    materials.wallColor,
  );
  const floorTex = useProceduralTexture(materials.floorTexture, "#C8A882");

  const W = room.width; // 3D x extent
  const D = room.height; // 3D z extent  (2D "height" = depth in 3D)
  const H = WALL_H;
  const T = WALL_THICKNESS;

  // Centre of room in 3D world space
  // 2D origin = top-left = (room.x, room.y)
  // 3D centre  = (room.x + W/2, 0, room.y + D/2)
  const cx = room.x + W / 2;
  const cz = room.y + D / 2;

  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex.clone(),
    roughness: 0.9,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex.clone(),
    roughness: 0.8,
  });
  const ceilMat = new THREE.MeshStandardMaterial({
    color: materials.ceilingColor,
    roughness: 0.95,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: "#C8E6F5",
    transparent: true,
    opacity: 0.35,
    roughness: 0.05,
    metalness: 0.1,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: "#DEB887",
    roughness: 0.8,
  });

  // Which walls have doors/windows (to cut openings)
  // We render each wall as a set of segments around openings.
  // For simplicity we render door openings as a gap + arc overhead, windows as glass panel.

  // Helper: build wall segments along X axis (for top/bottom walls) or Z axis (for left/right)
  // Returns mesh array

  const wallColor = materials.wallColor;

  // Doors on each side
  const doorsOnSide = (side: Door["wallSide"]) =>
    doors.filter((d) => d.roomId === room.id && d.wallSide === side);
  const windowsOnSide = (side: Door["wallSide"]) =>
    windows.filter(
      (w: { roomId: string; wallSide: string }) =>
        w.roomId === room.id && w.wallSide === side,
    );

  /**
   * Build a wall along a 1D span [0 … length].
   * Openings: array of { start, width, type: 'door'|'window' }
   * Returns a list of { x_offset, seg_width, height, y_offset } for solid segments
   * plus opening descriptors.
   */
  function buildWallSegments(
    length: number,
    openings: Array<{ start: number; width: number; type: "door" | "window" }>,
  ) {
    // Sort openings
    const sorted = [...openings].sort((a, b) => a.start - b.start);
    const solid: Array<{
      start: number;
      width: number;
      height: number;
      yBase: number;
    }> = [];
    const openingMeshes: Array<{
      start: number;
      width: number;
      type: "door" | "window";
    }> = [];

    let cursor = 0;
    for (const op of sorted) {
      const gapStart = Math.max(cursor, op.start);
      if (gapStart > cursor) {
        solid.push({
          start: cursor,
          width: gapStart - cursor,
          height: H,
          yBase: 0,
        });
      }
      if (op.type === "door") {
        // below opening: nothing; above opening: lintel
        const doorH = 2.1;
        if (H - doorH > 0.05) {
          solid.push({
            start: op.start,
            width: op.width,
            height: H - doorH,
            yBase: doorH,
          });
        }
      } else {
        // window: solid below sill, glass in middle, solid above
        const sillH = 0.9,
          winH = 1.2;
        solid.push({
          start: op.start,
          width: op.width,
          height: sillH,
          yBase: 0,
        });
        const topH = H - sillH - winH;
        if (topH > 0.05)
          solid.push({
            start: op.start,
            width: op.width,
            height: topH,
            yBase: sillH + winH,
          });
      }
      openingMeshes.push(op);
      cursor = op.start + op.width;
    }
    if (cursor < length)
      solid.push({
        start: cursor,
        width: length - cursor,
        height: H,
        yBase: 0,
      });

    return { solid, openings: openingMeshes };
  }

  // ── Wall builder renders meshes for one wall ──────────────────────────────
  // axis: 'x' → wall runs along X (top/bottom walls); 'z' → wall runs along Z (left/right walls)
  // wallZ / wallX: fixed coordinate of the wall plane
  // flip: mirror offset direction

  function WallMeshes({
    axis,
    wallPos,
    length,
    openings: ops,
    rotY,
  }: {
    axis: "x" | "z";
    wallPos: [number, number, number]; // centre of the full wall (no openings)
    length: number;
    openings: Array<{ start: number; width: number; type: "door" | "window" }>;
    rotY: number;
  }) {
    const { solid, openings: opList } = buildWallSegments(length, ops);

    return (
      <group>
        {/* Solid segments */}
        {solid.map((seg, i) => {
          // seg.start measured from wall-left-end; centre of segment in wall-local coords:
          const localCentre = seg.start + seg.width / 2 - length / 2;
          const pos: [number, number, number] =
            axis === "x"
              ? [
                  wallPos[0] + localCentre,
                  seg.yBase + seg.height / 2,
                  wallPos[2],
                ]
              : [
                  wallPos[0],
                  seg.yBase + seg.height / 2,
                  wallPos[2] + localCentre,
                ];

          return (
            <mesh key={i} position={pos} castShadow receiveShadow>
              <boxGeometry
                args={
                  axis === "x"
                    ? [seg.width, seg.height, T]
                    : [T, seg.height, seg.width]
                }
              />
              <primitive object={wallMat} attach="material" />
            </mesh>
          );
        })}

        {/* Window glass panels */}
        {opList
          .filter((op) => op.type === "window")
          .map((op, i) => {
            const localCentre = op.start + op.width / 2 - length / 2;
            const sillH = 0.9,
              winH = 1.2;
            const pos: [number, number, number] =
              axis === "x"
                ? [wallPos[0] + localCentre, sillH + winH / 2, wallPos[2]]
                : [wallPos[0], sillH + winH / 2, wallPos[2] + localCentre];

            return (
              <group key={`win-${i}`}>
                <mesh position={pos} castShadow>
                  <boxGeometry
                    args={
                      axis === "x"
                        ? [op.width, winH, T * 0.3]
                        : [T * 0.3, winH, op.width]
                    }
                  />
                  <primitive object={glassMat} attach="material" />
                </mesh>
                {/* Frame */}
                <mesh position={pos}>
                  <boxGeometry
                    args={
                      axis === "x"
                        ? [op.width + 0.04, winH + 0.04, T * 0.4]
                        : [T * 0.4, winH + 0.04, op.width + 0.04]
                    }
                  />
                  <primitive object={frameMat} attach="material" />
                </mesh>
              </group>
            );
          })}
      </group>
    );
  }

  // ── Gather openings per wall ─────────────────────────────────────────────
  const topOpenings = [
    ...doorsOnSide("top").map((d) => ({
      start: d.offset,
      width: d.width,
      type: "door" as const,
    })),
    ...windowsOnSide("top").map((w) => ({
      start: w.offset,
      width: w.width,
      type: "window" as const,
    })),
  ];
  const bottomOpenings = [
    ...doorsOnSide("bottom").map((d) => ({
      start: d.offset,
      width: d.width,
      type: "door" as const,
    })),
    ...windowsOnSide("bottom").map((w) => ({
      start: w.offset,
      width: w.width,
      type: "window" as const,
    })),
  ];
  const leftOpenings = [
    ...doorsOnSide("left").map((d) => ({
      start: d.offset,
      width: d.width,
      type: "door" as const,
    })),
    ...windowsOnSide("left").map((w) => ({
      start: w.offset,
      width: w.width,
      type: "window" as const,
    })),
  ];
  const rightOpenings = [
    ...doorsOnSide("right").map((d) => ({
      start: d.offset,
      width: d.width,
      type: "door" as const,
    })),
    ...windowsOnSide("right").map((w) => ({
      start: w.offset,
      width: w.width,
      type: "window" as const,
    })),
  ];

  return (
    <group>
      {/* Floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[cx, 0.001, cz]}
        receiveShadow
      >
        <planeGeometry args={[W, D]} />
        <primitive object={floorMat} attach="material" />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[cx, H, cz]}>
        <planeGeometry args={[W, D]} />
        <primitive object={ceilMat} attach="material" />
      </mesh>

      {/* Top wall  (2D top = z = room.y) */}
      <WallMeshes
        axis="x"
        wallPos={[cx, 0, room.y]}
        length={W}
        openings={topOpenings}
        rotY={0}
      />

      {/* Bottom wall (z = room.y + D) */}
      <WallMeshes
        axis="x"
        wallPos={[cx, 0, room.y + D]}
        length={W}
        openings={bottomOpenings}
        rotY={0}
      />

      {/* Left wall (x = room.x) */}
      <WallMeshes
        axis="z"
        wallPos={[room.x, 0, cz]}
        length={D}
        openings={leftOpenings}
        rotY={0}
      />

      {/* Right wall (x = room.x + W) */}
      <WallMeshes
        axis="z"
        wallPos={[room.x + W, 0, cz]}
        length={D}
        openings={rightOpenings}
        rotY={0}
      />

      {/* Room label floating above floor */}
      <group position={[cx, 0.05, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        {/* We use a simple text approximation via a thin box — Text from drei needs font loading */}
      </group>
    </group>
  );
}

// ─── Partitions ──────────────────────────────────────────────────────────────

function PartitionMesh({
  p,
}: {
  p: { id: string; x1: number; y1: number; x2: number; y2: number };
}) {
  const { materials } = useRoomStore();
  const wallTex = useProceduralTexture(
    materials.wallTexture,
    materials.wallColor,
  );

  const dx = p.x2 - p.x1,
    dz = p.y2 - p.y1;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx); // rotation around Y axis

  const cx = (p.x1 + p.x2) / 2;
  const cz = (p.y1 + p.y2) / 2;

  return (
    <mesh
      position={[cx, WALL_H / 2, cz]}
      rotation={[0, -angle, 0]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[length, WALL_H, WALL_THICKNESS]} />
      <meshStandardMaterial map={wallTex} roughness={0.9} />
    </mesh>
  );
}

// ─── Furniture (unchanged) ───────────────────────────────────────────────────

function FurnitureItem({ item }: { item: Furniture }) {
  const { setSelectedFurniture, selectedFurnitureId } = useRoomStore();
  const isSelected = selectedFurnitureId === item.id;
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current && isSelected) meshRef.current.rotation.y += 0.005;
  });

  const getFurnitureMesh = () => {
    switch (item.type) {
      case "sofa":
        return (
          <group
            position={[item.x, item.y, item.z]}
            rotation={[0, item.rotation, 0]}
          >
            <mesh position={[0, 0.2, 0]} castShadow>
              <boxGeometry args={[item.width, 0.4, item.depth]} />
              <meshStandardMaterial color={item.color} roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.55, -item.depth / 2 + 0.15]} castShadow>
              <boxGeometry args={[item.width, 0.7, 0.2]} />
              <meshStandardMaterial color={item.color} roughness={0.8} />
            </mesh>
            {[-1, 1].map((side) => (
              <mesh
                key={side}
                position={[side * (item.width / 2 - 0.1), 0.4, 0]}
                castShadow
              >
                <boxGeometry args={[0.2, 0.4, item.depth]} />
                <meshStandardMaterial color={item.color} roughness={0.8} />
              </mesh>
            ))}
          </group>
        );
      case "table":
        return (
          <group
            position={[item.x, item.y, item.z]}
            rotation={[0, item.rotation, 0]}
          >
            <mesh position={[0, item.height - 0.04, 0]} castShadow>
              <boxGeometry args={[item.width, 0.06, item.depth]} />
              <meshStandardMaterial
                color={item.color}
                roughness={0.4}
                metalness={0.1}
              />
            </mesh>
            {[
              [-1, -1],
              [1, -1],
              [-1, 1],
              [1, 1],
            ].map(([x, z], i) => (
              <mesh
                key={i}
                position={[
                  x * (item.width / 2 - 0.06),
                  item.height / 2,
                  z * (item.depth / 2 - 0.06),
                ]}
                castShadow
              >
                <boxGeometry args={[0.06, item.height, 0.06]} />
                <meshStandardMaterial color="#5C3D2E" roughness={0.6} />
              </mesh>
            ))}
          </group>
        );
      case "chair":
        return (
          <group
            position={[item.x, item.y, item.z]}
            rotation={[0, item.rotation, 0]}
          >
            <mesh position={[0, 0.45, 0]} castShadow>
              <boxGeometry args={[0.5, 0.06, 0.5]} />
              <meshStandardMaterial color={item.color} roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.75, -0.22]} castShadow>
              <boxGeometry args={[0.5, 0.6, 0.06]} />
              <meshStandardMaterial color={item.color} roughness={0.8} />
            </mesh>
            {[
              [-0.2, -0.2],
              [0.2, -0.2],
              [-0.2, 0.2],
              [0.2, 0.2],
            ].map(([x, z], i) => (
              <mesh key={i} position={[x, 0.22, z]} castShadow>
                <boxGeometry args={[0.04, 0.45, 0.04]} />
                <meshStandardMaterial color="#5C3D2E" roughness={0.7} />
              </mesh>
            ))}
          </group>
        );
      case "bed":
        return (
          <group
            position={[item.x, item.y, item.z]}
            rotation={[0, item.rotation, 0]}
          >
            <mesh position={[0, 0.25, 0]} castShadow>
              <boxGeometry args={[item.width, 0.3, item.depth]} />
              <meshStandardMaterial color="#8B7355" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.5, 0]} castShadow>
              <boxGeometry args={[item.width - 0.1, 0.2, item.depth - 0.1]} />
              <meshStandardMaterial color={item.color} roughness={0.95} />
            </mesh>
            <mesh position={[0, 0.65, -item.depth / 2 + 0.15]} castShadow>
              <boxGeometry args={[item.width, 0.8, 0.1]} />
              <meshStandardMaterial color="#8B7355" roughness={0.7} />
            </mesh>
          </group>
        );
      case "plant":
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
        );
      default:
        return (
          <mesh
            ref={meshRef}
            position={[item.x, item.y + item.height / 2, item.z]}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              setSelectedFurniture(item.id);
            }}
            castShadow
          >
            <boxGeometry args={[item.width, item.height, item.depth]} />
            <meshStandardMaterial color={item.color} roughness={0.7} />
          </mesh>
        );
    }
  };

  return (
    <group
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        setSelectedFurniture(item.id);
      }}
    >
      {getFurnitureMesh()}
      {isSelected && (
        <mesh position={[item.x, 0.01, item.z]}>
          <ringGeometry
            args={[
              Math.max(item.width, item.depth) * 0.6,
              Math.max(item.width, item.depth) * 0.65,
              32,
            ]}
          />
          <meshStandardMaterial color="#2D6A4F" transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}

// ─── Ground plane ─────────────────────────────────────────────────────────────

function GroundPlane() {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.002, 0]}
      receiveShadow
    >
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color="#E8E4DF" roughness={1} />
    </mesh>
  );
}

// ─── Scene ───────────────────────────────────────────────────────────────────

export default function Scene3D() {
  const { rooms, doors, windows, partitions, furniture, setSelectedFurniture } =
    useRoomStore();

  // Compute a sensible camera target: centre of all rooms bounding box
  const bbox = useMemo(() => {
    if (rooms.length === 0) return { cx: 3, cz: 3, maxW: 6, maxD: 6 };
    let minX = Infinity,
      minZ = Infinity,
      maxX = -Infinity,
      maxZ = -Infinity;
    for (const r of rooms) {
      minX = Math.min(minX, r.x);
      minZ = Math.min(minZ, r.y);
      maxX = Math.max(maxX, r.x + r.width);
      maxZ = Math.max(maxZ, r.y + r.height);
    }
    return {
      cx: (minX + maxX) / 2,
      cz: (minZ + maxZ) / 2,
      maxW: maxX - minX,
      maxD: maxZ - minZ,
    };
  }, [rooms]);

  const camDist = Math.max(bbox.maxW, bbox.maxD) * 1.4 + 4;

  return (
    <div className="w-full h-full canvas-container">
      <Canvas
        camera={{
          position: [
            bbox.cx + camDist * 0.6,
            camDist * 0.8,
            bbox.cz + camDist * 0.9,
          ],
          fov: 50,
        }}
        shadows
        onClick={() => setSelectedFurniture(null)}
      >
        <ambientLight intensity={0.45} />
        <directionalLight
          position={[bbox.cx + 5, 8, bbox.cz + 5]}
          intensity={1.3}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <pointLight
          position={[bbox.cx, 2.5, bbox.cz]}
          intensity={0.25}
          color="#FFF5E0"
        />

        <GroundPlane />

        {rooms.map((room) => (
          <RoomMesh
            key={room.id}
            room={room}
            doors={doors as Door[]}
            windows={windows as any}
          />
        ))}

        {partitions.map((p) => (
          <PartitionMesh key={p.id} p={p} />
        ))}

        {furniture.map((item) => (
          <FurnitureItem key={item.id} item={item} />
        ))}

        <OrbitControls
          target={[bbox.cx, 1, bbox.cz]}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={2}
          maxDistance={40}
        />
        <Environment preset="apartment" />
      </Canvas>
    </div>
  );
}
