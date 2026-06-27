import type { MoodboardResult, MoodboardFurniture, MoodboardRoom } from './types'
import type { RoomShape, Furniture } from '@/lib/store/room-store'
import { ensureRoomFits, layoutFurnitureInRoom } from '@/lib/studio/furniture-layout'
import { layoutRooms, boundingBox, normalizeRoomOrigin } from '@/lib/studio/room-layout'

function toLayoutItems(items: MoodboardFurniture[]) {
  return items.map((f) => ({
    type: f.type,
    label: f.label,
    placement: f.placement,
  }))
}

function placeFurnitureForRooms(
  roomDefs: MoodboardRoom[],
  rooms: RoomShape[]
): Furniture[] {
  const all: Furniture[] = []

  roomDefs.forEach((def, i) => {
    const items = def.furniture ?? []
    if (items.length === 0 || !rooms[i]) return

    let room = rooms[i]
    const layoutItems = toLayoutItems(items)
    const fitted = ensureRoomFits(room, layoutItems)
    if (fitted.width !== room.width || fitted.height !== room.height) {
      room = { ...room, width: fitted.width, height: fitted.height }
      rooms[i] = room
    }

    all.push(...layoutFurnitureInRoom(room, layoutItems, `ai-${i}`))
  })

  return all
}

function buildMultiRoomPatch(board: MoodboardResult) {
  const roomDefs = board.rooms!
  let rooms = layoutRooms(
    roomDefs.map((r) => ({
      label: r.label,
      width: r.width,
      height: r.height,
      x: r.x,
      y: r.y,
      attachSide: r.attachSide,
      attachToIndex: r.attachToIndex,
    }))
  )

  const furniture = placeFurnitureForRooms(roomDefs, rooms)
  rooms = normalizeRoomOrigin(rooms)

  return {
    rooms,
    furniture,
    materials: {
      wallColor: board.colors.wall,
      ceilingColor: board.colors.ceiling,
      wallTexture: board.materials.wallTexture,
      floorTexture: board.materials.floorTexture,
    },
    room: boundingBox(rooms),
  }
}

function buildSingleRoomPatch(board: MoodboardResult) {
  const width = board.roomHint?.width ?? 6
  const height = board.roomHint?.height ?? 5

  const baseRoom: RoomShape = {
    id: 'ai-room-0',
    x: 0,
    y: 0,
    width,
    height,
    label: board.title || 'AI ოთახი',
    color: '#FEF9F3',
  }

  const layoutItems = toLayoutItems(board.furniture)
  const fittedRoom = ensureRoomFits(baseRoom, layoutItems)
  const room: RoomShape = { ...baseRoom, width: fittedRoom.width, height: fittedRoom.height }
  const furniture: Furniture[] = layoutFurnitureInRoom(room, layoutItems, 'ai-0')

  return {
    rooms: [room],
    furniture,
    materials: {
      wallColor: board.colors.wall,
      ceilingColor: board.colors.ceiling,
      wallTexture: board.materials.wallTexture,
      floorTexture: board.materials.floorTexture,
    },
    room: { width: room.width, height: room.height },
  }
}

export function moodboardToStudioPatch(board: MoodboardResult) {
  if (board.rooms && board.rooms.length > 0) {
    return buildMultiRoomPatch(board)
  }
  return buildSingleRoomPatch(board)
}
