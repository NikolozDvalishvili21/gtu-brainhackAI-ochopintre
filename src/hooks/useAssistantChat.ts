'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ChatMessage, MoodboardResult } from '@/lib/assistant/types'
import { WELCOME_MESSAGE } from '@/lib/assistant/mock-data'
import { sendAssistantMessage } from '@/lib/assistant/client'
import { loadSession, saveSession } from '@/lib/assistant/session'
import { ensureMoodboardMatched } from '@/lib/materials/match-moodboard'

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

type UseAssistantChatOptions = {
  studioMode?: boolean
  onMoodboardUpdate?: (moodboard: MoodboardResult) => void
  restoreSession?: boolean
}

export function useAssistantChat(options: UseAssistantChatOptions = {}) {
  const { studioMode = false, onMoodboardUpdate, restoreSession = true } = options

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [moodboard, setMoodboard] = useState<MoodboardResult | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [matchingMaterials, setMatchingMaterials] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (!restoreSession || hydrated) return
    const session = loadSession()
    if (session) {
      setMessages(session.messages.length > 0 ? session.messages : [WELCOME_MESSAGE])
      if (session.moodboard) {
        setMatchingMaterials(true)
        ensureMoodboardMatched(session.moodboard)
          .then(setMoodboard)
          .finally(() => setMatchingMaterials(false))
      }
    }
    setHydrated(true)
  }, [restoreSession, hydrated])

  useEffect(() => {
    if (!hydrated) return
    saveSession({ messages, moodboard })
  }, [messages, moodboard, hydrated])

  const userMessageCount = messages.filter((m) => m.role === 'user').length

  const applyMoodboard = useCallback(
    async (board: MoodboardResult) => {
      setMoodboard(board)
      setMatchingMaterials(true)
      try {
        const enriched = await ensureMoodboardMatched(board)
        setMoodboard(enriched)
        onMoodboardUpdate?.(enriched)
      } finally {
        setMatchingMaterials(false)
      }
    },
    [onMoodboardUpdate]
  )

  const handleSend = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim()
      if (!content || loading) return

      const userMsg: ChatMessage = { id: makeId(), role: 'user', content }
      const nextMessages = [...messages, userMsg]
      setMessages(nextMessages)
      setInput('')
      setLoading(true)

      try {
        const apiMessages = nextMessages
          .filter((m) => m.id !== 'welcome')
          .map((m) => ({ role: m.role, content: m.content }))

        const response = await sendAssistantMessage(apiMessages, userMessageCount + 1, {
          studioMode,
          currentMoodboard: moodboard ?? undefined,
        })

        const assistantMsg: ChatMessage = {
          id: makeId(),
          role: 'assistant',
          content: response.message,
          quickReplies: response.type === 'questions' ? response.quickReplies : undefined,
        }

        setMessages((prev) => [...prev, assistantMsg])

        if (response.type === 'moodboard') {
          await applyMoodboard(response.moodboard)
        }
      } catch (err) {
        const errorMsg: ChatMessage = {
          id: makeId(),
          role: 'assistant',
          content:
            err instanceof Error
              ? `შეცდომა: ${err.message}`
              : 'დაფიქსირდა შეცდომა. სცადე თავიდან.',
          quickReplies: ['სცადე თავიდან'],
        }
        setMessages((prev) => [...prev, errorMsg])
      } finally {
        setLoading(false)
      }
    },
    [input, loading, messages, moodboard, applyMoodboard, studioMode, userMessageCount]
  )

  return {
    messages,
    moodboard,
    input,
    loading,
    matchingMaterials,
    setInput,
    handleSend,
    hydrated,
  }
}
