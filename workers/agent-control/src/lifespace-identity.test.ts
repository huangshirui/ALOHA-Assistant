import { describe, expect, it, vi } from 'vitest'

import {
  LifeSpaceIdentityError,
  resolveLifeSpaceRunIdentity,
} from './lifespace-identity'

const request = (withAssertion = true) =>
  new Request('https://aloha.example/v1/interactions', {
    method: 'POST',
    headers: withAssertion
      ? { 'Cf-Access-Jwt-Assertion': 'synthetic.payload.signature' }
      : {},
  })

const config = {
  LIFESPACE_IDENTITY_BASE_URL: 'https://identity.example',
  LIFESPACE_APPLICATION_CREDENTIAL:
    'lsa_synthetic_application_credential_for_tests_only_1234567890',
}

describe('LifeSpace Run identity resolution', () => {
  it('keeps the pre-M3 deployment verification path explicitly identity-null when LifeSpace is unconfigured', async () => {
    const fetchImpl = vi.fn()

    await expect(
      resolveLifeSpaceRunIdentity(request(false), {}, fetchImpl),
    ).resolves.toEqual({ mode: 'legacy-verification', identity: null })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('fails closed when LifeSpace is only partially configured', async () => {
    await expect(
      resolveLifeSpaceRunIdentity(
        request(),
        { LIFESPACE_IDENTITY_BASE_URL: config.LIFESPACE_IDENTITY_BASE_URL },
        vi.fn(),
      ),
    ).rejects.toMatchObject({
      code: 'identity_invalid_config',
      status: 503,
    })
  })

  it('requires the raw Cloudflare Access assertion at the trusted boundary', async () => {
    const fetchImpl = vi.fn()

    await expect(
      resolveLifeSpaceRunIdentity(request(false), config, fetchImpl),
    ).rejects.toMatchObject({
      code: 'identity_assertion_required',
      status: 401,
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('resolves Principal, Agent Actor and Application through LifeSpace instead of trusting request-body IDs', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))

      if (url.pathname === '/internal/v1/access/tokens') {
        expect(new Headers(init?.headers).get('authorization')).toBe(
          `Bearer ${config.LIFESPACE_APPLICATION_CREDENTIAL}`,
        )
        expect(JSON.parse(String(init?.body))).toEqual({
          accessAssertion: 'synthetic.payload.signature',
          requestedScopes: ['profile:read'],
        })
        return Response.json({
          data: { accessToken: 'synthetic-user-token' },
        })
      }

      if (url.pathname === '/api/v1/me') {
        expect(new Headers(init?.headers).get('authorization')).toBe(
          'Bearer synthetic-user-token',
        )
        return Response.json({
          data: { id: 'usr_example', displayName: 'Synthetic User' },
        })
      }

      if (url.pathname === '/internal/v1/agents') {
        return Response.json({
          data: {
            items: [
              {
                id: 'agt_aloha',
                displayName: 'ALOHA Assistant',
                status: 'active',
              },
            ],
          },
        })
      }

      if (url.pathname === '/internal/v1/agent-tokens') {
        expect(JSON.parse(String(init?.body))).toEqual({
          subjectId: 'usr_example',
          agentId: 'agt_aloha',
          scopes: [],
        })
        return Response.json({
          data: {
            accessToken: 'synthetic-delegated-token',
            principalId: 'usr_example',
            actor: { type: 'agent', id: 'agt_aloha' },
            applicationId: 'app_aloha',
          },
        })
      }

      return new Response(null, { status: 404 })
    })

    await expect(
      resolveLifeSpaceRunIdentity(request(), config, fetchImpl),
    ).resolves.toEqual({
      mode: 'trusted',
      identity: {
        principal: { type: 'user', id: 'usr_example' },
        actor: { type: 'agent', id: 'agt_aloha' },
        application: { id: 'app_aloha' },
      },
    })
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  it('fails instead of guessing an Agent identity when the application does not bind exactly one active Agent', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      if (url.pathname === '/internal/v1/access/tokens') {
        return Response.json({ data: { accessToken: 'synthetic-user-token' } })
      }
      if (url.pathname === '/api/v1/me') {
        return Response.json({ data: { id: 'usr_example' } })
      }
      if (url.pathname === '/internal/v1/agents') {
        return Response.json({ data: { items: [] } })
      }
      return new Response(null, { status: 404 })
    })

    let caught: unknown
    try {
      await resolveLifeSpaceRunIdentity(request(), config, fetchImpl)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(LifeSpaceIdentityError)
    expect(caught).toMatchObject({
      code: 'agent_identity_not_configured',
      status: 503,
    })
  })

  it('does not surface upstream response bodies through identity errors', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('synthetic private upstream detail', { status: 503 }),
    )

    let caught: unknown
    try {
      await resolveLifeSpaceRunIdentity(request(), config, fetchImpl)
    } catch (error) {
      caught = error
    }

    expect(caught).toMatchObject({
      code: 'identity_provider_unavailable',
      status: 503,
    })
    expect((caught as Error).message).not.toContain(
      'synthetic private upstream detail',
    )
  })
})
