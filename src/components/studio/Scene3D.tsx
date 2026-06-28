"use client";
import { useRef, useMemo, useState, useEffect, Suspense } from "react";
import { Canvas, ThreeEvent, useThree, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  useGLTF,
  TransformControls,
  PointerLockControls,
} from "@react-three/drei";
import * as THREE from "three";
import {
  useRoomStore,
  Furniture,
  RoomShape,
  Door,
} from "../../lib/store/room-store";

const WALL_H = 2.8;
const T = 0.14;
const DOOR_H = 2.1;
const WIN_SILL = 0.9;
const WIN_H = 1.2;

// nova/domino სურათებს CORS არ აქვთ — WebGL ტექსტურისთვის API proxy-ით ვტვირთავთ
const API_BASE = "https://interior-materials-api.onrender.com";
const proxiedImg = (url: string) =>
  url.startsWith("http") ? `${API_BASE}/img?url=${encodeURIComponent(url)}` : url;

function makeWallKey(x1: number, z1: number, x2: number, z2: number) {
  return `${Math.round(x1 * 1000)},${Math.round(z1 * 1000)},${Math.round(x2 * 1000)},${Math.round(z2 * 1000)}`;
}

// ─── Procedural textures ──────────────────────────────────────────────────────

function makeTexture(type: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  if (type === "parquet") {
    ctx.fillStyle = "#C8A882";
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "#A0825A";
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++)
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
  tex.repeat.set(4, 4);
  return tex;
}

function useProceduralTexture(type: string, color: string) {
  return useMemo(() => makeTexture(type, color), [type, color]);
}

// ─── Image URL → THREE.Texture ────────────────────────────────────────────────

const DEFAULT_REPEAT = 2;

type Crop = { x: number; y: number; w: number; h: number };

// სურათს ხელით-მონიშნულ ნაწილზე ჭრის (crop) და ტექსტურად ამზადებს.
function useImageTexture(
  url: string | null,
  repeat: number = DEFAULT_REPEAT,
  crop?: Crop,
): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!url) {
      setTex(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const cr = crop ?? { x: 0, y: 0, w: 1, h: 1 };
      const sx = Math.max(0, Math.round(cr.x * w));
      const sy = Math.max(0, Math.round(cr.y * h));
      const sw = Math.max(1, Math.min(w - sx, Math.round(cr.w * w)));
      const sh = Math.max(1, Math.min(h - sy, Math.round(cr.h * h)));
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      canvas.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, repeat);
      t.needsUpdate = true;
      setTex(t);
    };
    img.onerror = () => {};
    img.src = proxiedImg(url);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, crop?.x, crop?.y, crop?.w, crop?.h]);

  // repeat-ის ცვლილება reload-ის გარეშე
  useEffect(() => {
    if (tex) {
      tex.repeat.set(repeat, repeat);
      tex.needsUpdate = true;
    }
  }, [tex, repeat]);

  return tex;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type WallSide = "top" | "bottom" | "left" | "right";

interface Opening {
  type: "door" | "window";
  start: number;
  width: number;
}

interface WallEdge {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  length: number;
  axis: "x" | "z";
  openings: Opening[];
}

// ─── Shared wall deduplication ────────────────────────────────────────────────

function buildAllWalls(
  rooms: RoomShape[],
  doors: Door[],
  windows: Array<{
    id: string;
    roomId: string;
    wallSide: WallSide;
    offset: number;
    width: number;
  }>,
): WallEdge[] {
  const edgeMap = new Map<string, WallEdge>();

  for (const room of rooms) {
    const { x, y: rz, width: W, height: D } = room;
    const edges: Array<{
      side: WallSide;
      x1: number;
      z1: number;
      x2: number;
      z2: number;
      axis: "x" | "z";
    }> = [
      { side: "top", x1: x, z1: rz, x2: x + W, z2: rz, axis: "x" },
      { side: "bottom", x1: x, z1: rz + D, x2: x + W, z2: rz + D, axis: "x" },
      { side: "left", x1: x, z1: rz, x2: x, z2: rz + D, axis: "z" },
      { side: "right", x1: x + W, z1: rz, x2: x + W, z2: rz + D, axis: "z" },
    ];

    for (const e of edges) {
      const key = makeWallKey(e.x1, e.z1, e.x2, e.z2);
      const doorsHere = doors
        .filter((d) => d.roomId === room.id && d.wallSide === e.side)
        .map((d) => ({
          type: "door" as const,
          start: d.offset,
          width: d.width,
        }));
      const winsHere = windows
        .filter((w) => w.roomId === room.id && w.wallSide === e.side)
        .map((w) => ({
          type: "window" as const,
          start: w.offset,
          width: w.width,
        }));

      if (!edgeMap.has(key)) {
        edgeMap.set(key, {
          x1: e.x1,
          z1: e.z1,
          x2: e.x2,
          z2: e.z2,
          length:
            e.axis === "x" ? Math.abs(e.x2 - e.x1) : Math.abs(e.z2 - e.z1),
          axis: e.axis,
          openings: [...doorsHere, ...winsHere],
        });
      } else {
        edgeMap.get(key)!.openings.push(...doorsHere, ...winsHere);
      }
    }
  }

  // ─── Corner join ──────────────────────────────────────────────────────────
  // ყველა კედელი სრულ სიგრძეზეა → კუთხეებში ბოქსები ერთმანეთს ედება და
  // ტექსტურა იკვეთება. გადაწყვეტა: X-კედლები T/2-ით გავაგრძელოთ ბოლოებში,
  // Z-კედლები T/2-ით შევამციროთ — ისე რომ კუთხეში ზუსტად შეერთდნენ
  // (X კედელი ფარავს კუთხეს, Z კედელი მის შიდა წახნაგს ებჯინება). გადაფარვა 0.
  const all = Array.from(edgeMap.values());
  const H = T / 2;
  for (const e of all) {
    if (e.axis === "x") {
      e.x1 -= H;
      e.x2 += H;
      e.length += T;
      e.openings = e.openings.map((op) => ({ ...op, start: op.start + H }));
    } else {
      e.z1 += H;
      e.z2 -= H;
      e.length = Math.max(0, e.length - T);
      e.openings = e.openings.map((op) => ({
        ...op,
        start: Math.max(0, op.start - H),
      }));
    }
  }
  return all;
}

// ─── Wall segment splitter ────────────────────────────────────────────────────

function splitWall(length: number, openings: Opening[]) {
  const sorted = [...openings].sort((a, b) => a.start - b.start);
  const solid: Array<{ start: number; len: number; yBase: number; h: number }> =
    [];

  let cursor = 0;
  for (const op of sorted) {
    const opStart = Math.max(cursor, op.start);
    if (opStart > cursor)
      solid.push({ start: cursor, len: opStart - cursor, yBase: 0, h: WALL_H });

    if (op.type === "door") {
      const lintelH = WALL_H - DOOR_H;
      if (lintelH > 0.02)
        solid.push({
          start: opStart,
          len: op.width,
          yBase: DOOR_H,
          h: lintelH,
        });
    } else {
      solid.push({ start: opStart, len: op.width, yBase: 0, h: WIN_SILL });
      const headerH = WALL_H - WIN_SILL - WIN_H;
      if (headerH > 0.02)
        solid.push({
          start: opStart,
          len: op.width,
          yBase: WIN_SILL + WIN_H,
          h: headerH,
        });
    }
    cursor = opStart + op.width;
  }
  if (cursor < length)
    solid.push({ start: cursor, len: length - cursor, yBase: 0, h: WALL_H });

  return { solid, openings: sorted };
}

// ─── Wall drop zone ───────────────────────────────────────────────────────────

function WallDropZone() {
  const selectedWallKey = useRoomStore((s) => s.selectedWallKey);
  const [draggingOver, setDraggingOver] = useState(false);

  useEffect(() => {
    function onDragOver(e: DragEvent) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      setDraggingOver(true);
    }
    function onDragLeave(e: DragEvent) {
      if (e.relatedTarget === null) setDraggingOver(false);
    }
    function onDrop(e: DragEvent) {
      e.preventDefault();
      setDraggingOver(false);
      // getState() — ყოველთვის უახლესი მნიშვნელობა, closure არ ჭირდება
      const { selectedWallKey: key, setWallColor } = useRoomStore.getState();
      if (!key) return;
      const id = e.dataTransfer?.getData("wallColorId");
      const hex = e.dataTransfer?.getData("wallColorHex");
      const name = e.dataTransfer?.getData("wallColorName") ?? "";
      if (id && hex) {
        setWallColor(key, { id, color: hex, name });
      }
    }

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  if (!selectedWallKey) return null;

  return draggingOver ? (
    <div className="absolute inset-0 z-10 pointer-events-none rounded-2xl bg-green-500/10 border-4 border-dashed border-green-500" />
  ) : null;
}

// ─── Single wall renderer ─────────────────────────────────────────────────────

interface WallMeshProps {
  edge: WallEdge;
  wKey: string;
  wallTex: THREE.Texture;
  glassMat: THREE.Material;
  frameMat: THREE.Material;
  doorMat: THREE.Material;
  isSelected: boolean;
  assignedColor: string | null;
  assignedImageUrl: string | null;
  assignedRepeat: number;
  assignedCrop?: Crop;
  onSelect: (key: string) => void;
}

function WallMesh({
  edge,
  wKey,
  wallTex,
  glassMat,
  frameMat,
  doorMat,
  isSelected,
  assignedColor,
  assignedImageUrl,
  assignedRepeat,
  assignedCrop,
  onSelect,
}: WallMeshProps) {
  const { solid, openings } = splitWall(edge.length, edge.openings);
  const assignedTex = useImageTexture(assignedImageUrl, assignedRepeat, assignedCrop);

  // თითო segment-ს საკუთარი material — გაზიარებული instance + `<primitive>`
  // იწვევდა იმას, რომ ფერი მხოლოდ ერთ კედელზე ჩანდა. დეკლარაციული JSX
  // material თითო mesh-ს დამოუკიდებლად ანახლებს assignedColor/assignedTex-ზე.
  const renderWallMaterial = () => {
    if (assignedTex) {
      return <meshStandardMaterial map={assignedTex} roughness={0.85} />;
    }
    if (assignedColor) {
      return <meshStandardMaterial color={assignedColor} roughness={0.88} />;
    }
    return (
      <meshStandardMaterial map={wallTex} color="#F0EDE8" roughness={0.88} />
    );
  };

  const segPos = (
    start: number,
    len: number,
    yBase: number,
    h: number,
  ): [number, number, number] => {
    const localC = start + len / 2;
    if (edge.axis === "x") return [edge.x1 + localC, yBase + h / 2, edge.z1];
    else return [edge.x1, yBase + h / 2, edge.z1 + localC];
  };

  const segGeo = (len: number, h: number) =>
    edge.axis === "x" ? (
      <boxGeometry args={[len, h, T]} />
    ) : (
      <boxGeometry args={[T, h, len]} />
    );

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(wKey);
  };

  return (
    <group>
      <mesh position={segPos(0, edge.length, 0, WALL_H)} onClick={handleClick}>
        {edge.axis === "x" ? (
          <boxGeometry args={[edge.length, WALL_H, 0.5]} />
        ) : (
          <boxGeometry args={[0.5, WALL_H, edge.length]} />
        )}
        <meshBasicMaterial visible={false} />
      </mesh>

      {isSelected && (
        <mesh position={segPos(0, edge.length, 0, WALL_H)}>
          {segGeo(edge.length, WALL_H)}
          <meshBasicMaterial color="#2D6A4F" transparent opacity={0.15} />
        </mesh>
      )}

      {solid.map((s, i) => (
        <mesh
          key={i}
          position={segPos(s.start, s.len, s.yBase, s.h)}
          castShadow
          receiveShadow
        >
          {segGeo(s.len, s.h)}
          {renderWallMaterial()}
        </mesh>
      ))}

      {openings
        .filter((op) => op.type === "door")
        .map((op, i) => {
          const localC = op.start + op.width / 2;
          const cx = edge.axis === "x" ? edge.x1 + localC : edge.x1;
          const cz = edge.axis === "x" ? edge.z1 : edge.z1 + localC;
          const FW = 0.06;
          const FD = T + 0.02;
          return (
            <group key={`door-${i}`}>
              <mesh
                position={
                  edge.axis === "x"
                    ? [edge.x1 + op.start + FW / 2, DOOR_H / 2, cz]
                    : [cx, DOOR_H / 2, edge.z1 + op.start + FW / 2]
                }
                castShadow
              >
                {edge.axis === "x" ? (
                  <boxGeometry args={[FW, DOOR_H, FD]} />
                ) : (
                  <boxGeometry args={[FD, DOOR_H, FW]} />
                )}
                <primitive object={frameMat} attach="material" />
              </mesh>
              <mesh
                position={
                  edge.axis === "x"
                    ? [edge.x1 + op.start + op.width - FW / 2, DOOR_H / 2, cz]
                    : [cx, DOOR_H / 2, edge.z1 + op.start + op.width - FW / 2]
                }
                castShadow
              >
                {edge.axis === "x" ? (
                  <boxGeometry args={[FW, DOOR_H, FD]} />
                ) : (
                  <boxGeometry args={[FD, DOOR_H, FW]} />
                )}
                <primitive object={frameMat} attach="material" />
              </mesh>
              <mesh position={[cx, DOOR_H + FW / 2, cz]} castShadow>
                {edge.axis === "x" ? (
                  <boxGeometry args={[op.width, FW, FD]} />
                ) : (
                  <boxGeometry args={[FD, FW, op.width]} />
                )}
                <primitive object={frameMat} attach="material" />
              </mesh>
              <group
                position={
                  edge.axis === "x"
                    ? [edge.x1 + op.start + FW, 0, cz]
                    : [cx, 0, edge.z1 + op.start + FW]
                }
                rotation={[
                  0,
                  edge.axis === "x" ? -Math.PI / 9 : Math.PI / 2 - Math.PI / 9,
                  0,
                ]}
              >
                <mesh
                  position={
                    edge.axis === "x"
                      ? [(op.width - FW) / 2, DOOR_H / 2, 0.03]
                      : [0.03, DOOR_H / 2, (op.width - FW) / 2]
                  }
                  castShadow
                >
                  {edge.axis === "x" ? (
                    <boxGeometry
                      args={[op.width - FW * 2, DOOR_H - FW, 0.04]}
                    />
                  ) : (
                    <boxGeometry
                      args={[0.04, DOOR_H - FW, op.width - FW * 2]}
                    />
                  )}
                  <primitive object={doorMat} attach="material" />
                </mesh>
                <mesh
                  position={
                    edge.axis === "x"
                      ? [(op.width - FW) * 0.8, DOOR_H * 0.45, 0.06]
                      : [0.06, DOOR_H * 0.45, (op.width - FW) * 0.8]
                  }
                >
                  <sphereGeometry args={[0.025, 8, 8]} />
                  <meshStandardMaterial
                    color="#C0A060"
                    metalness={0.8}
                    roughness={0.2}
                  />
                </mesh>
              </group>
            </group>
          );
        })}

      {openings
        .filter((op) => op.type === "window")
        .map((op, i) => {
          const localC = op.start + op.width / 2;
          const cx = edge.axis === "x" ? edge.x1 + localC : edge.x1;
          const cz = edge.axis === "x" ? edge.z1 : edge.z1 + localC;
          const winY = WIN_SILL + WIN_H / 2;
          const FW = 0.05;
          const FD = T + 0.01;
          return (
            <group key={`win-${i}`}>
              <mesh position={[cx, WIN_SILL + FW / 2, cz]} castShadow>
                {edge.axis === "x" ? (
                  <boxGeometry args={[op.width + FW * 2, FW, FD]} />
                ) : (
                  <boxGeometry args={[FD, FW, op.width + FW * 2]} />
                )}
                <primitive object={frameMat} attach="material" />
              </mesh>
              <mesh position={[cx, WIN_SILL + WIN_H - FW / 2, cz]} castShadow>
                {edge.axis === "x" ? (
                  <boxGeometry args={[op.width + FW * 2, FW, FD]} />
                ) : (
                  <boxGeometry args={[FD, FW, op.width + FW * 2]} />
                )}
                <primitive object={frameMat} attach="material" />
              </mesh>
              <mesh
                position={
                  edge.axis === "x"
                    ? [edge.x1 + op.start - FW / 2, winY, cz]
                    : [cx, winY, edge.z1 + op.start - FW / 2]
                }
                castShadow
              >
                {edge.axis === "x" ? (
                  <boxGeometry args={[FW, WIN_H, FD]} />
                ) : (
                  <boxGeometry args={[FD, WIN_H, FW]} />
                )}
                <primitive object={frameMat} attach="material" />
              </mesh>
              <mesh
                position={
                  edge.axis === "x"
                    ? [edge.x1 + op.start + op.width + FW / 2, winY, cz]
                    : [cx, winY, edge.z1 + op.start + op.width + FW / 2]
                }
                castShadow
              >
                {edge.axis === "x" ? (
                  <boxGeometry args={[FW, WIN_H, FD]} />
                ) : (
                  <boxGeometry args={[FD, WIN_H, FW]} />
                )}
                <primitive object={frameMat} attach="material" />
              </mesh>
              <mesh position={[cx, winY, cz]}>
                {edge.axis === "x" ? (
                  <boxGeometry args={[FW * 0.7, WIN_H, FD]} />
                ) : (
                  <boxGeometry args={[FD, WIN_H, FW * 0.7]} />
                )}
                <primitive object={frameMat} attach="material" />
              </mesh>
              <mesh position={[cx, winY, cz]}>
                {edge.axis === "x" ? (
                  <boxGeometry args={[op.width - FW, WIN_H - FW, T * 0.25]} />
                ) : (
                  <boxGeometry args={[T * 0.25, WIN_H - FW, op.width - FW]} />
                )}
                <primitive object={glassMat} attach="material" />
              </mesh>
            </group>
          );
        })}
    </group>
  );
}

// ─── Floor & Ceiling per room ─────────────────────────────────────────────────

function RoomSurfaces({ room }: { room: RoomShape }) {
  const { materials, floorMaterials, selectedFloorRoomId, setSelectedFloor } =
    useRoomStore();
  const floorTex = useProceduralTexture(
    materials.floorTexture || "parquet",
    "#C8A882",
  );
  const ceilColor = materials.ceilingColor || "#F5F0EB";
  const W = room.width,
    D = room.height;
  const cx = room.x + W / 2,
    cz = room.y + D / 2;

  // API-დან მინიჭებული იატაკის სურათი (proxy-ით useImageTexture-ში)
  const assignedFloor = floorMaterials?.[room.id] ?? null;
  const floorImgTex = useImageTexture(
    assignedFloor?.image ?? null,
    assignedFloor?.texRepeat ?? DEFAULT_REPEAT,
    assignedFloor?.crop,
  );

  const ceilMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: ceilColor, roughness: 0.95 }),
    [ceilColor],
  );

  const isFloorSelected = selectedFloorRoomId === room.id;

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[cx, 0.001, cz]}
        receiveShadow
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          setSelectedFloor(room.id);
        }}
      >
        <planeGeometry args={[W, D]} />
        {floorImgTex ? (
          <meshStandardMaterial map={floorImgTex} roughness={0.8} />
        ) : (
          <meshStandardMaterial map={floorTex} roughness={0.8} />
        )}
      </mesh>

      {isFloorSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.004, cz]}>
          <planeGeometry args={[W, D]} />
          <meshBasicMaterial color="#2D6A4F" transparent opacity={0.18} />
        </mesh>
      )}

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[cx, WALL_H, cz]}>
        <planeGeometry args={[W, D]} />
        <primitive object={ceilMat} attach="material" />
      </mesh>
    </group>
  );
}

// ─── Partitions ───────────────────────────────────────────────────────────────

function PartitionMesh({
  p,
  wallMat,
}: {
  p: { id: string; x1: number; y1: number; x2: number; y2: number };
  wallMat: THREE.Material;
}) {
  const dx = p.x2 - p.x1,
    dz = p.y2 - p.y1;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);
  const cx = (p.x1 + p.x2) / 2,
    cz = (p.y1 + p.y2) / 2;

  return (
    <mesh
      position={[cx, WALL_H / 2, cz]}
      rotation={[0, -angle, 0]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[length, WALL_H, T]} />
      <primitive object={wallMat} attach="material" />
    </mesh>
  );
}

// ─── Furniture ────────────────────────────────────────────────────────────────

// ─── Real 3D furniture (Kenney Furniture Kit, CC0) ────────────────────────────

const MODEL_URLS: Record<string, string> = {
  sofa: "/models/sofa.glb",
  chair: "/models/chair.glb",
  table: "/models/table.glb",
  bed: "/models/bed.glb",
  plant: "/models/plant.glb",
  wardrobe: "/models/wardrobe.glb",
  desk: "/models/desk.glb",
  lamp: "/models/lamp.glb",
};
Object.values(MODEL_URLS).forEach((u) => useGLTF.preload(u));

function FurnitureModel({ item, url }: { item: Furniture; url: string }) {
  const { scene } = useGLTF(url);

  const model = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);

  // footprint-ის მიხედვით ვამასშტაბებთ + ვაყენებთ იატაკზე, ცენტრში
  const { scale, pos } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const s = size.x > 0 ? item.width / size.x : 1;
    return {
      scale: s,
      pos: [-center.x * s, -box.min.y * s, -center.z * s] as [
        number,
        number,
        number,
      ],
    };
  }, [model, item.width]);

  return <primitive object={model} scale={scale} position={pos} />;
}

function FurnitureItem({ item }: { item: Furniture }) {
  const { setSelectedFurniture, selectedFurnitureId, transformMode, updateFurniture } =
    useRoomStore();
  const isSelected = selectedFurnitureId === item.id;
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setSelectedFurniture(item.id);
  };

  const commit = () => {
    const g = groupRef.current;
    if (!g) return;
    updateFurniture(item.id, {
      x: g.position.x,
      z: g.position.z,
      rotation: g.rotation.y,
      scale: Math.max(0.2, g.scale.x),
    });
  };

  const hasModel = !!MODEL_URLS[item.type];
  const show =
    transformMode === "translate"
      ? { showX: true, showY: false, showZ: true }
      : transformMode === "rotate"
        ? { showX: false, showY: true, showZ: false }
        : { showX: true, showY: true, showZ: true };

  const getFurnitureMesh = () => {
    switch (item.type) {
      case "sofa":
        return (
          <group
            position={[item.x, item.y, item.z]}
            rotation={[0, item.rotation, 0]}
            onClick={handleClick}
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
            onClick={handleClick}
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
            onClick={handleClick}
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
            onClick={handleClick}
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
          <group position={[item.x, item.y, item.z]} onClick={handleClick}>
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
            onClick={handleClick}
            castShadow
          >
            <boxGeometry args={[item.width, item.height, item.depth]} />
            <meshStandardMaterial color={item.color} roughness={0.7} />
          </mesh>
        );
    }
  };

  // არა-მოდელ ტიპები — ძველი (პოზიციონირებული) fallback
  if (!hasModel) {
    return (
      <group>
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

  const content = (
    <group
      ref={groupRef}
      position={[item.x, item.y, item.z]}
      rotation={[0, item.rotation, 0]}
      scale={item.scale ?? 1}
      onClick={handleClick}
    >
      <Suspense fallback={null}>
        <FurnitureModel item={item} url={MODEL_URLS[item.type]} />
      </Suspense>
    </group>
  );

  return (
    <>
      {content}
      {isSelected && groupRef.current && (
        <TransformControls
          object={groupRef.current}
          mode={transformMode}
          {...show}
          onObjectChange={commit}
        />
      )}
    </>
  );
}

// ─── Ground ───────────────────────────────────────────────────────────────────

function Ground() {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.001, 0]}
      receiveShadow
    >
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial color="#D6D0C8" roughness={1} />
    </mesh>
  );
}

// ─── First-person walk ────────────────────────────────────────────────────────

const EYE_H = 1.6;

function FirstPersonMovement({
  bbox,
}: {
  bbox: { cx: number; cz: number; span: number };
}) {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    // საწყისი პოზიცია — ოთახის ცენტრი, თვალის სიმაღლეზე, ჰორიზონტალური ხედი
    camera.position.set(bbox.cx, EYE_H, bbox.cz);
    camera.lookAt(bbox.cx, EYE_H, bbox.cz - 1);

    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      keys.current = {};
    };
  }, [camera, bbox.cx, bbox.cz]);

  useFrame((_, delta) => {
    const k = keys.current;
    const fwd =
      (k["KeyW"] || k["ArrowUp"] ? 1 : 0) - (k["KeyS"] || k["ArrowDown"] ? 1 : 0);
    const str =
      (k["KeyD"] || k["ArrowRight"] ? 1 : 0) -
      (k["KeyA"] || k["ArrowLeft"] ? 1 : 0);
    if (fwd === 0 && str === 0) return;

    const speed = 3 * delta;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    const right = new THREE.Vector3()
      .crossVectors(dir, new THREE.Vector3(0, 1, 0))
      .normalize();

    camera.position.addScaledVector(dir, fwd * speed);
    camera.position.addScaledVector(right, str * speed);
    camera.position.y = EYE_H;

    // ოთახის საზღვრებში შენარჩუნება
    const half = bbox.span / 2 + 1;
    camera.position.x = Math.min(
      bbox.cx + half,
      Math.max(bbox.cx - half, camera.position.x),
    );
    camera.position.z = Math.min(
      bbox.cz + half,
      Math.max(bbox.cz - half, camera.position.z),
    );
  });

  return null;
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export default function Scene3D() {
  const {
    rooms,
    doors,
    windows,
    partitions,
    furniture,
    materials,
    setSelectedFurniture,
    selectedFurnitureId,
    transformMode,
    setTransformMode,
    removeFurniture,
    selectedWallKey,
    wallMaterials,
    setSelectedWall,
    setWallKeys,
    firstPerson,
    setFirstPerson,
  } = useRoomStore();

  const wallTex = useProceduralTexture(
    materials.wallTexture || "plain",
    materials.wallColor || "#F0EDE8",
  );
  const wallMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: wallTex.clone(),
        roughness: 0.88,
        color: "#F0EDE8",
      }),
    [wallTex],
  );
  const glassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#B8D8F0",
        transparent: true,
        opacity: 0.32,
        roughness: 0.05,
        metalness: 0.15,
      }),
    [],
  );
  const frameMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#E8E2D8", roughness: 0.7 }),
    [],
  );
  const doorMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#C8B898", roughness: 0.6 }),
    [],
  );

  const walls = useMemo(
    () => buildAllWalls(rooms, doors as Door[], windows as any),
    [rooms, doors, windows],
  );

  // ყველა კედლის key-ის რეგისტრაცია store-ში („ყველა კედელზე გადატანისთვის")
  const wallKeysArr = useMemo(
    () => walls.map((e) => makeWallKey(e.x1, e.z1, e.x2, e.z2)),
    [walls],
  );
  useEffect(() => {
    setWallKeys(wallKeysArr);
  }, [wallKeysArr, setWallKeys]);

  const bbox = useMemo(() => {
    if (rooms.length === 0) return { cx: 4, cz: 4, span: 8 };
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
      span: Math.max(maxX - minX, maxZ - minZ),
    };
  }, [rooms]);

  const camDist = bbox.span * 1.2 + 5;

  // pointer-lock სტატუსი (რომ overlay-მ იცოდეს ჩაკეტილია თუ არა)
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const onChange = () => setLocked(!!document.pointerLockElement);
    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
  }, []);

  return (
    <div className="w-full h-full relative">
      {/* Drag & drop zone — კედელზე ფერის ჩასხმა */}
      <WallDropZone />

      <Canvas
        camera={{
          position: [
            bbox.cx + camDist * 0.55,
            camDist * 0.7,
            bbox.cz + camDist * 0.85,
          ],
          fov: 48,
        }}
        shadows
        gl={{ preserveDrawingBuffer: true }}
        onPointerMissed={() => {
          setSelectedFurniture(null);
          // setSelectedWall(null);
        }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[bbox.cx + 6, 10, bbox.cz + 6]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
        />
        <pointLight
          position={[bbox.cx, 2.4, bbox.cz]}
          intensity={0.2}
          color="#FFF4E0"
        />

        <Ground />

        {rooms.map((room: any) => (
          <RoomSurfaces key={room.id} room={room} />
        ))}

        {walls.map((edge, i) => {
          const wk = makeWallKey(edge.x1, edge.z1, edge.x2, edge.z2);
          return (
            <WallMesh
              key={i}
              edge={edge}
              wKey={wk}
              wallTex={wallTex}
              glassMat={glassMat}
              frameMat={frameMat}
              doorMat={doorMat}
              isSelected={selectedWallKey === wk}
              assignedColor={wallMaterials?.[wk]?.color?.color ?? null}
              assignedImageUrl={wallMaterials?.[wk]?.material?.image ?? null}
              assignedRepeat={wallMaterials?.[wk]?.texRepeat ?? DEFAULT_REPEAT}
              assignedCrop={wallMaterials?.[wk]?.crop}
              onSelect={(key) => setSelectedWall(key)}
            />
          );
        })}

        {partitions.map((p: any) => (
          <PartitionMesh key={p.id} p={p} wallMat={wallMat} />
        ))}

        {furniture.map((item: any) => (
          <FurnitureItem key={item.id} item={item} />
        ))}

        {firstPerson ? (
          <>
            <FirstPersonMovement bbox={bbox} />
            <PointerLockControls selector="#fp-enter" />
          </>
        ) : (
          <OrbitControls
            makeDefault
            target={[bbox.cx, 1.2, bbox.cz]}
            maxPolarAngle={Math.PI / 2.05}
            minDistance={2}
            maxDistance={50}
          />
        )}
        <Environment preset="apartment" />
      </Canvas>

      {/* ადამიანის ხედის ღილაკი */}
      {!firstPerson && (
        <button
          onClick={() => setFirstPerson(true)}
          className="absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white/95 px-3 py-2 text-xs font-medium text-gray-700 shadow-lg backdrop-blur hover:bg-gray-50"
        >
          👁 ადამიანის ხედი
        </button>
      )}

      {/* walk mode overlay */}
      {firstPerson && (
        <>
          {/* შესვლის ღილაკი — მხოლოდ ამის კლიკი კეტავს კურსორს (selector).
              ყოველთვის DOM-შია; ჩაკეტვისას უხილავი ხდება. */}
          <button
            id="fp-enter"
            className={`absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-black/75 px-6 py-4 text-sm font-medium text-white shadow-xl backdrop-blur transition-opacity ${
              locked ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
          >
            ▶ დააკლიკე გადასაადგილებლად
          </button>

          <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-xl bg-black/70 px-4 py-2 text-center text-xs text-white backdrop-blur">
            <b>WASD / ისრები</b> — სიარული · <b>მაუსი</b> — ყურება · <b>Esc</b> — კურსორის გათავისუფლება
          </div>
          <button
            onClick={() => setFirstPerson(false)}
            className="absolute right-4 top-4 z-10 rounded-xl bg-white/95 px-3 py-2 text-xs font-medium text-gray-700 shadow-lg backdrop-blur hover:bg-gray-50"
          >
            ✕ გასვლა
          </button>
        </>
      )}

      {/* ავეჯის მართვის toolbar (ჩანს როცა ავეჯი მონიშნულია) */}
      {selectedFurnitureId && !firstPerson && (
        <div className="absolute left-1/2 bottom-5 z-10 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-gray-200 bg-white/95 p-1.5 shadow-lg backdrop-blur">
          {([
            { m: "translate" as const, label: "გადატანა", icon: "✥" },
            { m: "rotate" as const, label: "ბრუნვა", icon: "⟳" },
            { m: "scale" as const, label: "ზომა", icon: "⤡" },
          ]).map((b) => (
            <button
              key={b.m}
              onClick={() => setTransformMode(b.m)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                transformMode === b.m
                  ? "bg-brand text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span className="text-sm leading-none">{b.icon}</span>
              {b.label}
            </button>
          ))}
          <div className="mx-1 h-6 w-px bg-gray-200" />
          <button
            onClick={() => removeFurniture(selectedFurnitureId)}
            className="rounded-xl px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50"
          >
            წაშლა
          </button>
        </div>
      )}
    </div>
  );
}
