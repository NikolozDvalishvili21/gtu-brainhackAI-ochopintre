import type { ChatMessage, MoodboardResult } from './types'

const BRIEF_KEY = 'interior-ai-brief'
const SESSION_KEY = 'interior-ai-chat-session'

export interface AssistantSession {
  messages: ChatMessage[]
  moodboard: MoodboardResult | null
}

export function saveBrief(moodboard: MoodboardResult): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(BRIEF_KEY, JSON.stringify(moodboard))
}

export function loadBrief(): MoodboardResult | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(BRIEF_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as MoodboardResult
  } catch {
    return null
  }
}

export function clearBrief(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(BRIEF_KEY)
}

export function saveSession(session: AssistantSession): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function loadSession(): AssistantSession | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AssistantSession
  } catch {
    return null
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(SESSION_KEY)
}
