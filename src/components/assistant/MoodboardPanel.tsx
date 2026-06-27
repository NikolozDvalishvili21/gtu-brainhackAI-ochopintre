'use client'

import Link from 'next/link'
import type { MoodboardResult } from '@/lib/assistant/types'
import { AiColorSwatches, MatchedMaterialsSection } from './MatchedMaterialsSection'

type MoodboardPanelProps = {
  moodboard: MoodboardResult | null
  loading: boolean
  matchingMaterials?: boolean
  onGoToStudio?: () => void
}

export default function MoodboardPanel({
  moodboard,
  loading,
  matchingMaterials = false,
  onGoToStudio,
}: MoodboardPanelProps) {
  if (loading) {
    return (
      <aside className="flex flex-col border-t border-gray-200 bg-white lg:w-[320px] lg:shrink-0 lg:border-l lg:border-t-0">
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="text-sm text-gray-500">Moodboard იქმნება...</p>
        </div>
      </aside>
    )
  }

  if (!moodboard) {
    return (
      <aside className="flex flex-col border-t border-gray-200 bg-white lg:w-[320px] lg:shrink-0 lg:border-l lg:border-t-0">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Moodboard</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <p className="text-sm text-gray-500">
            აღწერე ოთახი ჩატში — აქ გამოჩნდება შენი ინტერიერის კონცეფტი.
          </p>
        </div>
      </aside>
    )
  }

  const { colors, materials, furniture, roomHint, rooms } = moodboard

  function handleStudioClick() {
    onGoToStudio?.()
  }

  return (
    <aside className="flex max-h-[38dvh] flex-col overflow-hidden border-t border-gray-200 bg-white lg:max-h-none lg:w-[360px] lg:shrink-0 lg:border-l lg:border-t-0">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Moodboard</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="font-display text-lg text-gray-900">{moodboard.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">{moodboard.summary}</p>

        {moodboard.styleTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {moodboard.styleTags.map((tag) => (
              <span
                key={tag}
                className="border border-gray-200 px-2 py-0.5 text-xs text-gray-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <AiColorSwatches colors={colors} />

        <MatchedMaterialsSection
          matched={moodboard.matchedMaterials}
          matching={matchingMaterials}
        />

        <div className="mt-4 space-y-1 text-xs text-gray-600">
          <p>
            <span className="font-medium text-gray-700">კედელი:</span> {materials.wallTexture}
          </p>
          <p>
            <span className="font-medium text-gray-700">იატაკი:</span> {materials.floorTexture}
          </p>
          {rooms && rooms.length > 0 ? (
            <p>
              <span className="font-medium text-gray-700">ოთახები:</span>{' '}
              {rooms.length} ოთახი
            </p>
          ) : roomHint ? (
            <p>
              <span className="font-medium text-gray-700">ზომა:</span> {roomHint.width}×
              {roomHint.height} მ
            </p>
          ) : null}
        </div>

        {rooms && rooms.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              ოთახები
            </p>
            <div className="space-y-2">
              {rooms.map((room, i) => (
                <div key={`${room.label}-${i}`} className="border border-gray-200 p-2">
                  <p className="text-xs font-medium text-gray-800">
                    {room.label}{' '}
                    <span className="font-normal text-gray-500">
                      ({room.width}×{room.height} მ)
                    </span>
                  </p>
                  {(room.furniture?.length ?? 0) > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {room.furniture!.map((item, j) => (
                        <span key={`${item.type}-${j}`} className="text-sm" title={item.label}>
                          {item.icon}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {furniture.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              ავეჯი
            </p>
            <div className="grid grid-cols-2 gap-2">
              {furniture.map((item, i) => (
                <div
                  key={`${item.type}-${i}`}
                  className="flex items-center gap-2 border border-gray-200 p-2"
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-xs text-gray-700">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 p-4">
        <Link
          href="/studio"
          onClick={handleStudioClick}
          className="flex w-full items-center justify-center bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          სტუდიოში გადასვლა
        </Link>
      </div>
    </aside>
  )
}
