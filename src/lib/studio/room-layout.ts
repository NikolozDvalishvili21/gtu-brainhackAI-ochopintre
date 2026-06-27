import type { RoomShape } from '@/lib/store/room-store'

const ROOM_COLORS = ['#FEF9F3', '#F0F4FF', '#F0FFF4', '#FFF5F0', '#F5F0FF']

export type AttachSide = 'right' | 'bottom' | 'left' | 'top'

export interface RoomSpec {
  label: string
  width: number
  height: number
  x?: number
  y?: number
  attachSide?: AttachSide
  attachToIndex?: number
}

export function layoutRooms(specs: RoomSpec[], idPrefix = 'ai-room'): RoomShape[] {
  const placed: RoomShape[] = []

  specs.forEach((spec, i) => {
    let x = spec.x
    let y = spec.y

    if (x === undefined && y === undefined) {
      if (i === 0) {
        x = 0
        y = 0
      } else {
        const attachTo = Math.min(spec.attachToIndex ?? i - 1, placed.length - 1)
        const prev = placed[attachTo]
        const side = spec.attachSide ?? 'right'
        switch (side) {
          case 'right':
            x = prev.x + prev.width
            y = prev.y
            break
          case 'bottom':
            x = prev.x
            y = prev.y + prev.height
            break
          case 'left':
            x = prev.x - spec.width
            y = prev.y
            break
          case 'top':
            x = prev.x
            y = prev.y - spec.height
            break
        }
      }
    }

    placed.push({
      id: `${idPrefix}-${i}`,
      x: x ?? 0,
      y: y ?? 0,
      width: spec.width,
      height: spec.height,
      label: spec.label || `ოთახი ${i + 1}`,
      color: ROOM_COLORS[i % ROOM_COLORS.length],
    })
  })

  return normalizeRoomOrigin(placed)
}

/** Shift rooms so the bounding box starts at (0, 0). */
export function normalizeRoomOrigin(rooms: RoomShape[]): RoomShape[] {
  if (rooms.length === 0) return rooms
  const minX = Math.min(...rooms.map((r) => r.x))
  const minY = Math.min(...rooms.map((r) => r.y))
  if (minX === 0 && minY === 0) return rooms
  return rooms.map((r) => ({ ...r, x: r.x - minX, y: r.y - minY }))
}

export function boundingBox(rooms: RoomShape[]): { width: number; height: number } {
  if (rooms.length === 0) return { width: 6, height: 5 }
  const maxX = Math.max(...rooms.map((r) => r.x + r.width))
  const maxY = Math.max(...rooms.map((r) => r.y + r.height))
  return {
    width: Math.round(maxX * 10) / 10,
    height: Math.round(maxY * 10) / 10,
  }
}
