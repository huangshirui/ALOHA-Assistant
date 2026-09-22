import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CanonicalRunIdentity } from '@aloha/contracts'

import {
  createLifeSpaceReadToolDescriptor,
  invokeLifeSpaceReadTool,
} from './lifespace-runtime-tool'

const identity: CanonicalRunIdentity = {
  principal: { type: 'user', id: 'usr_synthetic' },
  actor: { type: 'agent', id: 'agt_synthetic' },
  application: { id: 'aloha-assistant' },
}

const env = {
  LIFESPACE_IDENTITY_BASE_URL: 'https://identity.example',
  LIFESPACE_CORE_API_BASE_URL: 'https://core.example/api/v1',
  LIFESPACE_APPLICATION_CREDENTIAL:
    'lsa_synthetic_application_credential_for_tests_only_1234567890',
  RUNTIME_TOOL_GRANT_SIGNING_KEY:
    'synthetic-runtime-tool-signing-key-for-tests-only-1234567890',
}

const invocationRequest = async (input: unknown) => {
  const descriptor = await createLifeSpaceReadToolDescriptor(
    new Request('https://aloha.example/v1/interactions'),
    'run_synthetic',
    identity,
    env,
  )
  if (!descriptor) throw new Error('descriptor missing')

  return new Request(descriptor.invocation.url, {
    method: 'POST',
    headers: {
      authorization: descriptor.invocation.authorization,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ input }),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LifeSpace read Runtime Tool', () => {
  it('is absent unless the complete trusted credential path is configured', async () => {
    await expect(
      createLifeSpaceReadToolDescriptor(
        new Request('https://aloha.example/v1/interactions'),
        'run_synthetic',
        identity,
        {},
      ),
    ).resolves.toBeNull()
  })

  it('exposes only an ALOHA run-scoped tool grant to the Runtime', async () => {
    const descriptor = await createLifeSpaceReadToolDescriptor(
      new Request('https://aloha.example/v1/interactions'),
      'run_synthetic',
      identity,
      env,
    )

    expect(descriptor).toMatchObject({
      id: 'lifespace.read',
      invocation: {
        type: 'http',
        method: 'POST',
        url: 'https://aloha.example/v1/runtime/tools/lifespace.read/invoke',
      },
    })
    expect(descriptor?.invocation.authorization).toMatch(/^Bearer [^.]+\.[^.]+$/u)
    expect(descriptor?.invocation.authorization).not.toContain('lsa_')
    expect(descriptor?.invocation.authorization).not.toContain('synthetic-delegated-token')
  })

  it('mints a short-lived delegated Core credential only inside the trusted invocation', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))

      if (url.origin === 'https://identity.example') {
        expect(url.pathname).toBe('/internal/v1/agent-tokens')
        expect(new Headers(init?.headers).get('authorization')).toBe(
          `Bearer ${env.LIFESPACE_APPLICATION_CREDENTIAL}`,
        )
        expect(JSON.parse(String(init?.body))).toEqual({
          subjectId: 'usr_synthetic',
          agentId: 'agt_synthetic',
          scopes: ['resources:read'],
        })
        return Response.json({
          data: {
            accessToken: 'synthetic-delegated-token',
            principalId: 'usr_synthetic',
            actor: { type: 'agent', id: 'agt_synthetic' },
            applicationId: 'aloha-assistant',
          },
        })
      }

      expect(url.toString()).toBe('https://core.example/api/v1/me/_discovery/inventory')
      expect(new Headers(init?.headers).get('authorization')).toBe(
        'Bearer synthetic-delegated-token',
      )
      return Response.json({
        data: {
          spaces: [
            {
              spaceId: 'spc_synthetic',
              models: [{ modelKey: 'task', access: ['read'] }],
            },
          ],
        },
      })
    })
    vi.stubGlobal('fetch', fetchImpl)

    const response = await invokeLifeSpaceReadTool(
      await invocationRequest({ operation: 'discover' }),
      env,
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      toolId: 'lifespace.read',
      output: {
        data: {
          spaces: [
            {
              spaceId: 'spc_synthetic',
              models: [{ modelKey: 'task', access: ['read'] }],
            },
          ],
        },
      },
    })
    expect(JSON.stringify(payload)).not.toContain('synthetic-delegated-token')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('loads progressive model semantics and forwards Canonical Query without inventing model routes', async () => {
    const coreRequests: Array<{ url: URL; init?: RequestInit }> = []
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.origin === 'https://identity.example') {
        return Response.json({
          data: {
            accessToken: 'synthetic-delegated-token',
            principalId: 'usr_synthetic',
            actor: { type: 'agent', id: 'agt_synthetic' },
            applicationId: 'aloha-assistant',
          },
        })
      }

      coreRequests.push({ url, init })
      if (url.pathname === '/api/v1/spaces/spc_synthetic/_discovery/models/task') {
        return Response.json({
          data: {
            key: 'task',
            query: {
              canonical: {
                invocation: {
                  method: 'POST',
                  pathTemplate:
                    '/api/v1/spaces/{spaceId}/models/{modelKey}/records/query',
                },
              },
            },
          },
        })
      }

      expect(url.pathname).toBe(
        '/api/v1/spaces/spc_synthetic/models/task/records/query',
      )
      expect(init?.method).toBe('POST')
      expect(new Headers(init?.headers).get('content-type')).toBe(
        'application/json',
      )
      expect(JSON.parse(String(init?.body))).toEqual({
        search: { text: 'today' },
        sort: [
          { field: 'dueDate', direction: 'asc' },
          { field: 'createdAt', direction: 'desc' },
        ],
        page: { limit: 20 },
      })
      return Response.json(
        { error: { code: 'FORBIDDEN', message: 'Synthetic deny path' } },
        { status: 403 },
      )
    })
    vi.stubGlobal('fetch', fetchImpl)

    const describe = await invokeLifeSpaceReadTool(
      await invocationRequest({
        operation: 'describe',
        spaceId: 'spc_synthetic',
        modelKey: 'task',
      }),
      env,
    )
    expect(describe.status).toBe(200)

    const response = await invokeLifeSpaceReadTool(
      await invocationRequest({
        operation: 'query',
        spaceId: 'spc_synthetic',
        modelKey: 'task',
        query: {
          search: { text: 'today' },
          sort: [
            { field: 'dueDate', direction: 'asc' },
            { field: 'createdAt', direction: 'desc' },
          ],
          page: { limit: 20 },
        },
      }),
      env,
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: 'lifespace_request_denied',
      status: 403,
      detail: { error: { code: 'FORBIDDEN' } },
    })
    expect(coreRequests).toHaveLength(2)
  })

  it('rejects malformed tool grants before any LifeSpace request', async () => {
    const fetchImpl = vi.fn()
    vi.stubGlobal('fetch', fetchImpl)

    const response = await invokeLifeSpaceReadTool(
      new Request('https://aloha.example/v1/runtime/tools/lifespace.read/invoke', {
        method: 'POST',
        headers: {
          authorization: 'Bearer malformed',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ input: { operation: 'discover' } }),
      }),
      env,
    )

    expect(response.status).toBe(401)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
