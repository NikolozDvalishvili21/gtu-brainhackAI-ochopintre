'use client'

import { useEffect, useRef } from 'react'
import type { ChatMessage as ChatMessageType } from '@/lib/assistant/types'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import QuickReplies from './QuickReplies'

type ChatPanelProps = {
  messages: ChatMessageType[]
  input: string
  loading: boolean
  onInputChange: (value: string) => void
  onSend: (text?: string) => void
  compact?: boolean
  subtitle?: string
}

export default function ChatPanel({
  messages,
  input,
  loading,
  onInputChange,
  onSend,
  compact = false,
  subtitle = 'აღწერე ოთახი — შევქმნით moodboard-ს',
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const quickReplies = lastAssistant?.quickReplies ?? []

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  return (
    <section
      className={`flex min-h-0 flex-col bg-surface ${compact ? 'h-full' : 'flex-1 lg:min-w-0'}`}
    >
      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-sm font-semibold text-gray-900">AI ასისტენტი</h1>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>

      <div
        ref={scrollRef}
        className={`flex-1 space-y-3 overflow-y-auto p-4 ${compact ? 'min-h-0' : ''}`}
      >
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-500">
              ვფიქრობ...
            </div>
          </div>
        )}
      </div>

      <QuickReplies
        replies={quickReplies}
        onSelect={(reply) => onSend(reply)}
        disabled={loading}
      />
      <ChatInput
        value={input}
        onChange={onInputChange}
        onSend={() => onSend()}
        disabled={loading}
      />
    </section>
  )
}
