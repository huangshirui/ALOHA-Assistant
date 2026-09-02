# Gateway Agent Instructions

`workers/gateway` is ALOHA's thin external transport and channel boundary. It sits between first-party/third-party channels and ALOHA Agent Control（智能体控制层）; it is not the Agent Runtime.

## Rules

- Own request admission, authentication handoff, channel adaptation, protocol normalization, session/stream transport, routing and transport-level errors.
- Support ALOHA's own first-party Interaction Protocol for progressive/streaming clients while allowing adapters for WeCom, Feishu and future channels.
- Do not implement model reasoning, prompt/tool orchestration, Capability policy, confirmation policy, domain business rules or long-running workflow state here.
- Keep the first-party interaction protocol channel-neutral at its semantic core; channel adapters may degrade unsupported presentation/interaction features explicitly.
- Forward client-provided contextual input only as contextual claims with source/freshness metadata where applicable. Never treat client-supplied principal IDs, grants or scopes as authorization authority.
- Forward only verified/normalized identity and delegated-authority context from trusted boundaries to Agent Control.
- Prefer an explicit Service Binding or another authenticated internal interface to reach Agent Control; do not couple through persistence.
- Keep CORS, rate limiting and transport controls separate from product/domain authorization.
- Any external protocol change must update `packages/contracts`, affected clients/Agent Control, tests and `docs/architecture.md` when the boundary changes.
