import { describe, it, expect } from 'vitest'

import { buildOpenApiSpec } from './spec'

const spec = buildOpenApiSpec()

describe('buildOpenApiSpec', () => {
  it('returns OpenAPI 3.1.0', () => {
    expect(spec.openapi).toBe('3.1.0')
  })

  it('has correct info block', () => {
    expect(spec.info.title).toBe('Finance Tracker API')
    expect(spec.info.version).toBe('1.4.0')
    expect(spec.info.description).toContain('REST API')
  })

  it('defines both security schemes', () => {
    const schemes = spec.components?.securitySchemes ?? {}
    expect(schemes).toHaveProperty('cookieAuth')
    expect(schemes).toHaveProperty('apiKeyAuth')
  })

  it('defines shared component schemas', () => {
    const schemas = spec.components?.schemas ?? {}
    expect(schemas).toHaveProperty('Pagination')
    expect(schemas).toHaveProperty('ErrorResponse')
    expect(schemas).toHaveProperty('Transaction')
  })

  it('includes all 36 API paths', () => {
    const pathKeys = Object.keys(spec.paths ?? {})
    expect(pathKeys).toHaveLength(36)
  })

  it('includes critical route paths', () => {
    const paths = spec.paths ?? {}
    expect(paths).toHaveProperty('/api/health')
    expect(paths).toHaveProperty('/api/households')
    expect(paths).toHaveProperty('/api/transactions')
    expect(paths).toHaveProperty('/api/accounts')
    expect(paths).toHaveProperty('/api/categories')
    expect(paths).toHaveProperty('/api/types')
    expect(paths).toHaveProperty('/api/users')
    expect(paths).toHaveProperty('/api/households/{id}/invitations')
  })

  it('marks health endpoint as public (no security)', () => {
    const healthGet = (spec.paths as Record<string, Record<string, unknown>>)['/api/health']
      ?.get as Record<string, unknown>
    expect(healthGet?.security).toEqual([])
  })

  it('every operation has an operationId', () => {
    const methods = ['get', 'post', 'put', 'patch', 'delete'] as const
    for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
      for (const method of methods) {
        const op = (pathItem as Record<string, Record<string, unknown>>)[method]
        if (op) {
          expect(op.operationId, `${method.toUpperCase()} ${path} missing operationId`).toBeTruthy()
        }
      }
    }
  })

  it('every operation has at least one response', () => {
    const methods = ['get', 'post', 'put', 'patch', 'delete'] as const
    for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
      for (const method of methods) {
        const op = (pathItem as Record<string, Record<string, unknown>>)[method]
        if (op) {
          const responses = op.responses as Record<string, unknown> | undefined
          expect(
            responses && Object.keys(responses).length > 0,
            `${method.toUpperCase()} ${path} has no responses`
          ).toBe(true)
        }
      }
    }
  })

  it('defines all 11 tags', () => {
    expect(spec.tags).toHaveLength(11)
    const names = (spec.tags ?? []).map((t: { name: string }) => t.name)
    expect(names).toContain('Health')
    expect(names).toContain('Transactions')
    expect(names).toContain('Budgets')
  })

  it('operationIds are unique', () => {
    const methods = ['get', 'post', 'put', 'patch', 'delete'] as const
    const ids: string[] = []
    for (const pathItem of Object.values(spec.paths ?? {})) {
      for (const method of methods) {
        const op = (pathItem as Record<string, Record<string, unknown>>)[method]
        if (op?.operationId) {
          ids.push(op.operationId as string)
        }
      }
    }
    expect(new Set(ids).size).toBe(ids.length)
  })
})
