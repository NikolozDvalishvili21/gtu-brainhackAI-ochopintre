/** Euclidean distance in RGB space (lower = closer). */
export function colorDistance(hexA: string, hexB: string): number {
  const [r1, g1, b1] = hexToRgb(hexA)
  const [r2, g2, b2] = hexToRgb(hexB)
  return (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  if (h.length !== 6) return [0, 0, 0]
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

export interface ColorMatchCandidate {
  id: string
  name: string
  color: string
  source: string
  nameEn?: string
}

export function findClosestColor<T extends ColorMatchCandidate>(
  targetHex: string,
  candidates: T[]
): T | null {
  if (candidates.length === 0) return null
  let best = candidates[0]
  let bestDist = Infinity
  for (const c of candidates) {
    const d = colorDistance(targetHex, c.color)
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }
  return best
}

import type { MaterialRef } from '@/lib/store/room-store'

/** Score floor material names against a paint color name for best product match. */
export function scoreFloorNameMatch(materialName: string, colorName: string, colorNameEn?: string): number {
  const name = materialName.toLowerCase()
  let score = 0
  const tokens = [
    ...colorName.toLowerCase().split(/[\s(),]+/),
    ...(colorNameEn?.toLowerCase().split(/[\s(),]+/) ?? []),
  ].filter((t) => t.length > 2)

  for (const token of tokens) {
    if (name.includes(token)) score += 2
  }

  const woodHints = ['მუხ', 'oak', 'რცხილ', 'walnut', 'პარკ', 'larix', 'lariks', 'შიშ', 'beech']
  const warmHints = ['warm', 'თბ', 'beige', 'sand', 'cream', 'რძ', 'ქვიშ']
  const coolHints = ['gray', 'grey', 'grey', 'ნაცრ', 'cold', 'cool']

  const target = colorNameEn?.toLowerCase() ?? colorName.toLowerCase()
  if (woodHints.some((h) => target.includes(h) && name.includes(h))) score += 3
  if (warmHints.some((h) => target.includes(h))) {
    if (woodHints.some((h) => name.includes(h))) score += 1
  }
  if (coolHints.some((h) => target.includes(h))) {
    if (name.includes('ნაცრ') || name.includes('gray') || name.includes('grey')) score += 2
  }

  return score
}

export function pickBestFloorMaterial(
  materials: MaterialRef[],
  colorHint: ColorMatchCandidate
): MaterialRef | null {
  if (materials.length === 0) return null
  let best = materials[0]
  let bestScore = -1
  for (const m of materials) {
    let score = scoreFloorNameMatch(m.name, colorHint.name, colorHint.nameEn)
    if (m.image) score += 1
    if (score > bestScore) {
      bestScore = score
      best = m
    }
  }
  return best
}
