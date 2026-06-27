'use client'

import { useCallback, useEffect, useState } from 'react'
import { MessageSquare, ChevronLeft } from 'lucide-react'
import { useAssistantChat } from '@/hooks/useAssistantChat'
import { useRoomStore } from '@/lib/store/room-store'
import { moodboardToStudioPatch } from '@/lib/assistant/map-to-studio'
import { loadSession } from '@/lib/assistant/session'
import ChatPanel from '@/components/assistant/ChatPanel'

export default function StudioAssistantPanel() {
  const hydrateFromBrief = useRoomStore((s) => s.hydrateFromBrief)
  const [open, setOpen] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const applyMoodboard = useCallback(
    (board: Parameters<typeof moodboardToStudioPatch>[0]) => {
      hydrateFromBrief(moodboardToStudioPatch(board))
    },
    [hydrateFromBrief]
  )

  const { messages, input, loading, setInput, handleSend, hydrated } = useAssistantChat({
    studioMode: true,
    onMoodboardUpdate: applyMoodboard,
  })

  useEffect(() => {
    if (!hydrated || initialized) return
    const session = loadSession()
    if (session && session.messages.some((m) => m.role === 'user')) {
      setOpen(true)
    }
    setInitialized(true)
  }, [hydrated, initialized])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-full w-10 shrink-0 flex-col items-center justify-center gap-1 border-r border-gray-200 bg-white text-gray-500 transition-colors hover:bg-surface hover:text-brand"
        title="AI ასისტენტი"
      >
        <MessageSquare size={18} />
        <span className="text-[10px] font-medium [writing-mode:vertical-rl]">AI</span>
      </button>
    )
  }

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <span className="text-xs font-semibold text-gray-700">AI ასისტენტი</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          title="დამალვა"
        >
          <ChevronLeft size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <ChatPanel
          messages={messages}
          input={input}
          loading={loading}
          onInputChange={setInput}
          onSend={handleSend}
          compact
          subtitle="შეცვალე დიზაინი — ცვლილებები სტუდიოში გამოჩნდება"
        />
      </div>
    </aside>
  )
}
