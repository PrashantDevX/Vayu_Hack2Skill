import { z } from 'zod'
import type { ChatAnswer, Profile } from '../types'

export interface ChatContext {
  city: string
  aqi: number | null
  category: string | null
  pm25: number | null
  bestWindow: string | null
  worstWindow: string | null
  profile: Profile
}

export interface ChatRequest {
  message: string
  context: ChatContext
}

const chatResponseSchema = z.object({
  answer: z.string().min(1).max(4000),
  sources: z.array(z.string().max(300)).max(5).default([]),
})

export function fallbackChatAnswer(question: string, context: ChatContext): ChatAnswer {
  const lower = question.toLowerCase()
  const aqiText = context.aqi === null ? 'the model AQI is unavailable' : `the estimated model AQI is ${context.aqi} (${context.category ?? 'category unavailable'})`
  const windowText = context.bestWindow ? ` The lower-forecast window is ${context.bestWindow}.` : ''
  const sources = ['Open-Meteo CAMS model forecast', 'CPCB AQI methodology', 'General public-health guidance']

  let answer: string
  if (/(run|jog|exercise|workout|cycling)/.test(lower)) {
    answer =
      context.aqi !== null && context.aqi > 200
        ? `With ${aqiText}, avoid strenuous outdoor exercise. Use an indoor session and keep essential outdoor trips short.${windowText} This is general guidance, not medical advice.`
        : `For ${aqiText}, keep outdoor exercise light and choose ${context.bestWindow ?? 'a lower-forecast window'} when possible. Stop if you develop coughing, wheezing or breathlessness.${windowText}`
  } else if (/(purifier|filter|hep|air cleaner|cadr)/.test(lower)) {
    answer = `For a ${context.profile.roomAreaSqFt} sq ft room, choose a certified HEPA purifier whose rated CADR matches the room and a 4–5 air-changes-per-hour target. Check filter replacement costs, place it where air can circulate, and never use ozone-generating devices.${windowText}`
  } else if (/(window|ventilat|open)/.test(lower)) {
    answer =
      context.aqi !== null && context.aqi > 100
        ? `With ${aqiText}, keep windows closed during higher-pollution hours and ventilate briefly during ${context.bestWindow ?? 'a cleaner forecast window'} if indoor sources need clearing. Balance outdoor pollution against cooking and damp sources.${windowText}`
        : `Outdoor levels look relatively moderate. Short, targeted ventilation during ${context.bestWindow ?? 'a lower-forecast window'} is reasonable, especially after cooking.${windowText}`
  } else if (/(child|school|kid|baby)/.test(lower)) {
    answer = `For children, prefer the cleaner travel window ${context.bestWindow ?? 'shown in the hourly forecast'}, keep strenuous outdoor play flexible, and use a well-fitting particulate respirator for essential travel when local guidance recommends it.${windowText} Masks should not replace reducing exposure.`
  } else if (/(metro|bus|car|commute|bike|travel)/.test(lower)) {
    answer = `Public transport, metro and carpooling usually reduce personal transport emissions compared with a solo petrol car. Combine errands and avoid the busiest roadside corridors.${windowText} A mode switch supports cleaner air but does not instantly change city-wide AQI.`
  } else if (/(mask|n95|respirator)/.test(lower)) {
    answer =
      context.aqi !== null && context.aqi > 200
        ? `A well-fitting N95/FFP2 respirator can reduce particulate exposure for essential outdoor travel. Fit matters, and masks do not replace staying indoors or reducing exertion.${windowText}`
        : `A mask is generally not needed for brief outdoor trips at ${aqiText}, but sensitive people may choose one for essential travel. Fit matters more than the label.${windowText}`
  } else if (/(severe|emergency|aqi 400|hazard)/.test(lower)) {
    answer = `For ${aqiText}, keep outdoor time minimal, close windows, run source control or properly sized filtration, and follow local public-health instructions. Seek medical care for severe breathing symptoms.${windowText}`
  } else {
    answer = `For ${aqiText}, prioritise indoor source control, keep outdoor exposure short, and use ${context.bestWindow ?? 'the cleaner forecast window'} for essential trips.${windowText} Ask about exercise, purifiers, windows, school travel or masks for more specific guidance.`
  }

  return {
    answer: `${answer} AI is unavailable right now, so this is Vayu's deterministic guidance based on the current provider data and your saved preferences.`,
    sources,
    source: 'fallback',
  }
}

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
    return { answer: parsed.data.answer, sources: parsed.data.sources, source: 'gemini' }
  } catch {
    return fallbackChatAnswer(request.message, request.context)
  }
}
