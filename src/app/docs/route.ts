import { ApiReference } from '@scalar/nextjs-api-reference'
import { buildOpenApiSpec } from '@/lib/openapi/spec'

const scalarHandler = ApiReference({
  pageTitle: 'Finance Tracker API Docs',
  theme: 'kepler',
  sources: [
    {
      content: buildOpenApiSpec() as unknown as Record<string, unknown>,
    },
  ],
  agent: { disabled: true },
})

const BANNER_HEIGHT = '37px'

const DASHBOARD_BANNER = `
<style>
  :root { --scalar-custom-header-height: ${BANNER_HEIGHT}; }
  body { padding-top: ${BANNER_HEIGHT} !important; }
  #ft-back-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    background: #18181b;
    border-bottom: 1px solid #3f3f46;
    padding: 8px 16px;
  }
  #ft-back-banner a {
    color: #e4e4e7;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    letter-spacing: 0.01em;
  }
  #ft-back-banner a:hover { color: #fff; }
</style>
<div id="ft-back-banner">
  <a href="/dashboard">&#8592; Back to Dashboard</a>
</div>`

export async function GET() {
  const response = scalarHandler()
  const html = await response.text()
  return new Response(html.replace('</body>', `${DASHBOARD_BANNER}</body>`), {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  })
}
