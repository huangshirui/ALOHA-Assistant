const gatewayUrl = (process.env.ALOHA_GATEWAY_URL ?? '').replace(/\/$/, '')
const text =
  process.env.ALOHA_VERIFY_TEXT ??
  'Reply with a short confirmation that the ALOHA M1 runtime path is working.'

if (!gatewayUrl) {
  console.error('ALOHA_GATEWAY_URL is required.')
  process.exit(2)
}

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
  console.error(`Interaction request failed with HTTP ${response.status}.`)
  process.exit(1)
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

try {
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
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Interaction stream failed.')
  process.exit(1)
}

const eventTypes = events.map((event) => event.type)
const started = eventTypes.includes('run.started')
const completed = eventTypes.includes('run.completed')
const hasOutput = output.trim().length > 0

console.log(`Events: ${eventTypes.join(' -> ')}`)
console.log(`Output: ${output.trim() || '(empty)'}`)

if (!started || !completed || !hasOutput) {
  console.error('M1 runtime verification failed: expected started, output, and completed events.')
  process.exit(1)
}

console.log('M1 runtime verification passed.')
