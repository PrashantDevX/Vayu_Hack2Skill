/* @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { readJsonBody } from './requestBody'

describe('bounded JSON request reader', () => {
  it('accepts valid JSON within the measured byte limit', async () => {
    const request = new Request('https://vayu.test', { method: 'POST', body: JSON.stringify({ value: 'ok' }) })
    await expect(readJsonBody(request, 20)).resolves.toEqual({ ok: true, value: { value: 'ok' } })
  })

  it('rejects oversized bodies even without Content-Length and malformed UTF-8/JSON', async () => {
    const oversized = new Request('https://vayu.test', { method: 'POST', body: '123456789' })
    await expect(readJsonBody(oversized, 8)).resolves.toEqual({ ok: false, status: 413 })
    const invalid = new Request('https://vayu.test', { method: 'POST', body: '{bad' })
    await expect(readJsonBody(invalid, 10)).resolves.toEqual({ ok: false, status: 400 })
    await expect(readJsonBody(new Request('https://vayu.test'), 10)).resolves.toEqual({ ok: false, status: 400 })
  })
})
