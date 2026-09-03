const gatewayUrl = (process.env.ALOHA_GATEWAY_URL ?? '').replace(/\/$/, '')
const text =
  process.env.ALOHA_VERIFY_TEXT ??
  'Reply with a short confirmation that the ALOHA M1 runtime path is working.'

if (!gatewayUrl) {
  console.error('ALOHA_GATEWAY_URL is required.')
  process.exit(2)
}

const verifySuccessfulRun = async () => {
  const response = await fetch(`${gatewayUrl}/v1/interactions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      requestId: crypto.randomUUID(),
      text,
    }),
  })

  if (!response.ok || !response.body) {
    throw new Error(`Interaction request failed with HTTP ${response.status}.`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const events = []
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
    events.push(event)

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

  const eventTypes = events.map((event) => event.type)
  const startedIndex = eventTypes.indexOf('run.started')
  const outputIndex = eventTypes.indexOf('output.delta')
  const completedIndex = eventTypes.indexOf('run.completed')
  const hasOutput = output.trim().length > 0
  const ordered =
    startedIndex !== -1 &&
    outputIndex > startedIndex &&
    completedIndex > outputIndex

  console.log(`Events: ${eventTypes.join(' -> ')}`)
  console.log(`Output: non-empty (${output.trim().length} chars)`)

  if (!ordered || !hasOutput) {
    throw new Error(
      'M1 runtime verification failed: expected ordered started, output, and completed events with non-empty output.',
    )
  }
}

const verifySafeFailure = async () => {
  const response = await fetch(`${gatewayUrl}/v1/interactions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: '{',
  })

  const body = await response.text()
  let payload

  try {
    payload = JSON.parse(body)
  } catch {
    throw new Error('Safe-failure verification returned a non-JSON response.')
  }

  if (
    response.status !== 400 ||
    payload?.error !== 'invalid_json_body' ||
    Object.keys(payload).length !== 1
  ) {
    throw new Error(
      `Safe-failure verification failed with HTTP ${response.status} or unexpected public error shape.`,
    )
  }

  console.log('Safe failure: controlled invalid_json_body response verified.')
}

try {
  await verifySuccessfulRun()
  await verifySafeFailure()
  console.log('M1 runtime verification passed.')
} catch (error) {
  console.error(error instanceof Error ? error.message : 'M1 runtime verification failed.')
  process.exit(1)
}
