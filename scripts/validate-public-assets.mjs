import { readFile } from 'node:fs/promises'

const readText = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), 'utf8')

const readWorkflow = async (relativePath) => {
  const source = await readText(relativePath)
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
  const describeTool = assertNode(
    nodeByName,
    'LifeSpace Describe',
    'n8n-nodes-base.httpRequestTool',
    'M4',
  )
  const queryTool = assertNode(
    nodeByName,
    'LifeSpace Query',
    'n8n-nodes-base.httpRequestTool',
    'M4',
  )
  const getTool = assertNode(
    nodeByName,
    'LifeSpace Get',
    'n8n-nodes-base.httpRequestTool',
    'M4',
  )

  const discoverySerialized = JSON.stringify(discoveryTool.parameters)
  const describeSerialized = JSON.stringify(describeTool.parameters)
  const querySerialized = JSON.stringify(queryTool.parameters)
  const getSerialized = JSON.stringify(getTool.parameters)
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
    describeTool.parameters?.method !== 'POST' ||
    !describeSerialized.includes('lifespace.read') ||
    !describeSerialized.includes("operation: 'describe'") ||
    !describeSerialized.includes("$fromAI('spaceId'") ||
    !describeSerialized.includes("$fromAI('modelKey'")
  ) {
    fail('M4 LifeSpace Describe must load semantics for a discovery-selected model key')
  }

  if (
    queryTool.parameters?.method !== 'POST' ||
    !querySerialized.includes('lifespace.read') ||
    !querySerialized.includes("operation: 'query'") ||
    !querySerialized.includes("$fromAI('spaceId'") ||
    !querySerialized.includes("$fromAI('modelKey'") ||
    !querySerialized.includes("search: { text:") ||
    !querySerialized.includes("page: { limit:") ||
    !querySerialized.includes("$fromAI('search'") ||
    !querySerialized.includes("$fromAI('limit'")
  ) {
    fail('M4 LifeSpace Query must lower discovery-selected modelKey plus AI search/page input to Canonical Query')
  }

  if (
    getTool.parameters?.method !== 'POST' ||
    !getSerialized.includes('lifespace.read') ||
    !getSerialized.includes("operation: 'get'") ||
    !getSerialized.includes("$fromAI('spaceId'") ||
    !getSerialized.includes("$fromAI('modelKey'") ||
    !getSerialized.includes("$fromAI('recordId'")
  ) {
    fail('M4 LifeSpace Get must use discovery-selected identifiers and a LifeSpace record ID')
  }

  for (const name of ['LifeSpace Discover', 'LifeSpace Describe', 'LifeSpace Query', 'LifeSpace Get']) {
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
    !systemMessage.includes('LifeSpace Describe') ||
    !systemMessage.includes('Canonical Query') ||
    !systemMessage.includes('Do not attempt mutations')
  ) {
    fail('M4 AI Agent must explicitly treat discovery as prerequisite guidance and remain read-only')
  }

  const toolProjection = [discoverySerialized, describeSerialized, querySerialized, getSerialized].join('\n')
  if (toolProjection.includes('lsp_pat_') || toolProjection.includes('lsa_')) {
    fail('M4 workflow must not contain a LifeSpace credential')
  }
  if (toolProjection.includes('modelRoute')) {
    fail('M4 workflow must use LifeSpace modelKey rather than legacy modelRoute')
  }

  assertNoCredentials(workflow, 'M4 workflow template')
}

const validateM4Deployment = async () => {
  const deployment = await readText('../.github/workflows/deploy.yml')
  const agentControlConfig = await readText('../workers/agent-control/wrangler.jsonc')

  for (const name of [
    'LIFESPACE_IDENTITY_BASE_URL',
    'LIFESPACE_APPLICATION_CREDENTIAL',
    'LIFESPACE_CORE_API_BASE_URL',
    'RUNTIME_TOOL_GRANT_SIGNING_KEY',
  ]) {
    if (!deployment.includes(name)) {
      fail(`M4 deployment gate must account for ${name}`)
    }
  }

  if (
    !deployment.includes('Ensure internal Runtime Tool signing secret') ||
    !deployment.includes('Detect LifeSpace M4 Runtime Tool activation') ||
    !deployment.includes('m3-only') ||
    !deployment.includes('partial')
  ) {
    fail('M4 deployment must preserve fail-closed activation states')
  }

  if (!agentControlConfig.includes('"keep_vars": true')) {
    fail('Agent Control deployment must preserve deployment-only bindings/secrets')
  }

  if (
    agentControlConfig.includes('LIFESPACE_CORE_API_BASE_URL') ||
    agentControlConfig.includes('RUNTIME_TOOL_GRANT_SIGNING_KEY')
  ) {
    fail('M4 optional activation bindings must not be hard-coded into public Wrangler config')
  }
}

await validateM1()
await validateM2()
await validateM4()
await validateM4Deployment()

console.log('Public runtime assets validated.')
