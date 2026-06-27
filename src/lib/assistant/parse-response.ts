import {
  FURNITURE_CATALOG,
  FURNITURE_ICONS,
  VALID_FURNITURE_TYPES,
} from '@/lib/constants/furniture-catalog'
import type {
  AssistantApiResponse,
  MoodboardFurniture,
  MoodboardResult,
  MoodboardRoom,
} from './types'

const HEX_RE = /^#[0-9A-Fa-f]{6}$/

function isValidHex(color: unknown): color is string {
  return typeof color === 'string' && HEX_RE.test(color)
}

function clampDim(n: unknown, fallback: number): number {
  const v = typeof n === 'number' ? n : fallback
  return Math.min(20, Math.max(2, v))
}

const VALID_WALL_TEXTURES = ['plain', 'wallpaper-stripe', 'wallpaper-dots'] as const
const VALID_FLOOR_TEXTURES = ['parquet', 'tile', 'plain'] as const
const VALID_PLACEMENTS = ['back', 'front', 'left', 'right', 'center', 'corner'] as const
const VALID_ATTACH_SIDES = ['right', 'bottom', 'left', 'top'] as const

function normalizeFurnitureItem(f: Record<string, unknown>): MoodboardFurniture {
  const type = VALID_FURNITURE_TYPES.includes(f.type as (typeof VALID_FURNITURE_TYPES)[number])
    ? (f.type as string)
    : 'chair'
  const catalog = FURNITURE_CATALOG[type as keyof typeof FURNITURE_CATALOG]
  const placement = VALID_PLACEMENTS.includes(f.placement as (typeof VALID_PLACEMENTS)[number])
    ? (f.placement as MoodboardFurniture['placement'])
    : undefined
  const roomIndex =
    typeof f.roomIndex === 'number' && f.roomIndex >= 0 ? Math.floor(f.roomIndex) : undefined

  return {
    type,
    label: typeof f.label === 'string' ? f.label : catalog.label,
    icon: FURNITURE_ICONS[type] ?? '🪑',
    placement,
    roomIndex,
  }
}

function normalizeFurnitureList(raw: unknown): MoodboardFurniture[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((f): f is Record<string, unknown> => f !== null && typeof f === 'object')
    .map(normalizeFurnitureItem)
}

function normalizeRoom(raw: Record<string, unknown>, index: number): MoodboardRoom {
  const attachSide = VALID_ATTACH_SIDES.includes(
    raw.attachSide as (typeof VALID_ATTACH_SIDES)[number]
  )
    ? (raw.attachSide as MoodboardRoom['attachSide'])
    : undefined

  return {
    label: typeof raw.label === 'string' ? raw.label : `ოთახი ${index + 1}`,
    width: clampDim(raw.width, 4),
    height: clampDim(raw.height, 4),
    x: typeof raw.x === 'number' ? raw.x : undefined,
    y: typeof raw.y === 'number' ? raw.y : undefined,
    attachSide,
    attachToIndex:
      typeof raw.attachToIndex === 'number' ? Math.max(0, Math.floor(raw.attachToIndex)) : undefined,
    furniture: normalizeFurnitureList(raw.furniture),
  }
}

function fallbackQuestions(): AssistantApiResponse {
  return {
    type: 'questions',
    message: 'გთხოვ, უფრო დეტალურად აღწერე — რა სტილი, ფერები და ოთახის ზომა გინდა?',
    quickReplies: ['მინიმალისტური', 'თბილი ტონები', '6×5 მეტრი'],
  }
}

function normalizeMoodboard(raw: Record<string, unknown>): MoodboardResult {
  const colors = (raw.colors ?? {}) as Record<string, unknown>
  const materials = (raw.materials ?? {}) as Record<string, unknown>
  const roomHint = raw.roomHint as { width?: number; height?: number } | undefined
  const roomsRaw = Array.isArray(raw.rooms) ? raw.rooms : []

  let rooms: MoodboardRoom[] | undefined
  if (roomsRaw.length > 0) {
    rooms = roomsRaw
      .filter((r): r is Record<string, unknown> => r !== null && typeof r === 'object')
      .slice(0, 6)
      .map((r, i) => normalizeRoom(r, i))
  }

  const furniture = normalizeFurnitureList(raw.furniture)

  // Assign top-level furniture with roomIndex to per-room lists when using multi-room
  if (rooms && rooms.length > 0 && furniture.length > 0) {
    furniture.forEach((item) => {
      const idx = item.roomIndex ?? 0
      if (idx < rooms!.length) {
        const { roomIndex: _, ...rest } = item
        rooms![idx].furniture = [...(rooms![idx].furniture ?? []), rest]
      }
    })
  }

  const wallTexture = VALID_WALL_TEXTURES.includes(
    materials.wallTexture as (typeof VALID_WALL_TEXTURES)[number]
  )
    ? (materials.wallTexture as MoodboardResult['materials']['wallTexture'])
    : 'plain'

  const floorTexture = VALID_FLOOR_TEXTURES.includes(
    materials.floorTexture as (typeof VALID_FLOOR_TEXTURES)[number]
  )
    ? (materials.floorTexture as MoodboardResult['materials']['floorTexture'])
    : 'parquet'

  return {
    title: typeof raw.title === 'string' ? raw.title : 'ინტერიერის კონცეფტი',
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    styleTags: Array.isArray(raw.styleTags)
      ? raw.styleTags.filter((t): t is string => typeof t === 'string').slice(0, 4)
      : [],
    colors: {
      wall: isValidHex(colors.wall) ? colors.wall : '#F5F0EB',
      accent: isValidHex(colors.accent) ? colors.accent : '#2D6A4F',
      floor: isValidHex(colors.floor) ? colors.floor : '#C8A882',
      ceiling: isValidHex(colors.ceiling) ? colors.ceiling : '#FFFFFF',
    },
    materials: { wallTexture, floorTexture },
    rooms,
    furniture: rooms ? [] : furniture,
    roomHint:
      !rooms && roomHint
        ? {
            width: clampDim(roomHint.width, 6),
            height: clampDim(roomHint.height, 5),
          }
        : !rooms
          ? { width: 6, height: 5 }
          : undefined,
  }
}

export function parseAssistantResponse(text: string): AssistantApiResponse {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>

    if (parsed.type === 'moodboard' && parsed.moodboard) {
      return {
        type: 'moodboard',
        message: typeof parsed.message === 'string' ? parsed.message : 'აი შენი moodboard!',
        moodboard: normalizeMoodboard(parsed.moodboard as Record<string, unknown>),
      }
    }

    if (parsed.type === 'questions' || parsed.quickReplies) {
      const quickReplies = Array.isArray(parsed.quickReplies)
        ? parsed.quickReplies.filter((q): q is string => typeof q === 'string').slice(0, 4)
        : ['მინიმალისტური', 'თბილი ტონები']
      return {
        type: 'questions',
        message:
          typeof parsed.message === 'string'
            ? parsed.message
            : 'გთხოვ, მეტი დეტალი მომაწოდე ოთახის შესახებ.',
        quickReplies: quickReplies.length >= 2 ? quickReplies : ['მცირე ოთახი', 'დიდი ოთახი'],
      }
    }

    return fallbackQuestions()
  } catch {
    return fallbackQuestions()
  }
}
