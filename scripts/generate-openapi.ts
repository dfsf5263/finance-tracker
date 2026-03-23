import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildOpenApiSpec } from '../src/lib/openapi/spec'

const __dirname = dirname(fileURLToPath(import.meta.url))
const spec = buildOpenApiSpec()
const outPath = resolve(__dirname, '..', 'public', 'openapi.json')
writeFileSync(outPath, JSON.stringify(spec, null, 2) + '\n')
console.log(`OpenAPI spec written to ${outPath}`)
