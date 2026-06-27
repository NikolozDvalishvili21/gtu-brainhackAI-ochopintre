import { MATERIALS_API_BASE } from '@/lib/constants/materials-api'
import type { MaterialRef } from '@/lib/store/room-store'

export interface ApiColor {
  id: string
  name: string
  name_en?: string
  color: string
  source: string
  category?: string
}

interface ApiMaterialItem {
  id: string
  name: string
  image: string
  price: number | null
  currency: string | null
  unit: string | null
  category: string
  source?: string
  url?: string | null
  dimensions?: string | null
}

interface MaterialsPage {
  items: ApiMaterialItem[]
}

let colorsCache: ApiColor[] | null = null
let laminateCache: MaterialRef[] | null = null
let tileCache: MaterialRef[] | null = null
let wallpaperCache: MaterialRef[] | null = null

function toMaterialRef(m: ApiMaterialItem): MaterialRef {
  return {
    id: m.id,
    name: m.name,
    image: m.image,
    price: m.price,
    currency: m.currency,
    unit: m.unit,
    category: m.category,
    source: m.source,
    url: m.url,
    dimensions: m.dimensions,
  }
}

export async function fetchWallColors(): Promise<ApiColor[]> {
  if (colorsCache) return colorsCache
  const res = await fetch(`${MATERIALS_API_BASE}/colors`)
  if (!res.ok) throw new Error('Failed to fetch wall colors')
  const data = (await res.json()) as ApiColor[]
  colorsCache = data
  return data
}

async function fetchMaterialCategory(category: string, limit = 48): Promise<MaterialRef[]> {
  const res = await fetch(`${MATERIALS_API_BASE}/materials?category=${encodeURIComponent(category)}&limit=${limit}`)
  if (!res.ok) return []
  const data = (await res.json()) as MaterialsPage
  return (data.items ?? []).filter((m) => m.image).map(toMaterialRef)
}

export async function fetchLaminateFloors(): Promise<MaterialRef[]> {
  if (laminateCache) return laminateCache
  const [a, b] = await Promise.all([
    fetchMaterialCategory('floor-coverings/laminate-flooring', 48),
    fetchMaterialCategory('iatakis-da-kedlis-filebi', 24),
  ])
  laminateCache = [...a, ...b]
  return laminateCache
}

export async function fetchTileFloors(): Promise<MaterialRef[]> {
  if (tileCache) return tileCache
  tileCache = await fetchMaterialCategory('iatakis-da-kedlis-filebi', 48)
  return tileCache
}

export async function fetchWallpapers(): Promise<MaterialRef[]> {
  if (wallpaperCache) return wallpaperCache
  wallpaperCache = await fetchMaterialCategory('wallpaper', 48)
  return wallpaperCache
}

export async function fetchFloorsForTexture(
  floorTexture: 'parquet' | 'tile' | 'plain'
): Promise<MaterialRef[]> {
  if (floorTexture === 'tile') return fetchTileFloors()
  return fetchLaminateFloors()
}

export function clearMaterialsCache() {
  colorsCache = null
  laminateCache = null
  tileCache = null
  wallpaperCache = null
}
