import type { AssistantApiResponse, AssistantRequestMessage, MoodboardResult } from './types'

type SendOptions = {
  studioMode?: boolean
  currentMoodboard?: MoodboardResult
}

export async function sendAssistantMessage(
  messages: AssistantRequestMessage[],
  userMessageCount: number,
  options: SendOptions = {}
): Promise<AssistantApiResponse> {
  const res = await fetch('/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, userMessageCount, ...options }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Assistant request failed')
  }

  return res.json()
}
