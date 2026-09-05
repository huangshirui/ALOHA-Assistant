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

const validateWebhookAndResponse = (nodeByName, label) => {
  const webhook = assertNode(
    nodeByName,
    'ALOHA Runtime Webhook',
    'n8n-nodes-base.webhook',
    label,
  )
  const responseNode = assertNode(
    nodeByName,
    'Normalize Runtime Result',
    'n8n-nodes-base.respondToWebhook',
    label,
  )

  if (
    webhook.parameters?.authentication !== 'headerAuth' ||
    webhook.parameters?.responseMode !== 'responseNode'
  ) {
    fail(`${label} Webhook must require Header Auth and Respond to Webhook mode`)
  }

  const responseBody = responseNode.parameters?.responseBody
  if (
    typeof responseBody !== 'string' ||
    !responseBody.includes('outputText') ||
    !responseBody.includes('backendRunId')
  ) {
    fail(`${label} Respond to Webhook must normalize outputText and backendRunId`)
  }
}

const validateM1 = async () => {
  const workflow = await readWorkflow('../examples/n8n/m1-agent-runtime.workflow.json')

  if (!Array.isArray(workflow.nodes)) {
    fail('M1 workflow.nodes must be an array')
  }

  const nodeByName = new Map(workflow.nodes.map((node) => [node.name, node]))
  validateWebhookAndResponse(nodeByName, 'M1')
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
  validateWebhookAndResponse(nodeByName, 'M2')
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

  if (nodeByName.has('Runtime Think Tool')) {
    fail('M2 must prove the direct capability instead of retaining the bootstrap Think Tool')
  }

  assertNoCredentials(workflow, 'M2 workflow template')
}

const validateM4 = async () => {
  const workflow = await readWorkflow('../examples/n8n/m4-lifespace-read-tool.workflow.json')

  if (!Array.isArray(workflow.nodes)) {
    fail('M4 workflow.nodes must be an array')
  }

  const nodeByName = new Map(workflow.nodes.map((node) => [node.name, node]))
  validateWebhookAndResponse(nodeByName, 'M4')
  const agent = assertNode(
    nodeByName,
    'AI Agent',
    '@n8n/n8n-nodes-langchain.agent',
    'M4',
  )
  assertNode(
    nodeByName,
    'Example Chat Model',
    '@n8n/n8n-nodes-langchain.lmChatOpenAi',
    'M4',
  )
  const discoveryTool = assertNode(
    nodeByName,
    'LifeSpace Discover',
    'n8n-nodes-base.httpRequestTool',
    'M4',
  )
  const queryTool = assertNode(
    nodeByName,
    'LifeSpace Query',
    'n8n-nodes-base.httpRequestTool',
    'M4',
  )

  const discoverySerialized = JSON.stringify(discoveryTool.parameters)
  const querySerialized = JSON.stringify(queryTool.parameters)
  if (
    discoveryTool.parameters?.method !== 'POST' ||
    !discoverySerialized.includes('lifespace.read') ||
    !discoverySerialized.includes('invocation.url') ||
    !discoverySerialized.includes('invocation.authorization') ||
    !discoverySerialized.includes("operation: 'discover'")
  ) {
    fail('M4 LifeSpace Discover must use the runtime-supplied read Tool invocation')
  }

  if (
    queryTool.parameters?.method !== 'POST' ||
    !querySerialized.includes('lifespace.read') ||
    !querySerialized.includes("operation: 'query'") ||
    !querySerialized.includes("$fromAI('spaceId'") ||
    !querySerialized.includes("$fromAI('modelRoute'") ||
    !querySerialized.includes("$fromAI('search'") ||
    !querySerialized.includes("$fromAI('limit'")
  ) {
    fail('M4 LifeSpace Query must use discovery-selected identifiers and AI-filled read query input')
  }

  for (const name of ['LifeSpace Discover', 'LifeSpace Query']) {
    const connections = workflow.connections?.[name]?.ai_tool?.[0]
    if (
      !Array.isArray(connections) ||
      !connections.some(
        (connection) =>
          connection.node === 'AI Agent' && connection.type === 'ai_tool',
      )
    ) {
      fail(`M4 ${name} must be connected to AI Agent as ai_tool`)
    }
  }

  const systemMessage = agent.parameters?.options?.systemMessage
  if (
    typeof systemMessage !== 'string' ||
    !systemMessage.includes('LifeSpace Discover') ||
    !systemMessage.includes('Do not attempt mutations')
  ) {
    fail('M4 AI Agent must explicitly treat discovery as prerequisite guidance and remain read-only')
  }

  if (querySerialized.includes('lsp_pat_') || querySerialized.includes('lsa_')) {
    fail('M4 workflow must not contain a LifeSpace credential')
  }

  assertNoCredentials(workflow, 'M4 workflow template')
}

await validateM1()
await validateM2()
await validateM4()

console.log('Public runtime assets validated.')
