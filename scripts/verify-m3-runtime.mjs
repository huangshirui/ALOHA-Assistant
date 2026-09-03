import process from 'node:process'

const gatewayValue = (process.env.ALOHA_GATEWAY_URL ?? '').trim()
const accessCookie = (process.env.CF_ACCESS_AUTHORIZATION_COOKIE ?? '').trim()
const accessAssertion = (process.env.CF_ACCESS_JWT_ASSERTION ?? '').trim()

if (!gatewayValue) {
  throw new Error('ALOHA_GATEWAY_URL is required')
}

if (!accessCookie && !accessAssertion) {
  throw new Error(
    'CF_ACCESS_AUTHORIZATION_COOKIE or CF_ACCESS_JWT_ASSERTION is required',
  )
}

let gateway
try {
  gateway = new URL(gatewayValue)
} catch {
  throw new Error('ALOHA_GATEWAY_URL must be a valid URL')
}

if (gateway.protocol !== 'https:') {
  throw new Error('M3 deployment verification requires an HTTPS Gateway URL')
}

const interactionUrl = new URL('/v1/interactions', `${gateway.origin}/`)
const baseHeaders = new Headers({
  accept: 'text/event-stream, application/json',
  'content-type': 'application/json',
})

if (accessCookie) {
  baseHeaders.set('cookie', `CF_Authorization=${accessCookie}`)
} else {
  baseHeaders.set('Cf-Access-Jwt-Assertion', accessAssertion)
}

const interaction = (body) =>
  fetch(interactionUrl, {
    method: 'POST',
    headers: baseHeaders,
    redirect: 'manual',
    body: JSON.stringify(body),
  })

const readJson = async (response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const parseSse = async (response) => {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('text/event-stream')) {
    const payload = await readJson(response)
    throw new Error(
      `Expected SSE response, got HTTP ${response.status} ${JSON.stringify(payload)}`,
    )
  }

  const body = await response.text()
  const events = []

  for (const frame of body.split(/\r?\n\r?\n/u)) {
    if (!frame.trim()) continue
    const data = frame
      .split(/\r?\n/u)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trimStart())
      .join('\n')
    if (!data) continue
    try {
      events.push(JSON.parse(data))
    } catch {
      throw new Error('Gateway returned an invalid SSE data frame')
    }
  }

  return events
}

const assertCompletedRun = (events, expectedConversationId) => {
  const started = events.find((event) => event?.type === 'run.started')
  const completed = events.find((event) => event?.type === 'run.completed')
  const failed = events.find((event) => event?.type === 'run.failed')

  if (failed) {
    throw new Error(`M3 probe Run failed with ${failed?.error?.code ?? 'unknown_error'}`)
  }
  if (!started || !completed) {
    throw new Error('M3 probe did not emit run.started and run.completed')
  }
  if (
    typeof started.runId !== 'string' ||
    typeof started.conversationId !== 'string'
  ) {
    throw new Error('M3 probe emitted invalid Run identity')
  }
  if (
    expectedConversationId &&
    started.conversationId !== expectedConversationId
  ) {
    throw new Error('M3 probe did not continue the admitted Conversation')
  }

  return {
    conversationId: started.conversationId,
    runId: started.runId,
  }
}

const unknownConversationId = `cnv_m3_probe_${crypto.randomUUID().replaceAll('-', '')}`
const unknownResponse = await interaction({
  requestId: crypto.randomUUID(),
  conversationId: unknownConversationId,
  text: 'Synthetic M3 trusted-state admission probe.',
})

if (unknownResponse.status !== 404) {
  if (unknownResponse.status >= 300 && unknownResponse.status < 400) {
    throw new Error(
      'Cloudflare Access did not authenticate the verifier request; use a current CF_Authorization cookie.',
    )
  }
  throw new Error(
    `Expected trusted unknown-Conversation rejection (404), got HTTP ${unknownResponse.status}`,
  )
}

const unknownPayload = await readJson(unknownResponse)
if (unknownPayload?.error !== 'conversation_not_found') {
  throw new Error(
    `Expected conversation_not_found, got ${JSON.stringify(unknownPayload)}`,
  )
}

const firstResponse = await interaction({
  requestId: crypto.randomUUID(),
  text: 'Synthetic M3 durable Conversation probe one.',
})

if (!firstResponse.ok) {
  const payload = await readJson(firstResponse)
  throw new Error(
    `First trusted M3 Run was not admitted: HTTP ${firstResponse.status} ${JSON.stringify(payload)}`,
  )
}

const first = assertCompletedRun(await parseSse(firstResponse))

const secondResponse = await interaction({
  requestId: crypto.randomUUID(),
  conversationId: first.conversationId,
  text: 'Synthetic M3 durable Conversation probe two.',
})

if (!secondResponse.ok) {
  const payload = await readJson(secondResponse)
  throw new Error(
    `Second trusted M3 Run was not admitted: HTTP ${secondResponse.status} ${JSON.stringify(payload)}`,
  )
}

const second = assertCompletedRun(
  await parseSse(secondResponse),
  first.conversationId,
)

if (second.runId === first.runId) {
  throw new Error('Replacement M3 probe unexpectedly reused the prior Run ID')
}

console.log('M3 trusted identity and durable Conversation/Run verification passed.')
