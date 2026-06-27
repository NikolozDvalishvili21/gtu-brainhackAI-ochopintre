export const MATERIALS_API_BASE = 'https://interior-materials-api.onrender.com'

export const MARKET_LABELS: Record<string, string> = {
  nova: 'Nova',
  domino: 'Domino',
  curated: 'კატალოგი',
}

export function marketLabel(source?: string): string {
  if (!source) return '—'
  return MARKET_LABELS[source] ?? source
}

export function marketBadgeClass(source?: string): string {
  switch (source) {
    case 'nova':
      return 'bg-emerald-100 text-emerald-700'
    case 'domino':
      return 'bg-sky-100 text-sky-700'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}
