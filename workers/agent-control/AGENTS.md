# ALOHA Agent Control Instructions

`workers/agent-control` is the ALOHA-specific Agent Control（智能体控制层）service. It owns ALOHA product semantics around an Agent run; it is **not** a generic Agent Runtime / framework and does not require ALOHA to implement its own model/tool loop.

In the current Cloudflare MVP deployment, Agent Control is an internal-only Worker with no public `workers.dev` or preview URL. Gateway reaches it through a Service Binding（服务绑定）. Runtime backend secrets are configured on this Worker after its first infrastructure deployment; until configured, the explicit `runtime_backend_not_configured` state remains valid and must not be presented as a working n8n integration.

M2 Direct Capability invocation uses deployment-only `CAPABILITY_GRANT_SIGNING_KEY` to mint and verify short-lived, Run-scoped Capability Grants（能力授权令牌）. If the signing key is absent, expose no runtime-callable capabilities. Never replace these narrow grants with a static broad Runtime credential merely for convenience.

## Rules

- Own verified Identity / Principal context, authorization context, Context Envelope assembly/policy, Capability exposure policy, confirmation policy, Conversation / Run product semantics, Runtime selection and canonical event normalization.
- Call Agent Runtime backends only through an explicit Runtime Contract / adapter boundary. Runtime backends may be Hermes Agent, OpenClaw, an n8n Agent workflow, OpenAI-compatible runtimes, Cloudflare Agents, a custom Python/TypeScript runtime, or future implementations.
- Do not let a backend-specific session, event, SDK type or persistence model become ALOHA's product contract.
- Do not trust client-supplied principal IDs, grants or scopes as authority. Identity/authorization must be derived at trusted boundaries and preserved through runtime/capability calls.
- Client-provided context such as location, device state or selections may be accepted as contextual input, but must preserve source/freshness/consent semantics and must never become authorization authority.
- Expose only the Capability set allowed by the verified Principal × ALOHA Application scope × current policy intersection.
- High-impact mutations must preserve an explicit confirmation/approval path unless a deliberately scoped automation policy permits otherwise.
- Normalize backend-native output into ALOHA canonical Run / Stream Events for clients and channels.
- Do not persist durable Shared Reality, long-term memory or delegated-work infrastructure locally when those responsibilities belong to LifeSpace, Poina or Relay.
- A Runtime backend may also call n8n as a Capability; separately, an n8n Agent workflow may itself be selected as a Runtime backend. Keep those two roles explicit.
- Treat the current M2 grant replay window as acceptable only for low-risk idempotent capabilities such as `math.calculate`; mutating or high-impact capabilities require confirmation/idempotency/replay semantics before exposure.
