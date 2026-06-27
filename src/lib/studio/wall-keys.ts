import type { RoomShape } from '@/lib/store/room-store'

const T = 0.14
const H = T / 2

type WallSide = 'top' | 'bottom' | 'left' | 'right'

export function makeWallKey(x1: number, z1: number, x2: number, z2: number): string {
  return `${Math.round(x1 * 1000)},${Math.round(z1 * 1000)},${Math.round(x2 * 1000)},${Math.round(z2 * 1000)}`
}

/** Same key generation as Scene3D buildAllWalls (geometry only). */
export function buildWallKeysForRooms(rooms: RoomShape[]): string[] {
  const edgeMap = new Map<string, string>()

  for (const room of rooms) {
    const { x, y: rz, width: W, height: D } = room
    const edges: Array<{ x1: number; z1: number; x2: number; z2: number; axis: 'x' | 'z' }> = [
      { x1: x, z1: rz, x2: x + W, z2: rz, axis: 'x' },
      { x1: x, z1: rz + D, x2: x + W, z2: rz + D, axis: 'x' },
      { x1: x, z1: rz, x2: x, z2: rz + D, axis: 'z' },
      { x1: x + W, z1: rz, x2: x + W, z2: rz + D, axis: 'z' },
    ]

    for (const e of edges) {
      let { x1, z1, x2, z2 } = e
      if (e.axis === 'x') {
        x1 -= H
        x2 += H
      } else {
        z1 += H
        z2 -= H
      }
      const key = makeWallKey(x1, z1, x2, z2)
      edgeMap.set(key, key)
    }
  }

  return Array.from(edgeMap.keys())
}
