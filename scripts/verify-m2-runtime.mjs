const gatewayUrl = (process.env.ALOHA_GATEWAY_URL ?? '').replace(/\/$/, '')
const accessCookie = (process.env.CF_ACCESS_AUTHORIZATION_COOKIE ?? '').trim()
const accessAssertion = (process.env.CF_ACCESS_JWT_ASSERTION ?? '').trim()

if (!gatewayUrl) {
  console.error('ALOHA_GATEWAY_URL is required.')
  process.exit(2)
}

const requestHeaders = () => {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (accessCookie) {
    headers.set('cookie', `CF_Authorization=${accessCookie}`)
  } else if (accessAssertion) {
    headers.set('Cf-Access-Jwt-Assertion', accessAssertion)
  }
  return headers
}

const parseSseOutput = async (response) => {
  if (response.status >= 300 && response.status < 400) {
    throw new Error(
      'Cloudflare Access did not authenticate the M2 verifier request; use a current CF_Authorization cookie.',
    )
  }
  if (!response.ok || !response.body) {
    throw new Error(`Interaction request failed with HTTP ${response.status}.`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const eventTypes = []
  let output = ''
  let buffer = ''

  const consumeFrame = (frame) => {
    const data = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')

    if (!data) {
      return
    }

    const event = JSON.parse(data)
    eventTypes.push(event.type)

    if (event.type === 'output.delta' && typeof event.delta === 'string') {
      output += event.delta
    }

    if (event.type === 'run.failed') {
      throw new Error(`ALOHA Run failed with code: ${event.error?.code ?? 'unknown'}`)
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n')

    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''

    for (const frame of frames) {
      consumeFrame(frame)
    }

    if (done) {
      break
    }
  }

  if (buffer.trim()) {
    consumeFrame(buffer)
  }

  return { eventTypes, output: output.trim() }
}

const verifyCapabilityGrantGate = async () => {
  const response = await fetch(
    `${gatewayUrl}/v1/runtime/capabilities/math.calculate/invoke`,
    {
      method: 'POST',
      headers: requestHeaders(),
      redirect: 'manual',
      body: JSON.stringify({
        input: { operation: 'add', left: 7, right: 5 },
      }),
    },
  )

  if (response.status >= 300 && response.status < 400) {
    throw new Error(
      'The Runtime Capability callback path is still gated by Cloudflare Access. Configure the narrow path-specific Access bypass before activating M3.',
    )
  }

  const body = await response.text()
  let payload

  try {
    payload = JSON.parse(body)
  } catch {
    throw new Error('M2 grant-gate verification returned a non-JSON response.')
  }

  if (
    response.status !== 401 ||
    payload?.error !== 'capability_grant_required' ||
    Object.keys(payload).length !== 1
  ) {
    throw new Error(
      `M2 grant gate is not deployment-ready: expected HTTP 401 capability_grant_required, received HTTP ${response.status}.`,
    )
  }

  console.log('Capability grant gate: configured and fail-closed without a grant.')
}

const verifyRuntimeToolPath = async () => {
  const left = 583921.137
  const right = 74928.615
  const expected = String(left * right)
  const marker = 'M2_TOOL_OK:'
  const text = [
    'This is an ALOHA M2 deployment verification request.',
    'Use the connected ALOHA-authorized arithmetic tool that performs one add, subtract, multiply, or divide operation. Its UI/node name may be normalized by the runtime (for example spaces may become underscores).',
    'You MUST use that connected arithmetic tool to multiply the two numbers below and then reply with exactly one line in this format:',
    `${marker}<numeric result>`,
    'Do not add words, markdown, commas, or explanation.',
    `left=${left}`,
    `right=${right}`,
    'If no connected arithmetic tool is available at all, reply exactly: M2_TOOL_MISSING',
  ].join('\n')

  const response = await fetch(`${gatewayUrl}/v1/interactions`, {
    method: 'POST',
    headers: requestHeaders(),
    redirect: 'manual',
    body: JSON.stringify({
      requestId: crypto.randomUUID(),
      text,
    }),
  })

  const { eventTypes, output } = await parseSseOutput(response)
  const startedIndex = eventTypes.indexOf('run.started')
  const outputIndex = eventTypes.indexOf('output.delta')
  const completedIndex = eventTypes.indexOf('run.completed')
  const ordered =
    startedIndex !== -1 &&
    outputIndex > startedIndex &&
    completedIndex > outputIndex

  if (!ordered) {
    throw new Error(
      `M2 runtime verification failed: unexpected event order ${eventTypes.join(' -> ')}.`,
    )
  }

  if (output === 'M2_TOOL_MISSING') {
    throw new Error(
      'M2 runtime verification failed: deployed n8n workflow did not advertise an authorized arithmetic tool to the Agent.',
    )
  }

  if (!output.startsWith(marker)) {
    throw new Error(
      'M2 runtime verification failed: deployed n8n workflow did not return the M2 tool marker.',
    )
  }

  const actual = output.slice(marker.length).trim()

  if (actual !== expected) {
    throw new Error(
      `M2 runtime verification failed: expected authorized arithmetic result ${expected}, received ${actual || '<empty>'}.`,
    )
  }

  console.log(`Events: ${eventTypes.join(' -> ')}`)
  console.log('Authorized arithmetic runtime path: M2 marker and exact numeric result verified.')
}

try {
  await verifyCapabilityGrantGate()
  await verifyRuntimeToolPath()
  console.log('M2 automated deployment verification passed.')
} catch (error) {
  console.error(error instanceof Error ? error.message : 'M2 deployment verification failed.')
  process.exit(1)
}
