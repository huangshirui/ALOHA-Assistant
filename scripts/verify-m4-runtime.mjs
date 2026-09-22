const gatewayUrl = (process.env.ALOHA_GATEWAY_URL ?? '').replace(/\/$/u, '')

if (!gatewayUrl) {
  console.error('ALOHA_GATEWAY_URL is required.')
  process.exit(2)
}

let gateway
try {
  gateway = new URL(gatewayUrl)
} catch {
  throw new Error('ALOHA_GATEWAY_URL must be a valid URL')
}

if (gateway.protocol !== 'https:') {
  throw new Error('M4 deployment verification requires an HTTPS Gateway URL')
}

const invocationUrl = new URL(
  '/v1/runtime/tools/lifespace.read/invoke',
  `${gateway.origin}/`,
)

const request = (authorization) =>
  fetch(invocationUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(authorization ? { authorization } : {}),
    },
    redirect: 'manual',
    body: JSON.stringify({ input: { operation: 'discover' } }),
  })

const readJson = async (response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const assertOwnGrantGate = async (
  label,
  response,
  expectedError,
) => {
  if (response.status >= 300 && response.status < 400) {
    throw new Error(
      `${label}: Runtime Tool callback redirected to Cloudflare Access. Configure the narrow /v1/runtime/tools/* Access bypass before activating M4.`,
    )
  }

  const payload = await readJson(response)
  if (
    response.status !== 401 ||
    payload?.error !== expectedError ||
    Object.keys(payload ?? {}).length !== 1
  ) {
    throw new Error(
      `${label}: expected ALOHA HTTP 401 ${expectedError}, received HTTP ${response.status} ${JSON.stringify(payload)}`,
    )
  }
}

try {
  await assertOwnGrantGate(
    'Missing Tool Grant',
    await request(''),
    'runtime_tool_grant_required',
  )
  await assertOwnGrantGate(
    'Malformed Tool Grant',
    await request('Bearer malformed'),
    'invalid_runtime_tool_grant',
  )
  console.log(
    'M4 Runtime Tool callback is reachable outside the human Access session and fails closed on missing/invalid ALOHA Tool Grants.',
  )
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : 'M4 Runtime Tool callback verification failed.',
  )
  process.exit(1)
}
