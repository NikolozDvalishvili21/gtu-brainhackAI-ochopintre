import { create } from 'zustand'

export type ViewMode = '2d' | '3d'

export interface Wall {
  id: string
  x1: number; y1: number
  x2: number; y2: number
}

export interface Room2D {
  width: number  // meters
  height: number // meters
  walls: Wall[]
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

interface RoomStore {
  viewMode: ViewMode
  room: Room2D
  furniture: Furniture[]
  materials: MaterialChoice
  selectedFurnitureId: string | null
  roomGenerated: boolean

  setViewMode: (mode: ViewMode) => void
  setRoom: (room: Room2D) => void
  addFurniture: (item: Furniture) => void
  removeFurniture: (id: string) => void
  updateFurniture: (id: string, updates: Partial<Furniture>) => void
  setSelectedFurniture: (id: string | null) => void
  setMaterials: (m: Partial<MaterialChoice>) => void
  setRoomGenerated: (v: boolean) => void
}

export const useRoomStore = create<RoomStore>((set) => ({
  viewMode: '2d',
  room: { width: 6, height: 5, walls: [] },
  furniture: [],
  materials: {
    wallTexture: 'plain',
    wallColor: '#F5F0EB',
    floorTexture: 'parquet',
    ceilingColor: '#FFFFFF',
  },
  selectedFurnitureId: null,
  roomGenerated: false,

  setViewMode: (mode) => set({ viewMode: mode }),
  setRoom: (room) => set({ room }),
  addFurniture: (item) => set((s) => ({ furniture: [...s.furniture, item] })),
  removeFurniture: (id) => set((s) => ({ furniture: s.furniture.filter(f => f.id !== id) })),
  updateFurniture: (id, updates) => set((s) => ({
    furniture: s.furniture.map(f => f.id === id ? { ...f, ...updates } : f)
  })),
  setSelectedFurniture: (id) => set({ selectedFurnitureId: id }),
  setMaterials: (m) => set((s) => ({ materials: { ...s.materials, ...m } })),
  setRoomGenerated: (v) => set({ roomGenerated: v }),
}))
