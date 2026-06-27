export const FURNITURE_ICONS: Record<string, string> = {
  sofa: '🛋️',
  chair: '🪑',
  table: '🪵',
  bed: '🛏️',
  plant: '🌿',
  wardrobe: '🚪',
  desk: '🖥️',
  lamp: '💡',
}

export const VALID_FURNITURE_TYPES = [
  'sofa',
  'chair',
  'table',
  'bed',
  'plant',
  'wardrobe',
  'desk',
  'lamp',
] as const

export type FurnitureType = (typeof VALID_FURNITURE_TYPES)[number]

export const FURNITURE_CATALOG: Record<
  FurnitureType,
  { width: number; depth: number; height: number; color: string; label: string; icon: string }
> = {
  sofa: { width: 2.2, depth: 0.9, height: 0.8, color: '#8B7355', label: 'დივანი', icon: '🛋️' },
  chair: { width: 0.6, depth: 0.6, height: 0.9, color: '#6B5B45', label: 'სავარძელი', icon: '🪑' },
  table: { width: 1.2, depth: 0.7, height: 0.75, color: '#C8A882', label: 'მაგიდა', icon: '🪵' },
  bed: { width: 1.6, depth: 2.1, height: 0.5, color: '#E8DDD0', label: 'საწოლი', icon: '🛏️' },
  plant: { width: 0.4, depth: 0.4, height: 1.0, color: '#2D6A4F', label: 'მცენარე', icon: '🌿' },
  wardrobe: { width: 1.8, depth: 0.6, height: 2.2, color: '#D4B896', label: 'კარადა', icon: '🚪' },
  desk: { width: 1.4, depth: 0.7, height: 0.75, color: '#E8C99A', label: 'წერის მაგიდა', icon: '🖥️' },
  lamp: { width: 0.3, depth: 0.3, height: 1.6, color: '#F5F0EB', label: 'ნათება', icon: '💡' },
}

export const FURNITURE_CATALOG_LIST = VALID_FURNITURE_TYPES.map((type) => ({
  type,
  ...FURNITURE_CATALOG[type],
}))
