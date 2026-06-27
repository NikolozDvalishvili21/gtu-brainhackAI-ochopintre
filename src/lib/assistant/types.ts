export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  quickReplies?: string[]
}

export interface MoodboardFurniture {
  type: string
  label: string
  icon: string
  placement?: 'back' | 'front' | 'left' | 'right' | 'center' | 'corner'
  roomIndex?: number
}

export interface MoodboardRoom {
  label: string
  width: number
  height: number
  x?: number
  y?: number
  attachSide?: 'right' | 'bottom' | 'left' | 'top'
  attachToIndex?: number
  furniture?: MoodboardFurniture[]
}

export interface MoodboardResult {
  title: string
  summary: string
  styleTags: string[]
  colors: {
    wall: string
    accent: string
    floor: string
    ceiling: string
  }
  materials: {
    wallTexture: 'plain' | 'wallpaper-stripe' | 'wallpaper-dots'
    floorTexture: 'parquet' | 'tile' | 'plain'
  }
  /** Multiple rooms — preferred for apartments / multi-room layouts */
  rooms?: MoodboardRoom[]
  /** Legacy single-room hint */
  roomHint?: { width: number; height: number }
  /** Furniture for single-room layouts (use rooms[].furniture for multi-room) */
  furniture: MoodboardFurniture[]
  /** Closest matches from materials API (filled after moodboard is generated) */
  matchedMaterials?: MoodboardMatchedMaterials
}

export interface MatchedPaintColor {
  aiColor: string
  product: {
    id: string
    name: string
    color: string
    source: string
  }
}

export interface MatchedFloorProduct {
  aiColor: string
  tintColor: string
  product: import('@/lib/store/room-store').MaterialRef | null
}

export interface MoodboardMatchedMaterials {
  wall: MatchedPaintColor
  accent: MatchedPaintColor
  ceiling: MatchedPaintColor
  floor: MatchedFloorProduct
  wallpaper?: import('@/lib/store/room-store').MaterialRef
}

export type AssistantApiResponse =
  | { type: 'questions'; message: string; quickReplies: string[] }
  | { type: 'moodboard'; message: string; moodboard: MoodboardResult }

export interface AssistantRequestMessage {
  role: 'user' | 'assistant'
  content: string
}
