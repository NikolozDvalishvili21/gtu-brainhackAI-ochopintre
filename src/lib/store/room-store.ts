import { create } from "zustand";

export type ViewMode = "2d" | "3d";
export type Tool =
  | "select"
  | "room"
  | "partition"
  | "door"
  | "window"
  | "erase";

export interface Point {
  x: number;
  y: number;
}

export interface RoomShape {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: string;
}

export interface Partition {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Door {
  id: string;
  wallSide: "top" | "bottom" | "left" | "right";
  roomId: string;
  offset: number;
  width: number;
  opensInward: boolean;
}

export interface WindowEl {
  id: string;
  wallSide: "top" | "bottom" | "left" | "right";
  roomId: string;
  offset: number;
  width: number;
}

export interface Furniture {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  width: number;
  depth: number;
  height: number;
  color: string;
}

export interface MaterialChoice {
  wallTexture: string;
  wallColor: string;
  floorTexture: string;
  ceilingColor: string;
}

// ─── Wall material assignment ─────────────────────────────────────────────────

export interface WallColor {
  id: string;
  name: string;
  color: string;
}

export interface MaterialRef {
  id: string;
  name: string;
  image: string;
  price: number | null;
  currency: string | null;
  unit: string | null;
  category: string;
  source?: string; // 'nova' | 'domino'
  url?: string | null;
  dimensions?: string | null;
}

export interface WallMaterialAssignment {
  // paint color (from /colors API)
  color?: WallColor;
  // material with image — e.g. wallpaper (from /materials API)
  material?: MaterialRef;
  wallArea?: number;
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface EditorStore {
  viewMode: ViewMode;
  activeTool: Tool;
  rooms: RoomShape[];
  partitions: Partition[];
  doors: Door[];
  windows: WindowEl[];
  furniture: Furniture[];
  materials: MaterialChoice;
  selectedId: string | null;
  selectedType: "room" | "partition" | "door" | "window" | "furniture" | null;
  roomGenerated: boolean;
  room: { width: number; height: number };

  // ── Wall selection & per-wall materials ──────────────────────────────────
  selectedWallKey: string | null;
  selectedFurnitureId: string | null;
  wallMaterials: Record<string, WallMaterialAssignment>;

  // ── Floor selection & per-room floor material ────────────────────────────
  selectedFloorRoomId: string | null;
  floorMaterials: Record<string, MaterialRef>;

  // ── Actions ───────────────────────────────────────────────────────────────
  setViewMode: (m: ViewMode) => void;
  setActiveTool: (t: Tool) => void;
  addRoom: (r: RoomShape) => void;
  updateRoom: (id: string, u: Partial<RoomShape>) => void;
  removeRoom: (id: string) => void;
  addPartition: (p: Partition) => void;
  removePartition: (id: string) => void;
  addDoor: (d: Door) => void;
  removeDoor: (id: string) => void;
  addWindow: (w: WindowEl) => void;
  removeWindow: (id: string) => void;
  setSelected: (id: string | null, type: EditorStore["selectedType"]) => void;
  addFurniture: (item: Furniture) => void;
  removeFurniture: (id: string) => void;
  updateFurniture: (id: string, u: Partial<Furniture>) => void;
  setMaterials: (m: Partial<MaterialChoice>) => void;
  setRoomGenerated: (v: boolean) => void;
  setRoom: (r: { width: number; height: number }) => void;
  clearAll: () => void;

  // ── Wall material actions ─────────────────────────────────────────────────
  setSelectedWall: (key: string | null) => void;
  setSelectedFurniture: (id: string | null) => void;
  setWallMaterial: (wallKey: string, assignment: WallMaterialAssignment) => void;
  clearWallMaterial: (wallKey: string) => void;

  // ── Convenience: set only color ───────────────────────────────────────────
  setWallColor: (wallKey: string, color: WallColor) => void;
  clearWallColor: (wallKey: string) => void;

  // ── Floor material actions ────────────────────────────────────────────────
  setSelectedFloor: (roomId: string | null) => void;
  setFloorMaterial: (roomId: string, material: MaterialRef) => void;
  clearFloorMaterial: (roomId: string) => void;

  hydrateFromBrief: (patch: {
    rooms?: RoomShape[];
    furniture?: Furniture[];
    materials?: Partial<MaterialChoice>;
    room?: { width: number; height: number };
  }) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useRoomStore = create<EditorStore>((set) => ({
  viewMode: "2d",
  activeTool: "select",
  rooms: [
    {
      id: "r1",
      x: 0,
      y: 0,
      width: 6,
      height: 5,
      label: "მისაღები",
      color: "#FEF9F3",
    },
  ],
  partitions: [],
  doors: [],
  windows: [],
  furniture: [],
  materials: {
    wallTexture: "plain",
    wallColor: "#F5F0EB",
    floorTexture: "parquet",
    ceilingColor: "#FFFFFF",
  },
  selectedId: null,
  selectedType: null,
  roomGenerated: false,
  room: { width: 6, height: 5 },

  selectedWallKey: null,
  selectedFurnitureId: null,
  wallMaterials: {},

  selectedFloorRoomId: null,
  floorMaterials: {},

  setViewMode: (m) => set({ viewMode: m }),
  setActiveTool: (t) => set({ activeTool: t }),

  addRoom: (r) => set((s) => ({ rooms: [...s.rooms, r] })),
  updateRoom: (id, u) =>
    set((s) => ({
      rooms: s.rooms.map((r) => (r.id === id ? { ...r, ...u } : r)),
    })),
  removeRoom: (id) =>
    set((s) => {
      const filtered = s.rooms.filter((r) => r.id !== id);
      let counter = 1;
      const renumbered = filtered.map((r) => {
        if (/^ოთახი \d+$/.test(r.label)) {
          return { ...r, label: `ოთახი ${counter++}` };
        }
        counter++;
        return r;
      });
      return { rooms: renumbered };
    }),

  addPartition: (p) => set((s) => ({ partitions: [...s.partitions, p] })),
  removePartition: (id) =>
    set((s) => ({ partitions: s.partitions.filter((p) => p.id !== id) })),

  addDoor: (d) => set((s) => ({ doors: [...s.doors, d] })),
  removeDoor: (id) =>
    set((s) => ({ doors: s.doors.filter((d) => d.id !== id) })),

  addWindow: (w) => set((s) => ({ windows: [...s.windows, w] })),
  removeWindow: (id) =>
    set((s) => ({ windows: s.windows.filter((w) => w.id !== id) })),

  setSelected: (id, type) => set({ selectedId: id, selectedType: type }),

  addFurniture: (item) => set((s) => ({ furniture: [...s.furniture, item] })),
  removeFurniture: (id) =>
    set((s) => ({ furniture: s.furniture.filter((f) => f.id !== id) })),
  updateFurniture: (id, u) =>
    set((s) => ({
      furniture: s.furniture.map((f) => (f.id === id ? { ...f, ...u } : f)),
    })),

  setMaterials: (m) => set((s) => ({ materials: { ...s.materials, ...m } })),
  setRoomGenerated: (v) => set({ roomGenerated: v }),
  setRoom: (r) => set({ room: r }),

  clearAll: () =>
    set({
      rooms: [],
      partitions: [],
      doors: [],
      windows: [],
      furniture: [],
      selectedId: null,
      selectedType: null,
      selectedWallKey: null,
      selectedFurnitureId: null,
      wallMaterials: {},
      selectedFloorRoomId: null,
      floorMaterials: {},
    }),

  setSelectedWall: (key) =>
    set({
      selectedWallKey: key,
      selectedFurnitureId: null,
      selectedFloorRoomId: null,
    }),

  setSelectedFurniture: (id) =>
    set({
      selectedFurnitureId: id,
      selectedWallKey: null,
      selectedFloorRoomId: null,
    }),

  setWallMaterial: (wallKey, assignment) =>
    set((s) => ({
      wallMaterials: { ...s.wallMaterials, [wallKey]: assignment },
    })),

  clearWallMaterial: (wallKey) =>
    set((s) => {
      const next = { ...s.wallMaterials };
      delete next[wallKey];
      return { wallMaterials: next };
    }),

  setWallColor: (wallKey, color) =>
    set((s) => ({
      wallMaterials: {
        ...s.wallMaterials,
        [wallKey]: { ...s.wallMaterials[wallKey], color },
      },
    })),

  clearWallColor: (wallKey) =>
    set((s) => {
      const next = { ...s.wallMaterials };
      if (next[wallKey]) {
        const { color, ...rest } = next[wallKey];
        if (Object.keys(rest).length === 0) delete next[wallKey];
        else next[wallKey] = rest;
      }
      return { wallMaterials: next };
    }),

  // ── Floor ──────────────────────────────────────────────────────────────────
  setSelectedFloor: (roomId) =>
    set({
      selectedFloorRoomId: roomId,
      selectedWallKey: null,
      selectedFurnitureId: null,
    }),

  setFloorMaterial: (roomId, material) =>
    set((s) => ({
      floorMaterials: { ...s.floorMaterials, [roomId]: material },
    })),

  clearFloorMaterial: (roomId) =>
    set((s) => {
      const next = { ...s.floorMaterials };
      delete next[roomId];
      return { floorMaterials: next };
    }),

  hydrateFromBrief: (patch) =>
    set((s) => {
      const next: Partial<EditorStore> = {
        roomGenerated: true,
        viewMode: "3d",
      };

      if (patch.rooms) {
        next.rooms = patch.rooms;
        next.partitions = [];
        next.doors = [];
        next.windows = [];
      }
      if (patch.furniture) next.furniture = patch.furniture;
      if (patch.materials) {
        next.materials = { ...s.materials, ...patch.materials };
      }
      if (patch.room) next.room = patch.room;

      return next;
    }),
}));