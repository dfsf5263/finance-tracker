import { z } from 'zod'
import { createDocument } from 'zod-openapi'

import {
  transactionCreateSchema,
  transactionUpdateSchema,
  householdCreateSchema,
  householdUpdateSchema,
  accountCreateSchema,
  accountUpdateSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  typeCreateSchema,
  typeUpdateSchema,
} from '@/lib/validation'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })

const jsonContent = (schema: z.ZodType | Record<string, unknown>) => ({
  'application/json': { schema },
})

const jsonResponse = (description: string, schema: z.ZodType | Record<string, unknown>) => ({
  description,
  content: jsonContent(schema),
})

const errorResponse = (description: string) => ({
  description,
  content: jsonContent(ref('ErrorResponse')),
})

const paginatedResponse = (description: string, itemsRef: string) =>
  jsonResponse(description, {
    type: 'object' as const,
    properties: {
      transactions: { type: 'array' as const, items: { $ref: `#/components/schemas/${itemsRef}` } },
      pagination: { $ref: '#/components/schemas/Pagination' },
    },
  })

const authResponses = {
  401: errorResponse('Unauthorized — session or API key required'),
  403: errorResponse('Forbidden — insufficient permissions'),
}

const householdIdParam = {
  name: 'id',
  in: 'path' as const,
  required: true,
  schema: { type: 'string' as const, format: 'uuid' },
  description: 'Household ID',
}

const householdIdQuery = {
  name: 'householdId',
  in: 'query' as const,
  required: true,
  schema: { type: 'string' as const, format: 'uuid' },
  description: 'Household ID',
}

const tags = [
  { name: 'Health', description: 'Service health check' },
  { name: 'Households', description: 'Household management' },
  { name: 'Accounts', description: 'Household financial accounts' },
  { name: 'Transactions', description: 'Financial transactions' },
  { name: 'Categories', description: 'Transaction categories' },
  { name: 'Types', description: 'Transaction types (inflow / outflow)' },
  { name: 'Users', description: 'Household users (budgeting personas)' },
  { name: 'Budgets', description: 'Budget analytics' },
  { name: 'Invitations', description: 'Household membership invitations' },
  { name: 'Email', description: 'Email and notification triggers' },
  { name: 'Auth Users', description: 'Authenticated user profile' },
]

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function buildOpenApiSpec() {
  return createDocument({
    openapi: '3.1.0',
    info: {
      title: 'Finance Tracker API',
      version: '1.4.0',
      description: [
        'REST API for the Finance Tracker application.',
        '',
        '## Authentication',
        '',
        'All endpoints (except `/api/health` and invitation lookup) require authentication via one of:',
        '',
        '- **Session cookie** — automatically set after login at `/api/auth/sign-in/email`',
        '- **API key** — pass your key in the `x-api-key` header (prefix: `ft_`)',
        '',
        '## RBAC Roles',
        '',
        'Household members have one of three roles:',
        '',
        '| Role | Data | Invite | Settings | Delete |',
        '|------|------|--------|----------|--------|',
        '| **OWNER** | Read/Write | Yes | Yes | Yes |',
        '| **MEMBER** | Read/Write | No | No | No |',
        '| **VIEWER** | Read only | No | No | No |',
        '',
        '## Rate Limiting',
        '',
        'API keys are limited to **1 000 requests per day**. Session-based requests',
        'are subject to the server-wide rate limiter.',
      ].join('\n'),
      license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
    },
    servers: [{ url: '/', description: 'Current server' }],
    tags,
    security: [{ cookieAuth: [] }, { apiKeyAuth: [] }],

    // -------------------------------------------------------------------
    // Components
    // -------------------------------------------------------------------
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'better-auth.session_token',
          description: 'Session cookie set after login',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'API key with ft_ prefix',
        },
      },
      schemas: {
        // — Shared —
        ErrorResponse: {
          type: 'object',
          properties: { error: { type: 'string' } },
          required: ['error'],
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            accountId: { type: 'string', format: 'uuid' },
            userId: { type: ['string', 'null'], format: 'uuid' },
            transactionDate: { type: 'string', format: 'date-time' },
            postDate: { type: 'string', format: 'date-time' },
            description: { type: 'string' },
            categoryId: { type: 'string', format: 'uuid' },
            typeId: { type: 'string', format: 'uuid' },
            amount: { type: 'number' },
            memo: { type: ['string', 'null'] },
            householdId: { type: 'string', format: 'uuid' },
            account: {
              type: 'object',
              properties: { id: { type: 'string' }, name: { type: 'string' } },
            },
            user: {
              type: ['object', 'null'],
              properties: { id: { type: 'string' }, name: { type: 'string' } },
            },
            category: {
              type: 'object',
              properties: { id: { type: 'string' }, name: { type: 'string' } },
            },
            type: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                isOutflow: { type: 'boolean' },
              },
            },
          },
        },
      },
    },

    // -------------------------------------------------------------------
    // Paths
    // -------------------------------------------------------------------
    paths: {
      // ======================== HEALTH ========================
      '/api/health': {
        get: {
          operationId: 'getHealth',
          tags: ['Health'],
          summary: 'Service health check',
          security: [],
          responses: {
            200: jsonResponse(
              'Service is healthy',
              z.object({
                status: z.literal('healthy'),
                timestamp: z.string(),
                database: z.literal('connected'),
                service: z.string(),
                version: z.string(),
              })
            ),
            503: jsonResponse(
              'Service is unhealthy',
              z.object({
                status: z.literal('unhealthy'),
                timestamp: z.string(),
                database: z.literal('disconnected'),
                service: z.string(),
                version: z.string(),
              })
            ),
          },
        },
      },

      // ======================== HOUSEHOLDS ========================
      '/api/households': {
        get: {
          operationId: 'listHouseholds',
          tags: ['Households'],
          summary: 'List households for the current user',
          responses: {
            200: jsonResponse(
              'Array of households with role and counts',
              z.array(
                z.object({
                  id: z.uuidv4(),
                  name: z.string(),
                  annualBudget: z.number().nullable(),
                  userRole: z.string(),
                  _count: z.object({
                    accounts: z.number(),
                    users: z.number(),
                    categories: z.number(),
                    types: z.number(),
                  }),
                })
              )
            ),
            ...authResponses,
          },
        },
        post: {
          operationId: 'createHousehold',
          tags: ['Households'],
          summary: 'Create a new household',
          requestBody: {
            required: true,
            content: jsonContent(householdCreateSchema),
          },
          responses: {
            201: jsonResponse(
              'Created household',
              z.object({
                id: z.uuidv4(),
                name: z.string(),
                annualBudget: z.number().nullable(),
                userRole: z.literal('OWNER'),
              })
            ),
            400: errorResponse('Validation error'),
            ...authResponses,
          },
        },
      },

      '/api/households/{id}': {
        get: {
          operationId: 'getHousehold',
          tags: ['Households'],
          summary: 'Get household details',
          parameters: [householdIdParam],
          responses: {
            200: jsonResponse(
              'Household with counts',
              z.object({
                id: z.uuidv4(),
                name: z.string(),
                annualBudget: z.number().nullable(),
                _count: z.object({
                  accounts: z.number(),
                  users: z.number(),
                  categories: z.number(),
                  types: z.number(),
                }),
              })
            ),
            ...authResponses,
          },
        },
        put: {
          operationId: 'updateHousehold',
          tags: ['Households'],
          summary: 'Update a household (OWNER only)',
          parameters: [householdIdParam],
          requestBody: { required: true, content: jsonContent(householdUpdateSchema) },
          responses: {
            200: jsonResponse('Updated household', z.object({ id: z.string(), name: z.string() })),
            400: errorResponse('Validation error'),
            ...authResponses,
          },
        },
        delete: {
          operationId: 'deleteHousehold',
          tags: ['Households'],
          summary: 'Delete a household and all data (OWNER only)',
          parameters: [householdIdParam],
          responses: {
            200: jsonResponse(
              'Deletion result',
              z.object({
                message: z.string(),
                deletionCounts: z.object({
                  transactions: z.number(),
                  accounts: z.number(),
                  categories: z.number(),
                  types: z.number(),
                  users: z.number(),
                  members: z.number(),
                }),
              })
            ),
            ...authResponses,
          },
        },
      },

      '/api/households/bulk': {
        post: {
          operationId: 'bulkCreateHouseholds',
          tags: ['Households'],
          summary: 'Create multiple households at once',
          requestBody: {
            required: true,
            content: jsonContent(
              z.object({
                households: z.array(
                  z.object({
                    name: z.string(),
                    annualBudget: z.number().optional(),
                  })
                ),
              })
            ),
          },
          responses: {
            201: jsonResponse(
              'Bulk creation result',
              z.object({
                message: z.string(),
                created: z.array(z.object({ id: z.string(), name: z.string() })),
                skipped: z.number(),
              })
            ),
            400: errorResponse('Validation error'),
            ...authResponses,
          },
        },
      },

      '/api/households/{id}/active-month': {
        get: {
          operationId: 'getActiveMonth',
          tags: ['Households'],
          summary: 'Get the most recent month with transactions',
          parameters: [householdIdParam],
          responses: {
            200: jsonResponse(
              'Active month info',
              z.object({
                year: z.number(),
                month: z.number(),
                monthName: z.string(),
                isCurrentMonth: z.boolean(),
                message: z.string().optional(),
              })
            ),
            ...authResponses,
          },
        },
      },

      '/api/households/{id}/members': {
        get: {
          operationId: 'listHouseholdMembers',
          tags: ['Households'],
          summary: 'List household members',
          parameters: [householdIdParam],
          responses: {
            200: jsonResponse(
              'Array of members',
              z.array(
                z.object({
                  id: z.string(),
                  role: z.enum(['OWNER', 'MEMBER', 'VIEWER']),
                  joinedAt: z.string(),
                  weeklySummary: z.boolean(),
                  user: z.object({
                    id: z.string(),
                    firstName: z.string().nullable(),
                    lastName: z.string().nullable(),
                    email: z.string(),
                  }),
                })
              )
            ),
            ...authResponses,
          },
        },
      },

      '/api/households/{id}/members/{userId}': {
        patch: {
          operationId: 'updateMemberRole',
          tags: ['Households'],
          summary: "Change a member's role (OWNER only)",
          parameters: [
            householdIdParam,
            {
              name: 'userId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Member user ID',
            },
          ],
          requestBody: {
            required: true,
            content: jsonContent(z.object({ role: z.enum(['OWNER', 'MEMBER', 'VIEWER']) })),
          },
          responses: {
            200: jsonResponse(
              'Updated member',
              z.object({
                id: z.string(),
                role: z.string(),
                user: z.object({
                  id: z.string(),
                  firstName: z.string().nullable(),
                  lastName: z.string().nullable(),
                  email: z.string(),
                }),
              })
            ),
            400: errorResponse('Validation error'),
            ...authResponses,
          },
        },
        delete: {
          operationId: 'removeMember',
          tags: ['Households'],
          summary: 'Remove a member from the household',
          parameters: [
            householdIdParam,
            {
              name: 'userId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Member user ID',
            },
          ],
          responses: {
            200: jsonResponse('Success message', z.object({ message: z.string() })),
            400: errorResponse('Cannot remove last owner'),
            ...authResponses,
          },
        },
      },

      '/api/households/{id}/invitations': {
        get: {
          operationId: 'listHouseholdInvitations',
          tags: ['Invitations'],
          summary: 'List pending invitations for a household',
          parameters: [householdIdParam],
          responses: {
            200: jsonResponse(
              'Array of invitations',
              z.array(
                z.object({
                  id: z.string(),
                  role: z.string(),
                  status: z.string(),
                  expiresAt: z.string(),
                  createdAt: z.string(),
                })
              )
            ),
            ...authResponses,
          },
        },
        post: {
          operationId: 'createInvitation',
          tags: ['Invitations'],
          summary: 'Invite a user to a household (OWNER only)',
          parameters: [householdIdParam],
          requestBody: {
            required: true,
            content: jsonContent(
              z.object({
                inviteeEmail: z.email(),
                role: z.enum(['OWNER', 'MEMBER', 'VIEWER']),
                expiresInDays: z.number().optional(),
              })
            ),
          },
          responses: {
            201: jsonResponse(
              'Created invitation',
              z.object({ id: z.string(), role: z.string(), status: z.string() })
            ),
            400: errorResponse('Validation error'),
            ...authResponses,
          },
        },
      },

      // ======================== ACCOUNTS ========================
      '/api/accounts': {
        get: {
          operationId: 'listAccounts',
          tags: ['Accounts'],
          summary: 'List accounts for a household',
          parameters: [householdIdQuery],
          responses: {
            200: jsonResponse(
              'Array of accounts',
              z.array(
                z.object({
                  id: z.uuidv4(),
                  name: z.string(),
                  householdId: z.uuidv4(),
                })
              )
            ),
            ...authResponses,
          },
        },
        post: {
          operationId: 'createAccount',
          tags: ['Accounts'],
          summary: 'Create an account (OWNER / MEMBER)',
          requestBody: { required: true, content: jsonContent(accountCreateSchema) },
          responses: {
            201: jsonResponse(
              'Created account',
              z.object({ id: z.string(), name: z.string(), householdId: z.string() })
            ),
            400: errorResponse('Validation error'),
            ...authResponses,
          },
        },
      },

      '/api/accounts/{id}': {
        get: {
          operationId: 'getAccount',
          tags: ['Accounts'],
          summary: 'Get a single account',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Account ID',
            },
          ],
          responses: {
            200: jsonResponse(
              'Account object',
              z.object({ id: z.string(), name: z.string(), householdId: z.string() })
            ),
            ...authResponses,
          },
        },
        put: {
          operationId: 'updateAccount',
          tags: ['Accounts'],
          summary: 'Update an account (OWNER / MEMBER)',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Account ID',
            },
          ],
          requestBody: { required: true, content: jsonContent(accountUpdateSchema) },
          responses: {
            200: jsonResponse('Updated account', z.object({ id: z.string(), name: z.string() })),
            400: errorResponse('Validation error'),
            ...authResponses,
          },
        },
        delete: {
          operationId: 'deleteAccount',
          tags: ['Accounts'],
          summary: 'Delete an account (OWNER / MEMBER)',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Account ID',
            },
          ],
          responses: {
            200: jsonResponse('Success message', z.object({ message: z.string() })),
            ...authResponses,
          },
        },
      },

      '/api/accounts/bulk': {
        post: {
          operationId: 'bulkCreateAccounts',
          tags: ['Accounts'],
          summary: 'Create multiple accounts at once (OWNER / MEMBER)',
          requestBody: {
            required: true,
            content: jsonContent(
              z.object({
                accounts: z.array(z.object({ name: z.string() })),
                householdId: z.uuidv4(),
              })
            ),
          },
          responses: {
            201: jsonResponse(
              'Bulk creation result',
              z.object({
                message: z.string(),
                created: z.array(z.object({ id: z.string(), name: z.string() })),
                skipped: z.number(),
              })
            ),
            400: errorResponse('Validation error'),
            ...authResponses,
          },
        },
      },

      // ======================== TRANSACTIONS ========================
      '/api/transactions': {
        get: {
          operationId: 'listTransactions',
          tags: ['Transactions'],
          summary: 'List transactions (paginated, filterable)',
          parameters: [
            householdIdQuery,
            {
              name: 'page',
              in: 'query',
              schema: { type: 'integer', default: 1 },
              description: 'Page number',
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 10, maximum: 1000 },
              description: 'Items per page',
            },
            {
              name: 'category',
              in: 'query',
              schema: { type: 'string' },
              description: 'Filter by category name',
            },
            {
              name: 'type',
              in: 'query',
              schema: { type: 'string' },
              description: 'Filter by type name',
            },
            {
              name: 'account',
              in: 'query',
              schema: { type: 'string' },
              description: 'Filter by account name',
            },
            {
              name: 'user',
              in: 'query',
              schema: { type: 'string' },
              description: 'Filter by user name',
            },
            {
              name: 'startDate',
              in: 'query',
              schema: { type: 'string', format: 'date' },
              description: 'Filter from date (YYYY-MM-DD)',
            },
            {
              name: 'endDate',
              in: 'query',
              schema: { type: 'string', format: 'date' },
              description: 'Filter to date (YYYY-MM-DD)',
            },
            {
              name: 'search',
              in: 'query',
              schema: { type: 'string' },
              description: 'Search description/memo',
            },
          ],
          responses: {
            200: paginatedResponse('Paginated transactions', 'Transaction'),
            ...authResponses,
          },
        },
        post: {
          operationId: 'createTransaction',
          tags: ['Transactions'],
          summary: 'Create a transaction (OWNER / MEMBER)',
          requestBody: { required: true, content: jsonContent(transactionCreateSchema) },
          responses: {
            201: jsonResponse(
              'Created transaction',
              z.object({
                id: z.string(),
                description: z.string(),
                amount: z.number(),
              })
            ),
            400: errorResponse('Validation error'),
            409: errorResponse('Duplicate transaction'),
            ...authResponses,
          },
        },
      },

      '/api/transactions/{id}': {
        get: {
          operationId: 'getTransaction',
          tags: ['Transactions'],
          summary: 'Get a single transaction',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Transaction ID',
            },
          ],
          responses: {
            200: jsonResponse('Transaction object', ref('Transaction')),
            ...authResponses,
          },
        },
        put: {
          operationId: 'updateTransaction',
          tags: ['Transactions'],
          summary: 'Update a transaction (OWNER / MEMBER)',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Transaction ID',
            },
          ],
          requestBody: { required: true, content: jsonContent(transactionUpdateSchema) },
          responses: {
            200: jsonResponse(
              'Updated transaction',
              z.object({ id: z.string(), description: z.string() })
            ),
            400: errorResponse('Validation error'),
            409: errorResponse('Duplicate transaction'),
            ...authResponses,
          },
        },
        delete: {
          operationId: 'deleteTransaction',
          tags: ['Transactions'],
          summary: 'Delete a transaction (OWNER / MEMBER)',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Transaction ID',
            },
          ],
          responses: {
            200: jsonResponse('Success', z.object({ success: z.literal(true) })),
            ...authResponses,
          },
        },
      },

      '/api/transactions/bulk': {
        post: {
          operationId: 'bulkUploadTransactions',
          tags: ['Transactions'],
          summary: 'Bulk upload transactions from CSV (OWNER / MEMBER)',
          description:
            'Upload up to 5 000 transactions. Categories, types, accounts, and users are automatically matched or created. Duplicate detection is applied.',
          requestBody: {
            required: true,
            content: jsonContent(
              z.object({
                householdId: z.uuidv4(),
                transactions: z.array(
                  z.object({
                    account: z.string(),
                    transactionDate: z.string(),
                    postDate: z.string().optional(),
                    description: z.string(),
                    category: z.string(),
                    type: z.string(),
                    amount: z.string(),
                    user: z.string().optional(),
                    memo: z.string().optional(),
                  })
                ),
              })
            ),
          },
          responses: {
            201: jsonResponse(
              'Upload result',
              z.object({
                created: z.array(z.object({ id: z.string() })),
                duplicates: z.array(z.object({ description: z.string() })),
                failures: z.array(z.object({ error: z.string() })),
                summary: z.object({
                  total: z.number(),
                  created: z.number(),
                  duplicates: z.number(),
                  failures: z.number(),
                }),
              })
            ),
            400: errorResponse('Validation error'),
            ...authResponses,
          },
        },
      },

      '/api/transactions/analytics': {
        get: {
          operationId: 'getTransactionAnalytics',
          tags: ['Transactions'],
          summary: 'Get spending analytics',
          parameters: [
            householdIdQuery,
            { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
            {
              name: 'groupBy',
              in: 'query',
              schema: { type: 'string', enum: ['category', 'user', 'account'] },
            },
            { name: 'typeId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            200: jsonResponse(
              'Analytics data',
              z.object({
                totalInflow: z.number(),
                totalOutflow: z.number(),
                netFlow: z.number(),
                breakdown: z.array(z.object({ name: z.string(), total: z.number() })),
              })
            ),
            ...authResponses,
          },
        },
      },

      '/api/transactions/duplicates': {
        get: {
          operationId: 'findDuplicateTransactions',
          tags: ['Transactions'],
          summary: 'Find potential duplicate transactions',
          parameters: [
            householdIdQuery,
            { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          ],
          responses: {
            200: jsonResponse(
              'Duplicate pairs and stats',
              z.object({
                duplicatePairs: z.array(
                  z.object({
                    transaction1: z.object({ id: z.string(), description: z.string() }),
                    transaction2: z.object({ id: z.string(), description: z.string() }),
                    similarity: z.number(),
                  })
                ),
                stats: z.object({ totalTransactions: z.number(), duplicatesFound: z.number() }),
              })
            ),
            422: errorResponse('Too many transactions (max 4 000)'),
            ...authResponses,
          },
        },
      },

      '/api/transactions/sankey': {
        get: {
          operationId: 'getSankeyData',
          tags: ['Transactions'],
          summary: 'Get Sankey diagram data (money flow)',
          parameters: [
            householdIdQuery,
            { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'typeId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            200: jsonResponse(
              'Sankey nodes and links',
              z.object({
                nodes: z.array(z.object({ name: z.string(), type: z.string() })),
                links: z.array(
                  z.object({
                    source: z.number(),
                    target: z.number(),
                    value: z.number(),
                    type: z.string(),
                  })
                ),
              })
            ),
            ...authResponses,
          },
        },
      },

      '/api/transactions/date-ranges': {
        get: {
          operationId: 'getDateRanges',
          tags: ['Transactions'],
          summary: 'Get available transaction years',
          parameters: [householdIdQuery],
          responses: {
            200: jsonResponse(
              'Date range info',
              z.object({
                years: z.array(z.number()),
                currentYear: z.number(),
                currentMonth: z.number(),
              })
            ),
            ...authResponses,
          },
        },
      },

      // ======================== CATEGORIES ========================
      '/api/categories': {
        get: {
          operationId: 'listCategories',
          tags: ['Categories'],
          summary: 'List categories for a household',
          parameters: [householdIdQuery],
          responses: {
            200: jsonResponse(
              'Array of categories',
              z.array(
                z.object({
                  id: z.uuidv4(),
                  name: z.string(),
                  description: z.string().nullable(),
                  icon: z.string().nullable(),
                  color: z.string().nullable(),
                  annualBudget: z.number().nullable(),
                  householdId: z.uuidv4(),
                })
              )
            ),
            ...authResponses,
          },
        },
        post: {
          operationId: 'createCategory',
          tags: ['Categories'],
          summary: 'Create a category (OWNER / MEMBER)',
          requestBody: {
            required: true,
            content: jsonContent(
              z.object({
                ...categoryCreateSchema.shape,
                householdId: z.uuidv4(),
                annualBudget: z.number().optional(),
              })
            ),
          },
          responses: {
            201: jsonResponse('Created category', z.object({ id: z.string(), name: z.string() })),
            400: errorResponse('Validation error'),
            ...authResponses,
          },
        },
      },

      '/api/categories/{id}': {
        get: {
          operationId: 'getCategory',
          tags: ['Categories'],
          summary: 'Get a single category',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Category ID',
            },
          ],
          responses: {
            200: jsonResponse(
              'Category object',
              z.object({
                id: z.string(),
                name: z.string(),
                description: z.string().nullable(),
                icon: z.string().nullable(),
                color: z.string().nullable(),
                annualBudget: z.number().nullable(),
              })
            ),
            ...authResponses,
          },
        },
        put: {
          operationId: 'updateCategory',
          tags: ['Categories'],
          summary: 'Update a category (OWNER / MEMBER)',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Category ID',
            },
          ],
          requestBody: { required: true, content: jsonContent(categoryUpdateSchema) },
          responses: {
            200: jsonResponse('Updated category', z.object({ id: z.string(), name: z.string() })),
            400: errorResponse('Validation error'),
            ...authResponses,
          },
        },
        delete: {
          operationId: 'deleteCategory',
          tags: ['Categories'],
          summary: 'Delete a category (OWNER / MEMBER)',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Category ID',
            },
          ],
          responses: {
            200: jsonResponse('Success message', z.object({ message: z.string() })),
            409: errorResponse('Category is in use by transactions'),
            ...authResponses,
          },
        },
      },

      '/api/categories/bulk': {
        post: {
          operationId: 'bulkCreateCategories',
          tags: ['Categories'],
          summary: 'Create multiple categories at once (OWNER / MEMBER)',
          requestBody: {
            required: true,
            content: jsonContent(
              z.object({
                categories: z.array(z.object({ name: z.string() })),
                householdId: z.uuidv4(),
              })
            ),
          },
          responses: {
            201: jsonResponse(
              'Bulk creation result',
              z.object({
                message: z.string(),
                created: z.array(z.object({ id: z.string(), name: z.string() })),
                skipped: z.number(),
              })
            ),
            400: errorResponse('Validation error'),
            ...authResponses,
          },
        },
      },

      // ======================== TYPES ========================
      '/api/types': {
        get: {
          operationId: 'listTypes',
          tags: ['Types'],
          summary: 'List transaction types for a household',
          parameters: [householdIdQuery],
          responses: {
            200: jsonResponse(
              'Array of types',
              z.array(
                z.object({
                  id: z.uuidv4(),
                  name: z.string(),
                  isOutflow: z.boolean(),
                  householdId: z.uuidv4(),
                })
              )
            ),
            ...authResponses,
          },
        },
        post: {
          operationId: 'createType',
          tags: ['Types'],
          summary: 'Create a transaction type (OWNER / MEMBER)',
          requestBody: { required: true, content: jsonContent(typeCreateSchema) },
          responses: {
            201: jsonResponse(
              'Created type',
              z.object({ id: z.string(), name: z.string(), isOutflow: z.boolean() })
            ),
            400: errorResponse('Validation error'),
            ...authResponses,
          },
        },
      },

      '/api/types/{id}': {
        get: {
          operationId: 'getType',
          tags: ['Types'],
          summary: 'Get a single transaction type',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Type ID',
            },
          ],
          responses: {
            200: jsonResponse(
              'Type object',
              z.object({ id: z.string(), name: z.string(), isOutflow: z.boolean() })
            ),
            ...authResponses,
          },
        },
        put: {
          operationId: 'updateType',
          tags: ['Types'],
          summary: 'Update a transaction type (OWNER / MEMBER)',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Type ID',
            },
          ],
          requestBody: { required: true, content: jsonContent(typeUpdateSchema) },
          responses: {
            200: jsonResponse('Updated type', z.object({ id: z.string(), name: z.string() })),
            400: errorResponse('Validation error'),
            ...authResponses,
          },
        },
        delete: {
          operationId: 'deleteType',
          tags: ['Types'],
          summary: 'Delete a transaction type (OWNER / MEMBER)',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Type ID',
            },
          ],
          responses: {
            200: jsonResponse('Success message', z.object({ message: z.string() })),
            ...authResponses,
          },
        },
      },

      '/api/types/bulk': {
        post: {
          operationId: 'bulkCreateTypes',
          tags: ['Types'],
          summary: 'Create multiple types at once (OWNER / MEMBER)',
          requestBody: {
            required: true,
            content: jsonContent(
              z.object({
                types: z.array(z.object({ name: z.string(), isOutflow: z.boolean().optional() })),
                householdId: z.uuidv4(),
              })
            ),
          },
          responses: {
            201: jsonResponse(
              'Bulk creation result',
              z.object({
                message: z.string(),
                created: z.array(z.object({ id: z.string(), name: z.string() })),
                skipped: z.number(),
              })
            ),
            400: errorResponse('Validation error'),
            ...authResponses,
          },
        },
      },

      // ======================== USERS (Household) ========================
      '/api/users': {
        get: {
          operationId: 'listUsers',
          tags: ['Users'],
          summary: 'List household users (budgeting personas)',
          parameters: [householdIdQuery],
          responses: {
            200: jsonResponse(
              'Array of users',
              z.array(
                z.object({
                  id: z.uuidv4(),
                  name: z.string(),
                  householdId: z.uuidv4(),
                  annualBudget: z.number().nullable(),
                })
              )
            ),
            ...authResponses,
          },
        },
        post: {
          operationId: 'createUser',
          tags: ['Users'],
          summary: 'Create a household user (OWNER / MEMBER)',
          requestBody: {
            required: true,
            content: jsonContent(
              z.object({
                name: z.string(),
                householdId: z.uuidv4(),
                annualBudget: z.number().optional(),
              })
            ),
          },
          responses: {
            201: jsonResponse('Created user', z.object({ id: z.string(), name: z.string() })),
            400: errorResponse('Validation error'),
            ...authResponses,
          },
        },
      },

      '/api/users/{id}': {
        get: {
          operationId: 'getUser',
          tags: ['Users'],
          summary: 'Get a single household user',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'User ID',
            },
          ],
          responses: {
            200: jsonResponse(
              'User object',
              z.object({ id: z.string(), name: z.string(), annualBudget: z.number().nullable() })
            ),
            ...authResponses,
          },
        },
        put: {
          operationId: 'updateUser',
          tags: ['Users'],
          summary: 'Update a household user (OWNER / MEMBER)',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'User ID',
            },
          ],
          requestBody: {
            required: true,
            content: jsonContent(
              z.object({
                name: z.string(),
                annualBudget: z.number().optional(),
              })
            ),
          },
          responses: {
            200: jsonResponse('Updated user', z.object({ id: z.string(), name: z.string() })),
            400: errorResponse('Validation error'),
            ...authResponses,
          },
        },
        delete: {
          operationId: 'deleteUser',
          tags: ['Users'],
          summary: 'Delete a household user (OWNER / MEMBER)',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'User ID',
            },
          ],
          responses: {
            200: jsonResponse('Success message', z.object({ message: z.string() })),
            ...authResponses,
          },
        },
      },

      '/api/users/bulk': {
        post: {
          operationId: 'bulkCreateUsers',
          tags: ['Users'],
          summary: 'Create multiple household users at once (OWNER / MEMBER)',
          requestBody: {
            required: true,
            content: jsonContent(
              z.object({
                users: z.array(z.object({ name: z.string(), annualBudget: z.number().optional() })),
                householdId: z.uuidv4(),
              })
            ),
          },
          responses: {
            201: jsonResponse(
              'Bulk creation result',
              z.object({
                message: z.string(),
                created: z.array(z.object({ id: z.string(), name: z.string() })),
                skipped: z.number(),
              })
            ),
            400: errorResponse('Validation error'),
            ...authResponses,
          },
        },
      },

      '/api/users/current': {
        get: {
          operationId: 'getCurrentUser',
          tags: ['Auth Users'],
          summary: "Get the authenticated user's profile",
          responses: {
            200: jsonResponse(
              'Current user',
              z.object({
                id: z.string(),
                email: z.string(),
                firstName: z.string().nullable(),
                lastName: z.string().nullable(),
                emailVerified: z.boolean(),
                twoFactorEnabled: z.boolean(),
              })
            ),
            ...authResponses,
          },
        },
      },

      '/api/users/email-subscriptions': {
        get: {
          operationId: 'getEmailSubscriptions',
          tags: ['Auth Users'],
          summary: 'Get weekly summary email preferences',
          responses: {
            200: jsonResponse(
              'Subscriptions',
              z.array(
                z.object({
                  householdId: z.string(),
                  householdName: z.string(),
                  weeklySummary: z.boolean(),
                  role: z.string(),
                })
              )
            ),
            ...authResponses,
          },
        },
        put: {
          operationId: 'updateEmailSubscription',
          tags: ['Auth Users'],
          summary: 'Toggle weekly summary email for a household',
          requestBody: {
            required: true,
            content: jsonContent(
              z.object({
                householdId: z.uuidv4(),
                weeklySummary: z.boolean(),
              })
            ),
          },
          responses: {
            200: jsonResponse(
              'Updated subscription',
              z.object({
                householdId: z.string(),
                weeklySummary: z.boolean(),
              })
            ),
            400: errorResponse('Validation error'),
            ...authResponses,
          },
        },
      },

      // ======================== BUDGETS ========================
      '/api/budgets/user-budget': {
        get: {
          operationId: 'getUserBudget',
          tags: ['Budgets'],
          summary: 'Get budget analytics for a household user',
          parameters: [
            householdIdQuery,
            {
              name: 'userId',
              in: 'query',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Household user ID',
            },
            { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
            {
              name: 'timePeriodType',
              in: 'query',
              schema: { type: 'string', enum: ['month', 'quarter', 'year'] },
            },
            { name: 'includeInflow', in: 'query', schema: { type: 'boolean' } },
          ],
          responses: {
            200: jsonResponse(
              'User budget analytics',
              z.object({
                budget: z.number(),
                spent: z.number(),
                remaining: z.number(),
                percentageUsed: z.number(),
                periodSpending: z.array(z.object({ date: z.string(), amount: z.number() })),
                noBudget: z.boolean().optional(),
              })
            ),
            ...authResponses,
          },
        },
      },

      '/api/budgets/household-budget': {
        get: {
          operationId: 'getHouseholdBudget',
          tags: ['Budgets'],
          summary: 'Get budget analytics for a household or category',
          parameters: [
            householdIdQuery,
            {
              name: 'categoryId',
              in: 'query',
              schema: { type: 'string', format: 'uuid' },
              description: 'Optional category filter',
            },
            { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
            {
              name: 'timePeriodType',
              in: 'query',
              schema: { type: 'string', enum: ['month', 'quarter', 'year'] },
            },
            {
              name: 'budgetType',
              in: 'query',
              schema: { type: 'string', enum: ['category', 'household'] },
            },
          ],
          responses: {
            200: jsonResponse(
              'Household budget analytics',
              z.object({
                budget: z.number(),
                spent: z.number(),
                remaining: z.number(),
                percentageUsed: z.number(),
                byCategory: z.array(
                  z.object({ name: z.string(), spent: z.number(), budget: z.number().nullable() })
                ),
                dailySpending: z.array(z.object({ date: z.string(), amount: z.number() })),
                noBudget: z.boolean().optional(),
              })
            ),
            ...authResponses,
          },
        },
      },

      // ======================== INVITATIONS (by token / by id) ========================
      '/api/invitations/by-token/{token}': {
        get: {
          operationId: 'getInvitationByToken',
          tags: ['Invitations'],
          summary: 'Look up an invitation by its token (public)',
          security: [],
          parameters: [
            {
              name: 'token',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Invitation token',
            },
          ],
          responses: {
            200: jsonResponse(
              'Invitation details',
              z.object({
                id: z.string(),
                household: z.object({ id: z.string(), name: z.string() }),
                inviter: z.object({
                  firstName: z.string().nullable(),
                  lastName: z.string().nullable(),
                }),
                role: z.string(),
                createdAt: z.string(),
                expiresAt: z.string(),
              })
            ),
            400: errorResponse('Expired or invalid invitation'),
            404: errorResponse('Invitation not found'),
          },
        },
      },

      '/api/invitations/by-token/{token}/accept': {
        post: {
          operationId: 'acceptInvitation',
          tags: ['Invitations'],
          summary: 'Accept an invitation',
          parameters: [
            {
              name: 'token',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Invitation token',
            },
          ],
          responses: {
            200: jsonResponse(
              'Acceptance result',
              z.object({
                success: z.boolean(),
                household: z.object({ id: z.string(), name: z.string() }),
                role: z.string(),
              })
            ),
            400: errorResponse('Already member, expired, or invalid'),
            ...authResponses,
          },
        },
      },

      '/api/invitations/by-id/{id}': {
        delete: {
          operationId: 'deleteInvitation',
          tags: ['Invitations'],
          summary: 'Cancel / delete an invitation',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
              description: 'Invitation ID',
            },
          ],
          responses: {
            200: jsonResponse('Success', z.object({ success: z.literal(true) })),
            ...authResponses,
          },
        },
      },

      // ======================== EMAIL / CRON ========================
      '/api/email/weekly-summary-test': {
        post: {
          operationId: 'sendWeeklySummaryTest',
          tags: ['Email'],
          summary: 'Send a test weekly summary email',
          requestBody: {
            content: jsonContent(
              z.object({
                householdId: z.uuidv4().optional(),
                asOfDate: z.string().optional(),
              })
            ),
          },
          responses: {
            201: jsonResponse(
              'Send result',
              z.object({
                success: z.boolean(),
                emailsSent: z.number(),
              })
            ),
            ...authResponses,
          },
        },
      },

      '/api/cron/weekly-summary': {
        post: {
          operationId: 'triggerWeeklySummary',
          tags: ['Email'],
          summary: 'Trigger weekly summary emails (cron)',
          description:
            'Requires `Authorization: Bearer {CRON_SECRET}` header. Not accessible via session or API key.',
          security: [{ cronAuth: [] }],
          responses: {
            200: jsonResponse(
              'Cron result',
              z.object({
                success: z.boolean(),
                emailResults: z.array(
                  z.object({
                    userId: z.string(),
                    email: z.string(),
                    success: z.boolean(),
                  })
                ),
              })
            ),
            401: errorResponse('Invalid cron secret'),
          },
        },
      },
    },
  })
}
