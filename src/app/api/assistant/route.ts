import { NextRequest, NextResponse } from 'next/server'
import { runAssistant } from '@/lib/assistant/gemini'
import type { AssistantRequestMessage, MoodboardResult } from '@/lib/assistant/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const messages = body.messages as AssistantRequestMessage[] | undefined
    const userMessageCount = body.userMessageCount as number | undefined
    const studioMode = body.studioMode as boolean | undefined
    const currentMoodboard = body.currentMoodboard as MoodboardResult | undefined

    if (!messages || !Array.isArray(messages) || typeof userMessageCount !== 'number') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const response = await runAssistant(messages, userMessageCount, {
      studioMode,
      currentMoodboard,
    })
    return NextResponse.json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
