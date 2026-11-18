import { withVercelRuntime } from './lib/adapter.js'

export const config = { runtime: 'nodejs' }

function handler() {
  return Response.json(
    {
      status: 'ok',
      service: 'Vayu',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      officialProviderConfigured: Boolean(
        process.env.DATA_GOV_IN_API_KEY && process.env.DATA_GOV_IN_RESOURCE_ID,
      ),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export default withVercelRuntime(handler)
