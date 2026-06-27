import { create } from 'zustand'

export type ViewMode = '2d' | '3d'
export type Tool = 'select' | 'room' | 'partition' | 'door' | 'window' | 'erase'

export interface Point { x: number; y: number }

export interface RoomShape {
  id: string
  x: number; y: number
  width: number; height: number
  label: string
  color: string
}

export interface Partition {
  id: string
  x1: number; y1: number
  x2: number; y2: number
}

export interface Door {
  id: string
  wallSide: 'top' | 'bottom' | 'left' | 'right'
  roomId: string
  offset: number
  width: number
  opensInward: boolean
}

export interface WindowEl {
  id: string
  wallSide: 'top' | 'bottom' | 'left' | 'right'
  roomId: string
  offset: number
  width: number
}

export interface Furniture {
  id: string
  type: string
  label: string
  x: number; y: number; z: number
  rotation: number
  width: number; depth: number; height: number
  color: string
}

export interface MaterialChoice {
  wallTexture: string
  wallColor: string
  floorTexture: string
  ceilingColor: string
}

interface EditorStore {
  viewMode: ViewMode
  activeTool: Tool
  rooms: RoomShape[]
  partitions: Partition[]
  doors: Door[]
  windows: WindowEl[]
  furniture: Furniture[]
  materials: MaterialChoice
  selectedId: string | null
  selectedType: 'room' | 'partition' | 'door' | 'window' | 'furniture' | null
  roomGenerated: boolean
  room: { width: number; height: number }

  setViewMode: (m: ViewMode) => void
  setActiveTool: (t: Tool) => void
  addRoom: (r: RoomShape) => void
  updateRoom: (id: string, u: Partial<RoomShape>) => void
  removeRoom: (id: string) => void
  addPartition: (p: Partition) => void
  removePartition: (id: string) => void
  addDoor: (d: Door) => void
  removeDoor: (id: string) => void
  addWindow: (w: WindowEl) => void
  removeWindow: (id: string) => void
  setSelected: (id: string | null, type: EditorStore['selectedType']) => void
  addFurniture: (item: Furniture) => void
  removeFurniture: (id: string) => void
  updateFurniture: (id: string, u: Partial<Furniture>) => void
  setMaterials: (m: Partial<MaterialChoice>) => void
  setRoomGenerated: (v: boolean) => void
  setRoom: (r: { width: number; height: number }) => void
  clearAll: () => void
}

export const useRoomStore = create<EditorStore>((set) => ({
  viewMode: '2d',
  activeTool: 'select',
  rooms: [
    { id: 'r1', x: 0, y: 0, width: 6, height: 5, label: 'მისაღები', color: '#FEF9F3' }
  ],
  partitions: [],
  doors: [],
  windows: [],
  furniture: [],
  materials: {
    wallTexture: 'plain',
    wallColor: '#F5F0EB',
    floorTexture: 'parquet',
    ceilingColor: '#FFFFFF',
  },
  selectedId: null,
  selectedType: null,
  roomGenerated: false,
  room: { width: 6, height: 5 },

  setViewMode: (m) => set({ viewMode: m }),
  setActiveTool: (t) => set({ activeTool: t }),
  addRoom: (r) => set((s) => ({ rooms: [...s.rooms, r] })),
  updateRoom: (id, u) => set((s) => ({ rooms: s.rooms.map(r => r.id === id ? { ...r, ...u } : r) })),
  removeRoom: (id) => set((s) => {
    const filtered = s.rooms.filter(r => r.id !== id)
    let counter = 1
    const renumbered = filtered.map(r => {
      if (/^ოთახი \d+$/.test(r.label)) {
        return { ...r, label: `ოთახი ${counter++}` }
      }
      counter++
      return r
    })
    return { rooms: renumbered }
  }),
  addPartition: (p) => set((s) => ({ partitions: [...s.partitions, p] })),
  removePartition: (id) => set((s) => ({ partitions: s.partitions.filter(p => p.id !== id) })),
  addDoor: (d) => set((s) => ({ doors: [...s.doors, d] })),
  removeDoor: (id) => set((s) => ({ doors: s.doors.filter(d => d.id !== id) })),
  addWindow: (w) => set((s) => ({ windows: [...s.windows, w] })),
  removeWindow: (id) => set((s) => ({ windows: s.windows.filter(w => w.id !== id) })),
  setSelected: (id, type) => set({ selectedId: id, selectedType: type }),
  addFurniture: (item) => set((s) => ({ furniture: [...s.furniture, item] })),
  removeFurniture: (id) => set((s) => ({ furniture: s.furniture.filter(f => f.id !== id) })),
  updateFurniture: (id, u) => set((s) => ({ furniture: s.furniture.map(f => f.id === id ? { ...f, ...u } : f) })),
  setMaterials: (m) => set((s) => ({ materials: { ...s.materials, ...m } })),
  setRoomGenerated: (v) => set({ roomGenerated: v }),
  setRoom: (r) => set({ room: r }),
  clearAll: () => set({
    rooms: [], partitions: [], doors: [], windows: [], furniture: [],
    selectedId: null, selectedType: null,
  }),
}))