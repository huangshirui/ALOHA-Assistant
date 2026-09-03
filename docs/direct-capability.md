# Direct Capability — M2 first slice

> Status: **source implementation and deployment recipe for the first ALOHA Direct Capability（直接能力）**.

## Goal

M2 proves that the selected Runtime Backend can call one **ALOHA-managed Capability（ALOHA 管理能力）** through a narrow mediated invocation path without receiving broad ALOHA authority:

```text
PWA
  -> Gateway
  -> Agent Control
       |- selects ALOHA-managed capabilities for the current Run
       |- mints a short-lived capability grant
       `-> n8n Runtime Adapter
            -> n8n Agent
                 -> Math Calculate HTTP Tool
                      -> Gateway
                           -> Agent Control
                                -> math.calculate
```

The important result is not merely that arithmetic works. The result is that **for this ALOHA-managed capability path**, Agent Control chooses what it exposes, n8n receives only the narrow invocation descriptor for that capability, and the mediated invocation is rejected without the grant for that Run.

This does **not** imply that Agent Control can remove or restrict Runtime-native Tools（运行时原生工具）, credentials, MCP servers, shell/network access or other authority independently configured in n8n or another Runtime Backend. See `docs/runtime-trust-authority.md`.

## First capability: `math.calculate`

The first Direct Tool（直接工具） is intentionally deterministic and low-risk:

- id: `math.calculate`
- name: `Math Calculate`
- operations: `add`, `subtract`, `multiply`, `divide`
- input: two finite numeric operands plus one operation
- output: one numeric value
- required scopes: none
- risk: `low`
- confirmation: `never`
- execution mode: `sync`
- external provider/domain dependency: none

This capability is deliberately authority-free. M2 therefore does **not** invent a fake Principal（权限主体） or pretend that trusted LifeSpace Identity / Grant integration already exists. Capabilities that require user/domain authority remain gated on the later trusted Identity slice.

`math.calculate` is a technical proving capability, not the representative long-term reason for ALOHA Capability infrastructure. After deployment verification, the next architecture milestone is **Canonical Run Envelope v1 + Conversation / Run state + LifeSpace Identity binding**, rather than expanding arithmetic into a generic permission model.

## Canonical capability metadata

ALOHA Capability definitions now carry the minimum metadata required by the current architecture:

- stable capability `id` and display `name`;
- description;
- input and output JSON Schema;
- required scopes;
- risk classification;
- confirmation policy;
- execution mode;
- execution adapter/function.

`packages/capabilities` owns this ALOHA-side definition/adapter layer. Runtime-specific translation remains outside canonical Capability ownership.

## Runtime exposure

Agent Control computes the current **ALOHA-managed** allowed set from the authority/context available for the Run. In M2 the trusted authority context is intentionally empty, so only capabilities with:

- no required scopes; and
- `confirmation: never`

can be exposed through the ALOHA-managed path.

If `CAPABILITY_GRANT_SIGNING_KEY` is not configured, Agent Control exposes **zero ALOHA-managed runtime capabilities**. Missing deployment configuration therefore fails closed for this mediated path rather than silently granting authority.

The n8n Runtime receives a descriptor similar to this synthetic example:

```json
{
  "id": "math.calculate",
  "name": "Math Calculate",
  "description": "Perform one deterministic arithmetic operation...",
  "inputSchema": {
    "type": "object"
  },
  "invocation": {
    "type": "http",
    "method": "POST",
    "url": "https://gateway.example.invalid/v1/runtime/capabilities/math.calculate/invoke",
    "authorization": "Bearer <short-lived-run-grant>"
  }
}
```

The URL above is intentionally synthetic. Live origins and grant values are never committed.

## Capability Grant（能力授权令牌）

For M2, Agent Control uses a minimal HMAC-SHA-256 signed grant rather than giving n8n a static broad ALOHA credential.

The signed claims bind the grant to:

- one capability id;
- one ALOHA `runId`;
- the ALOHA application id;
- the scopes already admitted for that Run;
- a short expiry (currently five minutes).

The Gateway only routes the HTTP invocation to internal Agent Control. It does not decide whether the capability is allowed. Agent Control verifies the signature, expiry, capability id and admitted scopes before execution.

This M2 grant is intentionally sufficient only for the first **idempotent, low-risk** capability. A short-lived grant can be replayed during its validity window. That is acceptable for deterministic arithmetic, but must not be assumed safe for mutating or high-impact capabilities. Those later capabilities need the minimum confirmation, idempotency and replay controls required by their real product/domain behavior.

The grant is an ALOHA invocation mechanism, not a replacement for downstream domain authorization. When a later capability acts on LifeSpace-owned data, LifeSpace remains responsible for the final current-state Principal / Actor / Application authorization check.

## Public endpoint boundary

The runtime-callable transport route is:

```text
POST /v1/runtime/capabilities/:capabilityId/invoke
Authorization: Bearer <run-scoped capability grant>
Content-Type: application/json

{
  "input": { ... }
}
```

Successful responses are shaped as:

```json
{
  "capabilityId": "math.calculate",
  "output": {
    "value": 12
  }
}
```

The route is public only because the external n8n Runtime must be able to reach it. Authority for this ALOHA-managed invocation remains in the signed grant and Agent Control verification. The public Gateway remains transport-only.

## n8n M2 workflow

The credential-free import template is:

`examples/n8n/m2-direct-capability.workflow.json`

Topology:

```text
Webhook (POST)
   |
   v
AI Agent ---------------- Chat Model
   |
   +---------------------- Math Calculate (HTTP Request Tool)
   |
   v
Respond to Webhook
```

Unlike the M1 bootstrap workflow, the M2 workflow has **no Runtime Think Tool**. The connected Tool is the real ALOHA Direct Capability.

The HTTP Request Tool obtains its URL and Authorization header from the `math.calculate` descriptor in the incoming trusted Runtime request. `$fromAI()` is used only for the capability input fields (`operation`, `left`, `right`). The n8n workflow does not mint grants or make authorization decisions.

`returnIntermediateSteps` is enabled in the template so deployment verification can confirm that the `Math Calculate` tool was actually called. Intermediate steps remain n8n execution detail and are not promoted into the ALOHA first-party Interaction Protocol in this slice.

The wider n8n instance may contain other workflows or credentials. M2 makes no claim that Agent Control governs those independent Runtime-native surfaces. The ALOHA Agent workflow must still avoid broad independent credentials that would bypass a later ALOHA/LifeSpace authority path.

## Deployment configuration

M2 adds one Agent Control Worker Secret:

- `CAPABILITY_GRANT_SIGNING_KEY` — a high-entropy deployment secret used only to sign/verify short-lived Capability grants.

Keep the existing runtime settings:

- `N8N_AGENT_WEBHOOK_URL`
- `N8N_AGENT_AUTH_TOKEN`

Do not commit any live value, derived grant, n8n execution payload, private hostname, or user content.

After importing the M2 workflow, attach the existing Header Auth and Chat Model credentials, publish it, and update `N8N_AGENT_WEBHOOK_URL` to the M2 production Webhook URL if its path changed.

## Acceptance test

M2 is deployed-verified only when all of the following are true:

1. `CAPABILITY_GRANT_SIGNING_KEY` exists only as Agent Control deployment secret;
2. the M2 n8n workflow is imported/published with deployment-local credentials;
3. an arithmetic Interaction such as `What is 7 + 5?` traverses PWA -> Gateway -> Agent Control -> n8n Agent;
4. the Runtime request contains the **ALOHA-managed capability descriptor set** admitted for the Run, including `math.calculate`, without implying anything about independently configured Runtime-native tools;
5. n8n intermediate steps show the `Math Calculate` Tool was actually invoked;
6. the invocation returns the ALOHA capability result and the Agent produces the correct user-facing answer;
7. invoking the public capability route without a grant returns `401`;
8. a tampered grant returns `401`;
9. invalid math input fails safely without exposing internal exception detail;
10. no live endpoint, secret, grant, execution payload or personal data is committed to the public repository.

Once these checks pass, **M2 is complete**. Do not extend M2 into generic Runtime tool confinement, generic capability negotiation or LifeSpace authorization work.

## Deliberately deferred

M2 does not claim:

- trusted Principal / Actor resolution from LifeSpace;
- user/domain scopes or grants;
- control over Runtime-native tools or independently held Runtime credentials;
- confirmation / approval flows;
- mutating capabilities;
- replay protection suitable for mutations;
- a generic Capability framework;
- dynamic n8n tool-node generation for arbitrary future capabilities;
- a second Runtime Backend;
- a n8n Workflow Capability（工作流能力）.

The next MVP slice after M2 deployment verification is **Canonical Run Envelope v1 + Conversation / Run persistence + LifeSpace Identity binding**. Real LifeSpace Core / n8n Workflow capabilities are then added as Runtime Tools according to product value; Confirmation is introduced only when the first real action requires it.
