import { GoogleGenerativeAI } from '@google/generative-ai'
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts'
import type { AssistantRequestMessage, MoodboardResult } from './types'
import { parseAssistantResponse } from './parse-response'

type RunAssistantOptions = {
  studioMode?: boolean
  currentMoodboard?: MoodboardResult
}

export async function runAssistant(
  messages: AssistantRequestMessage[],
  userMessageCount: number,
  options: RunAssistantOptions = {}
) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.7,
    },
    systemInstruction: SYSTEM_PROMPT,
  })

  const prompt = buildUserPrompt(messages, userMessageCount, options)
  const result = await model.generateContent(prompt)
  const text = result.response.text()

  return parseAssistantResponse(text)
}
