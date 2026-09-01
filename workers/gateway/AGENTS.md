# Gateway Agent Instructions

`workers/gateway` is the thin external transport boundary between channels and ALOHA Agent Runtime.

## Rules

- Own request admission, authentication handoff, protocol normalization, session/stream transport, routing and transport-level errors.
- Do not implement model reasoning, prompt orchestration, capability planning, domain business rules or long-running workflow state here.
- Keep the interaction protocol channel-neutral; PWA-specific presentation fields must not become required runtime semantics.
- Forward only verified/normalized identity and delegated-authority context. Never trust arbitrary client-supplied principal/scopes as authority.
- Prefer explicit Cloudflare Service Bindings or another authenticated internal interface to reach Agent Runtime.
- Keep CORS, rate limiting and transport controls separate from domain authorization.
- Any external protocol change must update `packages/contracts`, affected clients/runtime, tests and `docs/architecture.md` when the boundary changes.