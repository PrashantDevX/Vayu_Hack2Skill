import { z } from 'zod'
import { SOURCE_METADATA } from '../constants/sources'
import type { ChatAnswer } from '../types'
import { fallbackChatAnswer, type ChatContext } from './chatFallback'

export type { ChatContext } from './chatFallback'
export { fallbackChatAnswer } from './chatFallback'

export interface ChatRequest {
  message: string
  context: ChatContext
}

const sourceIds = Object.keys(SOURCE_METADATA) as [keyof typeof SOURCE_METADATA, ...(keyof typeof SOURCE_METADATA)[]]
const chatResponseSchema = z.object({
  source: z.enum(['gemini', 'fallback']),
  answer: z.string().min(1).max(1800),
  sources: z.array(z.enum(sourceIds)).max(5).default([]),
}).strict()

export async function askVayu(request: ChatRequest): Promise<ChatAnswer> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        message: request.message.slice(0, 800),
        location: {
          city: request.context.city,
          aqi: request.context.aqi,
          pm25: request.context.pm25,
        },
        preferences: {
          commute: request.context.profile.commute,
          vulnerable:
            request.context.profile.respiratorySensitivity ||
            request.context.profile.cardiovascularSensitivity ||
            request.context.profile.children > 0 ||
            request.context.profile.elderly > 0,
          budget: request.context.profile.budget,
          roomAreaSqFt: request.context.profile.roomAreaSqFt,
          children: request.context.profile.children,
          elderly: request.context.profile.elderly,
        },
        forecast: {
          category: request.context.category,
          bestWindow: request.context.bestWindow,
          worstWindow: request.context.worstWindow,
        },
      }),
    })

    if (!response.ok) throw new Error(`Assistant unavailable (${response.status})`)
    const raw: unknown = await response.json()
    const parsed = chatResponseSchema.safeParse(raw)
    if (!parsed.success) throw new Error('Assistant returned an unexpected response')
    if (parsed.data.source === 'fallback') {
      return fallbackChatAnswer(request.message, request.context)
    }
    return { answer: parsed.data.answer, sources: parsed.data.sources, source: 'gemini' }
  } catch {
    return fallbackChatAnswer(request.message, request.context)
  }
}
