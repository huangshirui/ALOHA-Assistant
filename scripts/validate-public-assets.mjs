import { readFile } from 'node:fs/promises'

const readWorkflow = async (relativePath) => {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
  return JSON.parse(source)
}

const fail = (message) => {
  console.error(`Public asset validation failed: ${message}`)
  process.exit(1)
}

const assertNoCredentials = (workflow, label) => {
  const serialized = JSON.stringify(workflow)

  if (serialized.includes('"credentials"')) {
    fail(`${label} must not contain credential references`)
  }
}

const assertNode = (nodeByName, name, type, label) => {
  const node = nodeByName.get(name)

  if (!node || node.type !== type) {
    fail(`${label} missing expected node: ${name}`)
  }

  return node
}

const validateM1 = async () => {
  const workflow = await readWorkflow('../examples/n8n/m1-agent-runtime.workflow.json')

  if (!Array.isArray(workflow.nodes)) {
    fail('M1 workflow.nodes must be an array')
  }

  const nodeByName = new Map(workflow.nodes.map((node) => [node.name, node]))
  const webhook = assertNode(
    nodeByName,
    'ALOHA Runtime Webhook',
    'n8n-nodes-base.webhook',
    'M1',
  )
  assertNode(
    nodeByName,
    'AI Agent',
    '@n8n/n8n-nodes-langchain.agent',
    'M1',
  )
  assertNode(
    nodeByName,
    'Example Chat Model',
    '@n8n/n8n-nodes-langchain.lmChatOpenAi',
    'M1',
  )
  assertNode(
    nodeByName,
    'Runtime Think Tool',
    '@n8n/n8n-nodes-langchain.toolThink',
    'M1',
  )
  const responseNode = assertNode(
    nodeByName,
    'Normalize Runtime Result',
    'n8n-nodes-base.respondToWebhook',
    'M1',
  )

  if (
    webhook.parameters?.authentication !== 'headerAuth' ||
    webhook.parameters?.responseMode !== 'responseNode'
  ) {
    fail('M1 Webhook must require Header Auth and Respond to Webhook mode')
  }

  const responseBody = responseNode.parameters?.responseBody
  if (
    typeof responseBody !== 'string' ||
    !responseBody.includes('outputText') ||
    !responseBody.includes('backendRunId')
  ) {
    fail('M1 Respond to Webhook must normalize outputText and backendRunId')
  }

  const thinkConnections = workflow.connections?.['Runtime Think Tool']?.ai_tool?.[0]
  if (
    !Array.isArray(thinkConnections) ||
    !thinkConnections.some(
      (connection) =>
        connection.node === 'AI Agent' && connection.type === 'ai_tool',
    )
  ) {
    fail('M1 Runtime Think Tool must be connected to AI Agent as ai_tool')
  }

  assertNoCredentials(workflow, 'M1 workflow template')
}

const validateM2 = async () => {
  const workflow = await readWorkflow('../examples/n8n/m2-direct-capability.workflow.json')

  if (!Array.isArray(workflow.nodes)) {
    fail('M2 workflow.nodes must be an array')
  }

  const nodeByName = new Map(workflow.nodes.map((node) => [node.name, node]))
  const webhook = assertNode(
    nodeByName,
    'ALOHA Runtime Webhook',
    'n8n-nodes-base.webhook',
    'M2',
  )
  assertNode(
    nodeByName,
    'AI Agent',
    '@n8n/n8n-nodes-langchain.agent',
    'M2',
  )
  assertNode(
    nodeByName,
    'Example Chat Model',
    '@n8n/n8n-nodes-langchain.lmChatOpenAi',
    'M2',
  )
  const mathTool = assertNode(
    nodeByName,
    'Math Calculate',
    'n8n-nodes-base.httpRequestTool',
    'M2',
  )
  const responseNode = assertNode(
    nodeByName,
    'Normalize Runtime Result',
    'n8n-nodes-base.respondToWebhook',
    'M2',
  )

  if (
    webhook.parameters?.authentication !== 'headerAuth' ||
    webhook.parameters?.responseMode !== 'responseNode'
  ) {
    fail('M2 Webhook must require Header Auth and Respond to Webhook mode')
  }

  const toolSerialized = JSON.stringify(mathTool.parameters)
  if (
    mathTool.parameters?.method !== 'POST' ||
    !toolSerialized.includes('math.calculate') ||
    !toolSerialized.includes('invocation.url') ||
    !toolSerialized.includes('invocation.authorization') ||
    !toolSerialized.includes("$fromAI('operation'") ||
    !toolSerialized.includes("$fromAI('left'") ||
    !toolSerialized.includes("$fromAI('right'")
  ) {
    fail('M2 Math Calculate must use the runtime-supplied invocation and AI-filled arithmetic input')
  }

  const mathConnections = workflow.connections?.['Math Calculate']?.ai_tool?.[0]
  if (
    !Array.isArray(mathConnections) ||
    !mathConnections.some(
      (connection) =>
        connection.node === 'AI Agent' && connection.type === 'ai_tool',
    )
  ) {
    fail('M2 Math Calculate must be connected to AI Agent as ai_tool')
  }

  const responseBody = responseNode.parameters?.responseBody
  if (
    typeof responseBody !== 'string' ||
    !responseBody.includes('outputText') ||
    !responseBody.includes('backendRunId')
  ) {
    fail('M2 Respond to Webhook must normalize outputText and backendRunId')
  }

  if (nodeByName.has('Runtime Think Tool')) {
    fail('M2 must prove the direct capability instead of retaining the bootstrap Think Tool')
  }

  assertNoCredentials(workflow, 'M2 workflow template')
}

await validateM1()
await validateM2()

console.log('Public runtime assets validated.')
