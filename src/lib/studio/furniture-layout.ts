import { FURNITURE_CATALOG, type FurnitureType } from '@/lib/constants/furniture-catalog'
import type { Furniture } from '@/lib/store/room-store'

const MARGIN = 0.4
const GAP = 0.3
const SCAN_STEP = 0.35

export type Placement = 'back' | 'front' | 'left' | 'right' | 'center' | 'corner'

export interface LayoutItem {
  type: string
  label: string
  placement?: Placement
}

export interface RoomBounds {
  x: number
  y: number
  width: number
  height: number
}

const TYPE_PRIORITY: Record<string, number> = {
  bed: 0,
  wardrobe: 1,
  sofa: 2,
  desk: 3,
  table: 4,
  chair: 5,
  plant: 6,
  lamp: 7,
}

function defaultWallForType(type: string): Placement {
  switch (type) {
    case 'bed':
      return 'back'
    case 'wardrobe':
      return 'left'
    case 'sofa':
      return 'front'
    case 'desk':
      return 'right'
    case 'table':
    case 'chair':
      return 'center'
    case 'plant':
    case 'lamp':
      return 'corner'
    default:
      return 'center'
  }
}

function getCatalog(type: string) {
  const key = type as FurnitureType
  return FURNITURE_CATALOG[key] ?? FURNITURE_CATALOG.table
}

function preferredPoint(room: RoomBounds, placement: Placement, w: number, d: number) {
  const cx = room.x + room.width / 2
  const cz = room.y + room.height / 2
  const m = MARGIN

  switch (placement) {
    case 'back':
      return { x: cx, z: room.y + m + d / 2 }
    case 'front':
      return { x: cx, z: room.y + room.height - m - d / 2 }
    case 'left':
      return { x: room.x + m + w / 2, z: cz }
    case 'right':
      return { x: room.x + room.width - m - w / 2, z: cz }
    case 'corner':
      return { x: room.x + m + w / 2, z: room.y + m + d / 2 }
    case 'center':
    default:
      return { x: cx, z: cz }
  }
}

function overlaps(
  ax: number,
  az: number,
  aw: number,
  ad: number,
  bx: number,
  bz: number,
  bw: number,
  bd: number
): boolean {
  const gap = GAP
  const aLeft = ax - aw / 2 - gap
  const aRight = ax + aw / 2 + gap
  const aTop = az - ad / 2 - gap
  const aBottom = az + ad / 2 + gap
  const bLeft = bx - bw / 2
  const bRight = bx + bw / 2
  const bTop = bz - bd / 2
  const bBottom = bz + bd / 2
  return aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop
}

function inBounds(room: RoomBounds, x: number, z: number, w: number, d: number): boolean {
  const m = MARGIN
  return (
    x - w / 2 >= room.x + m &&
    x + w / 2 <= room.x + room.width - m &&
    z - d / 2 >= room.y + m &&
    z + d / 2 <= room.y + room.height - m
  )
}

function collidesWithAny(
  x: number,
  z: number,
  w: number,
  d: number,
  placed: Furniture[]
): boolean {
  return placed.some((p) => overlaps(x, z, w, d, p.x, p.z, p.width, p.depth))
}

function scanCandidates(room: RoomBounds, w: number, d: number): { x: number; z: number }[] {
  const points: { x: number; z: number }[] = []
  const startX = room.x + MARGIN + w / 2
  const endX = room.x + room.width - MARGIN - w / 2
  const startZ = room.y + MARGIN + d / 2
  const endZ = room.y + room.height - MARGIN - d / 2

  for (let x = startX; x <= endX + 0.001; x += SCAN_STEP) {
    for (let z = startZ; z <= endZ + 0.001; z += SCAN_STEP) {
      points.push({ x, z })
    }
  }
  return points
}

function findPosition(
  room: RoomBounds,
  item: LayoutItem,
  placed: Furniture[]
): { x: number; z: number } | null {
  const catalog = getCatalog(item.type)
  const placement = item.placement ?? defaultWallForType(item.type)
  const preferred = preferredPoint(room, placement, catalog.width, catalog.depth)

  if (
    inBounds(room, preferred.x, preferred.z, catalog.width, catalog.depth) &&
    !collidesWithAny(preferred.x, preferred.z, catalog.width, catalog.depth, placed)
  ) {
    return preferred
  }

  const candidates = scanCandidates(room, catalog.width, catalog.depth)
  candidates.sort((a, b) => {
    const da = (a.x - preferred.x) ** 2 + (a.z - preferred.z) ** 2
    const db = (b.x - preferred.x) ** 2 + (b.z - preferred.z) ** 2
    return da - db
  })

  for (const c of candidates) {
    if (!collidesWithAny(c.x, c.z, catalog.width, catalog.depth, placed)) {
      return c
    }
  }
  return null
}

export function ensureRoomFits(
  room: RoomBounds,
  items: LayoutItem[]
): RoomBounds {
  if (items.length === 0) return room

  let width = room.width
  let height = room.height
  let changed = true

  while (changed) {
    changed = false
    const testRoom = { ...room, width, height }
    const placed: Furniture[] = []

    const sorted = [...items].sort(
      (a, b) => (TYPE_PRIORITY[a.type] ?? 99) - (TYPE_PRIORITY[b.type] ?? 99)
    )

    for (const item of sorted) {
      const pos = findPosition(testRoom, item, placed)
      if (!pos) {
        width += 1
        height += 0.5
        changed = true
        break
      }
      const catalog = getCatalog(item.type)
      placed.push({
        id: 'test',
        type: item.type,
        label: item.label,
        x: pos.x,
        y: 0,
        z: pos.z,
        rotation: 0,
        width: catalog.width,
        depth: catalog.depth,
        height: catalog.height,
        color: catalog.color,
      })
    }
  }

  return { ...room, width, height }
}

export function layoutFurnitureInRoom(
  room: RoomBounds,
  items: LayoutItem[],
  idPrefix = 'f'
): Furniture[] {
  const sorted = [...items].sort(
    (a, b) => (TYPE_PRIORITY[a.type] ?? 99) - (TYPE_PRIORITY[b.type] ?? 99)
  )

  const placed: Furniture[] = []

  sorted.forEach((item, index) => {
    const catalog = getCatalog(item.type)
    const pos = findPosition(room, item, placed)
    if (!pos) return

    placed.push({
      id: `${idPrefix}-${index}-${Date.now()}`,
      type: item.type,
      label: item.label,
      x: pos.x,
      y: 0,
      z: pos.z,
      rotation: 0,
      width: catalog.width,
      depth: catalog.depth,
      height: catalog.height,
      color: catalog.color,
    })
  })

  return placed
}

export function placeSingleItem(
  room: RoomBounds,
  existing: Furniture[],
  item: { type: string; label: string },
  id: string
): Furniture | null {
  const catalog = getCatalog(item.type)
  const layoutItem: LayoutItem = {
    type: item.type,
    label: item.label,
    placement: defaultWallForType(item.type),
  }
  const pos = findPosition(room, layoutItem, existing)
  if (!pos) return null

  return {
    id,
    type: item.type,
    label: item.label,
    x: pos.x,
    y: 0,
    z: pos.z,
    rotation: 0,
    width: catalog.width,
    depth: catalog.depth,
    height: catalog.height,
    color: catalog.color,
  }
}
