'use client'

import { marketBadgeClass, marketLabel } from '@/lib/constants/materials-api'
import type { MatchedPaintColor, MatchedFloorProduct } from '@/lib/assistant/types'

function PaintMatchRow({
  label,
  match,
}: {
  label: string
  match: MatchedPaintColor
}) {
  return (
    <div className="border border-gray-200 p-2">
      <p className="mb-2 text-xs font-medium text-gray-700">{label}</p>
      <div className="flex items-center gap-2">
        <div className="text-center">
          <div
            className="h-9 w-9 border border-gray-200"
            style={{ background: match.aiColor }}
            title="AI ფერი"
          />
          <span className="mt-0.5 block text-[9px] text-gray-400">AI</span>
        </div>
        <span className="text-gray-300">→</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div
              className="h-9 w-9 shrink-0 border border-gray-200"
              style={{ background: match.product.color }}
            />
            <div className="min-w-0">
              <p className="truncate text-xs text-gray-800">{match.product.name}</p>
              <span
                className={`mt-0.5 inline-block px-1.5 py-0.5 text-[10px] font-medium ${marketBadgeClass(match.product.source)}`}
              >
                {marketLabel(match.product.source)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FloorMatchRow({ match }: { match: MatchedFloorProduct }) {
  const product = match.product
  return (
    <div className="border border-gray-200 p-2">
      <p className="mb-2 text-xs font-medium text-gray-700">იატაკი / პარკეტი</p>
      <div className="flex items-center gap-2">
        <div className="text-center">
          <div
            className="h-9 w-9 border border-gray-200"
            style={{ background: match.aiColor }}
            title="AI ფერი"
          />
          <span className="mt-0.5 block text-[9px] text-gray-400">AI</span>
        </div>
        <span className="text-gray-300">→</span>
        {product ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="h-9 w-9 shrink-0 border border-gray-200 object-cover"
              />
            ) : (
              <div
                className="h-9 w-9 shrink-0 border border-gray-200"
                style={{ background: match.tintColor }}
              />
            )}
            <div className="min-w-0">
              <p className="line-clamp-2 text-xs text-gray-800">{product.name}</p>
              <span
                className={`mt-0.5 inline-block px-1.5 py-0.5 text-[10px] font-medium ${marketBadgeClass(product.source)}`}
              >
                {marketLabel(product.source)}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500">პროდუქტი ვერ მოიძებნა</p>
        )}
      </div>
    </div>
  )
}

export function MatchedMaterialsSection({
  matched,
  matching,
}: {
  matched?: import('@/lib/assistant/types').MoodboardMatchedMaterials
  matching?: boolean
}) {
  if (matching) {
    return (
      <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        მასალების ძებნა კატალოგში...
      </div>
    )
  }

  if (!matched) return null

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        კატალოგის შესაბამისობა
      </p>
      <PaintMatchRow label="კედელი" match={matched.wall} />
      <PaintMatchRow label="ფოკუსი" match={matched.accent} />
      <PaintMatchRow label="ჭერი" match={matched.ceiling} />
      <FloorMatchRow match={matched.floor} />
      {matched.wallpaper && (
        <div className="border border-gray-200 p-2">
          <p className="mb-2 text-xs font-medium text-gray-700">შპალერი</p>
          <div className="flex items-center gap-2">
            {matched.wallpaper.image && (
              <img
                src={matched.wallpaper.image}
                alt={matched.wallpaper.name}
                className="h-9 w-9 shrink-0 border border-gray-200 object-cover"
              />
            )}
            <div className="min-w-0">
              <p className="line-clamp-2 text-xs text-gray-800">{matched.wallpaper.name}</p>
              <span
                className={`mt-0.5 inline-block px-1.5 py-0.5 text-[10px] font-medium ${marketBadgeClass(matched.wallpaper.source)}`}
              >
                {marketLabel(matched.wallpaper.source)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function AiColorSwatches({
  colors,
}: {
  colors: { wall: string; accent: string; floor: string; ceiling: string }
}) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        AI ფერები
      </p>
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'კედელი', color: colors.wall },
          { label: 'ფოკუსი', color: colors.accent },
          { label: 'იატაკი', color: colors.floor },
          { label: 'ჭერი', color: colors.ceiling },
        ].map((swatch) => (
          <div key={swatch.label} className="text-center">
            <div
              className="mx-auto h-10 w-10 border border-gray-200"
              style={{ background: swatch.color }}
            />
            <span className="mt-1 block text-[10px] text-gray-500">{swatch.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
