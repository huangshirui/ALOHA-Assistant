import { readFile } from 'node:fs/promises'

const workflowPath = new URL(
  '../examples/n8n/m1-agent-runtime.workflow.json',
  import.meta.url,
)
const source = await readFile(workflowPath, 'utf8')
const workflow = JSON.parse(source)

const fail = (message) => {
  console.error(`M1 asset validation failed: ${message}`)
  process.exit(1)
}

if (!Array.isArray(workflow.nodes)) {
  fail('workflow.nodes must be an array')
}

const nodeByName = new Map(workflow.nodes.map((node) => [node.name, node]))
const requiredNodes = [
  ['ALOHA Runtime Webhook', 'n8n-nodes-base.webhook'],
  ['AI Agent', '@n8n/n8n-nodes-langchain.agent'],
  ['Example Chat Model', '@n8n/n8n-nodes-langchain.lmChatOpenAi'],
  ['Runtime Think Tool', '@n8n/n8n-nodes-langchain.toolThink'],
  ['Normalize Runtime Result', 'n8n-nodes-base.respondToWebhook'],
]

for (const [name, type] of requiredNodes) {
  const node = nodeByName.get(name)
  if (!node || node.type !== type) {
    fail(`missing expected node: ${name}`)
  }
}

const webhook = nodeByName.get('ALOHA Runtime Webhook')
if (
  webhook.parameters?.authentication !== 'headerAuth' ||
  webhook.parameters?.responseMode !== 'responseNode'
) {
  fail('Webhook must require Header Auth and Respond to Webhook mode')
}

const responseNode = nodeByName.get('Normalize Runtime Result')
const responseBody = responseNode.parameters?.responseBody
if (
  typeof responseBody !== 'string' ||
  !responseBody.includes('outputText') ||
  !responseBody.includes('backendRunId')
) {
  fail('Respond to Webhook must normalize outputText and backendRunId')
}

const serialized = JSON.stringify(workflow)
if (serialized.includes('"credentials"')) {
  fail('public workflow template must not contain credential references')
}

const thinkConnections = workflow.connections?.['Runtime Think Tool']?.ai_tool?.[0]
if (
  !Array.isArray(thinkConnections) ||
  !thinkConnections.some(
    (connection) =>
      connection.node === 'AI Agent' && connection.type === 'ai_tool',
  )
) {
  fail('Runtime Think Tool must be connected to AI Agent as ai_tool')
}

console.log('M1 public runtime assets validated.')
