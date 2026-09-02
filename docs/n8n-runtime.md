# n8n Agent Runtime — M1 bootstrap

> Status: **external deployment recipe for the first text vertical slice**. ALOHA owns the Runtime Contract; this document describes the smallest n8n workflow that satisfies that contract without prematurely adding business Capabilities.

## Goal

Prove the deployed path:

`PWA -> Gateway -> Agent Control -> @aloha/runtime-n8n -> n8n Agent -> model -> normalized JSON -> ALOHA events -> PWA`

This is an integration verification step, not a new ALOHA product protocol.

## Current n8n constraint

Current n8n AI Agent nodes operate as Tools Agents and require a connected tool. M1 deliberately does **not** expose LifeSpace, HomeMew, n8n Workflow Capabilities, or other business tools yet.

For this bootstrap workflow, connect n8n's **Think Tool** to the AI Agent. Treat it as a Runtime-internal reasoning aid with no external business authority or side effect. It is **not** an ALOHA Capability and must not be used as evidence that Capability authorization is implemented.

Do not add a real business tool only to satisfy the n8n node requirement. Real Capability exposure remains a later vertical slice controlled by Agent Control.

## Workflow topology

Create one n8n workflow with this topology:

```text
Webhook (POST)
   |
   v
AI Agent ---------------- Chat Model
   |
   +---------------------- Think Tool
   |
   v
Respond to Webhook
```

The Chat Model provider is intentionally not frozen by ALOHA. Use an existing supported chat-model credential in the n8n deployment. Provider selection is Runtime configuration, not part of the ALOHA Interaction Protocol.

## Importable bootstrap template

A credential-free template is tracked at:

`examples/n8n/m1-agent-runtime.workflow.json`

Import it into the target n8n instance, then complete only deployment-local configuration:

1. open `ALOHA Runtime Webhook` and attach a Header Auth credential whose value is the deployment secret expected by Agent Control;
2. open `Example Chat Model`, attach a real model credential, and change the model/provider if desired;
3. keep `Runtime Think Tool` connected as a Runtime-internal tool only;
4. validate the `Normalize Runtime Result` output shape;
5. publish/activate the workflow and use the production Webhook URL for `N8N_AGENT_WEBHOOK_URL`.

The template intentionally includes no credential IDs, credential names, live URLs, private hostnames, user content, or deployment-specific identifiers. The OpenAI Chat Model node is only an importable example; replacing it with another n8n-supported Chat Model does not change the ALOHA Runtime Contract.

## 1. Webhook

Configure a Webhook trigger:

- HTTP Method: `POST`
- Path: choose a deployment-specific path; do not commit the resulting live URL to this public repository
- Authentication: Header Auth
- Header name: `Authorization`
- Header value: `Bearer <deployment secret>`
- Respond: `Using Respond to Webhook Node`

The secret value must match the deployment-only `N8N_AGENT_AUTH_TOKEN` injected into Agent Control. Never commit the value.

The adapter sends a request shaped as:

```json
{
  "schemaVersion": 1,
  "run": {
    "requestId": "synthetic-request-id",
    "runId": "synthetic-run-id",
    "conversationId": "synthetic-conversation-id"
  },
  "input": {
    "text": "Hello ALOHA"
  },
  "capabilities": []
}
```

For a normal Webhook trigger, the JSON request body is available under the Webhook item's `body` field. The AI Agent prompt for M1 should therefore read the normalized text input from the webhook body, for example:

```text
{{ $json.body.input.text }}
```

Do not build authorization decisions from arbitrary request-body fields in this workflow.

## 2. AI Agent

Use the current AI Agent node and connect:

- one supported Chat Model;
- one Think Tool;
- no external business tools for M1;
- no persistent memory for this first single-turn integration verification.

Use `Define below` / explicit prompt input and pass the request text from `body.input.text`.

A minimal bootstrap system instruction may identify the runtime as the ALOHA Assistant execution backend, but it must not contain personal data, secrets, live infrastructure identifiers, or authorization claims. Product identity/authorization/context policy belongs to Agent Control and later Context Envelope work.

Expected AI Agent output for this slice is a text result in the normal Agent `output` field.

## 3. Respond to Webhook

Configure Respond to Webhook:

- Respond With: `JSON`
- Response Code: `200`
- Response body: an object containing exactly the fields the ALOHA n8n adapter currently depends on

Conceptually:

```json
{
  "outputText": "<AI Agent output>",
  "backendRunId": "<n8n execution id>"
}
```

Use n8n expressions so `outputText` comes from the AI Agent output and `backendRunId` comes from the current n8n execution ID.

`backendRunId` is optional correlation only. It must never replace ALOHA's `runId`.

## Deployment configuration

After the workflow is published, configure Agent Control outside source control:

- `N8N_AGENT_WEBHOOK_URL` = the n8n **production** Webhook URL
- `N8N_AGENT_AUTH_TOKEN` = the same secret expected by Webhook Header Auth

Do not place either value in committed `.env`, Wrangler config, examples, screenshots, issues, PR comments, test fixtures, or Notion engineering logs.

`VITE_GATEWAY_URL` is unrelated to the n8n endpoint: it points the browser at the public ALOHA Gateway and may be browser-visible.

## Integration acceptance test

The deployed M1 runtime is verified only when all of the following are true:

1. a text Interaction submitted from the PWA reaches Gateway and Agent Control;
2. Agent Control emits `run.started`;
3. the n8n production Webhook authenticates the adapter request;
4. the n8n AI Agent executes with its Chat Model and Runtime-internal Think Tool;
5. n8n returns a JSON object containing non-empty `outputText`;
6. Agent Control normalizes that result into `output.delta` followed by `run.completed`;
7. the PWA displays the result in the Current Work Surface;
8. no live endpoint, token, user content, model credential, or private n8n execution payload is committed to the public repository.

Failure cases should also be checked at least once:

- invalid/missing n8n authentication does not expose backend details to the PWA;
- n8n 5xx becomes `run.failed` with a safe ALOHA error;
- malformed n8n JSON becomes `run.failed` rather than leaking provider-native payloads.

After the deployed Gateway and Runtime are configured, the repository verifier can check the canonical event path:

```bash
ALOHA_GATEWAY_URL=https://gateway.example.com npm run verify:m1-runtime
```

The verifier sends synthetic text only and expects `run.started -> output.delta -> run.completed` with non-empty output. It intentionally does not contain or print n8n credentials. If the deployed Gateway itself requires additional interactive/access authentication, perform the same acceptance check from the PWA or an appropriately authenticated local environment rather than weakening Gateway authentication for the verifier.

## Deliberately deferred

M1 bootstrap does not claim:

- Conversation memory inside n8n;
- same-conversation supersession / cancellation;
- ALOHA Capability authorization;
- LifeSpace or HomeMew access;
- confirmations / approvals;
- image/file/voice/location context;
- direct token-by-token passthrough from n8n streaming.

n8n supports streaming Webhook/AI Agent responses, but ALOHA slice 1 intentionally accepts a normalized JSON result and emits it as a streaming-compatible `output.delta`. Native n8n streaming can be evaluated only when it materially improves the ALOHA contract rather than leaking backend transport semantics northbound.

## References

- n8n AI Agent node documentation: https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/
- n8n Think Tool documentation: https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.toolthink/
- n8n Webhook documentation: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/
- n8n Respond to Webhook documentation: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/
