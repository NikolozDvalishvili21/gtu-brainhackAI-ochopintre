// ოთახის ტიპები — 2D იარლიყები + AI ავტო-გაწყობის საფუძველი
export type RoomType =
  | 'living'
  | 'bedroom'
  | 'kitchen'
  | 'dining'
  | 'bathroom'
  | 'office'
  | 'kids'
  | 'hallway'

export const ROOM_TYPES: Record<RoomType, { label: string; icon: string }> = {
  living: { label: 'მისაღები', icon: '🛋️' },
  bedroom: { label: 'საძინებელი', icon: '🛏️' },
  kitchen: { label: 'სამზარეულო', icon: '🍳' },
  dining: { label: 'სასადილო', icon: '🍽️' },
  bathroom: { label: 'სააბაზანო', icon: '🛁' },
  office: { label: 'კაბინეტი', icon: '💻' },
  kids: { label: 'საბავშვო', icon: '🧸' },
  hallway: { label: 'დერეფანი', icon: '🚪' },
}

export const ROOM_TYPE_LIST = (Object.keys(ROOM_TYPES) as RoomType[]).map((type) => ({
  type,
  ...ROOM_TYPES[type],
}))
