import type { MoodboardResult, MatchedPaintColor, MoodboardMatchedMaterials } from '@/lib/assistant/types'
import {
  fetchWallColors,
  fetchFloorsForTexture,
  fetchWallpapers,
  type ApiColor,
} from '@/lib/materials/fetch-catalog'
import { findClosestColor, pickBestFloorMaterial } from '@/lib/materials/color-match'
import type { MaterialRef } from '@/lib/store/room-store'

function toMatchedPaint(aiColor: string, product: ApiColor): MatchedPaintColor {
  return {
    aiColor,
    product: {
      id: product.id,
      name: product.name,
      color: product.color,
      source: product.source,
    },
  }
}

function pickWallpaper(
  wallpapers: MaterialRef[],
  wallTexture: MoodboardResult['materials']['wallTexture']
): MaterialRef | undefined {
  if (wallpapers.length === 0) return undefined
  if (wallTexture === 'wallpaper-stripe') {
    return wallpapers.find((w) => /stripe|ზოლი/i.test(w.name)) ?? wallpapers[0]
  }
  if (wallTexture === 'wallpaper-dots') {
    return (
      wallpapers.find((w) => /dot|წერტ|circle/i.test(w.name)) ?? wallpapers[1] ?? wallpapers[0]
    )
  }
  return undefined
}

export async function matchMoodboardMaterials(
  moodboard: MoodboardResult
): Promise<MoodboardMatchedMaterials> {
  const [colors, floorProducts, wallpapers] = await Promise.all([
    fetchWallColors(),
    fetchFloorsForTexture(moodboard.materials.floorTexture),
    moodboard.materials.wallTexture !== 'plain' ? fetchWallpapers() : Promise.resolve([]),
  ])

  const wallMatch = findClosestColor(moodboard.colors.wall, colors)
  const accentMatch = findClosestColor(moodboard.colors.accent, colors)
  const ceilingMatch = findClosestColor(moodboard.colors.ceiling, colors)
  const floorColorHint = findClosestColor(moodboard.colors.floor, colors)

  const floorProduct = floorColorHint
    ? pickBestFloorMaterial(floorProducts, {
        id: floorColorHint.id,
        name: floorColorHint.name,
        color: floorColorHint.color,
        source: floorColorHint.source,
        nameEn: floorColorHint.name_en,
      })
    : floorProducts[0] ?? null

  const wallpaper = pickWallpaper(wallpapers, moodboard.materials.wallTexture)

  const fallbackColor: ApiColor = colors[0] ?? {
    id: 'fallback',
    name: 'თეთრი',
    color: '#FFFFFF',
    source: 'curated',
  }

  return {
    wall: toMatchedPaint(moodboard.colors.wall, wallMatch ?? fallbackColor),
    accent: toMatchedPaint(moodboard.colors.accent, accentMatch ?? fallbackColor),
    ceiling: toMatchedPaint(moodboard.colors.ceiling, ceilingMatch ?? fallbackColor),
    floor: {
      aiColor: moodboard.colors.floor,
      tintColor: floorColorHint?.color ?? moodboard.colors.floor,
      product: floorProduct,
    },
    wallpaper,
  }
}

export async function ensureMoodboardMatched(board: MoodboardResult): Promise<MoodboardResult> {
  if (board.matchedMaterials) return board
  try {
    const matchedMaterials = await matchMoodboardMaterials(board)
    return { ...board, matchedMaterials }
  } catch {
    return board
  }
}
