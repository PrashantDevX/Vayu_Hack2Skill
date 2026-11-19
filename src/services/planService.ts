import { z } from 'zod'
import type { AiBrief, PlannerResult, Profile } from '../types'
import type { ChatContext } from './chatService'
import { SOURCE_METADATA, type SourceId } from '../constants/sources'

const briefSchema = z.object({
  source: z.enum(['gemini', 'unavailable']),
  greeting: z.string().max(200).nullable().optional(),
  sections: z
    .array(z.object({ title: z.string().min(1).max(80), guidance: z.string().min(10).max(700) }))
    .max(8)
    .default([]),
  sources: z.array(z.enum(Object.keys(SOURCE_METADATA) as [SourceId, ...SourceId[]])).max(5).default([]),
  reason: z.string().max(300).nullable().optional(),
})

export interface PlanRequest {
  context: ChatContext
  profile: Profile
  planner: PlannerResult
}

export async function requestAiBrief(request: PlanRequest): Promise<AiBrief> {
  const unavailable = (reason: string): AiBrief => ({
    source: 'unavailable',
    greeting: null,
    sections: [],
    sources: [],
    reason,
  })

  try {
    const response = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        location: {
          city: request.context.city,
          aqi: request.context.aqi,
          category: request.context.category,
          pm25: request.context.pm25,
        },
        windows: {
          best: request.planner.bestWindow,
          worst: request.planner.worstWindow,
        },
        profile: {
          adults: request.profile.adults,
          children: request.profile.children,
          elderly: request.profile.elderly,
          outdoorWorker: request.profile.outdoorWorker,
          vulnerable: request.profile.respiratorySensitivity || request.profile.cardiovascularSensitivity,
          commute: request.profile.commute,
          budget: request.profile.budget,
          hasPurifier: request.profile.hasPurifier,
          roomAreaSqFt: request.profile.roomAreaSqFt,
        },
      }),
    })

    if (!response.ok) throw new Error(`Plan service unavailable (${response.status})`)
    const raw: unknown = await response.json()
    const parsed = briefSchema.safeParse(raw)
    if (!parsed.success) throw new Error('Plan service returned an unexpected response')
    const data = parsed.data
    if (data.source === 'unavailable' || data.sections.length === 0) {
      return unavailable(data.reason ?? 'AI brief is unavailable.')
    }
    return {
      source: 'gemini',
      greeting: data.greeting ?? null,
      sections: data.sections.map(section => ({ title: section.title, guidance: section.guidance })),
      sources: data.sources,
      reason: null,
    }
  } catch {
    return unavailable('AI brief is unavailable, so the deterministic plan remains active.')
  }
}
