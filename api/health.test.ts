/* @vitest-environment node */
import { afterEach, describe, expect, it } from 'vitest'
import handler from './health'

afterEach(() => {
  delete process.env.GEMINI_API_KEY
  delete process.env.DATA_GOV_IN_API_KEY
  delete process.env.DATA_GOV_IN_RESOURCE_ID
})

describe('GET /api/health', () => {
  it('reports service status without exposing secrets', async () => {
    process.env.GEMINI_API_KEY = 'secret-value'
    process.env.DATA_GOV_IN_API_KEY = 'official-secret'
    process.env.DATA_GOV_IN_RESOURCE_ID = 'resource'
    const response = handler()
    const data = (await response.json()) as {
      status: string
      service: string
      geminiConfigured: boolean
      officialProviderConfigured: boolean
    }
    expect(data.status).toBe('ok')
    expect(data.service).toBe('Vayu')
    expect(data.geminiConfigured).toBe(true)
    expect(data.officialProviderConfigured).toBe(true)
    expect(JSON.stringify(data)).not.toContain('secret-value')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('reports unconfigured providers as false', async () => {
    const data = (await handler().json()) as { geminiConfigured: boolean; officialProviderConfigured: boolean }
    expect(data.geminiConfigured).toBe(false)
    expect(data.officialProviderConfigured).toBe(false)
  })
})
