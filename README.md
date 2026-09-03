# ALOHA Assistant

ALOHA Assistant is a personal AI assistant and the primary personal interaction surface in the Verinasci project family.

This repository owns the **ALOHA product**: first-party client experience, Gateway（网关）, ALOHA Agent Control（智能体控制层）, ALOHA Interaction Protocol（交互协议）, Canonical Run Envelope（规范运行信封）, Runtime Adapter（运行时适配器）and ALOHA-managed Capability（ALOHA 管理能力）paths. It does **not** implement a generic Agent Framework.

The MVP Runtime is **n8n Agent**. ALOHA controls the n8n workflow and adapts it to ALOHA's stable Runtime Contract rather than making n8n-native workflow/session structures into product semantics.

## Open-source repository

ALOHA is developed as an open-source project under **AGPL-3.0-or-later**. Public source and documentation must never contain private user data, real conversation/memory content, credentials, production datasets, private infrastructure identifiers or live provider configuration. Examples and fixtures must remain synthetic.

Contributors and coding agents must read `AGENTS.md` and the nearest nested `AGENTS.md` before changing code.

## Product boundary

ALOHA retains independent control over:

- first-party PWA/client interaction;
- ALOHA Interaction Protocol and canonical Run events;
- Gateway and channel adaptation;
- Conversation（会话）/ Run（执行）product state;
- Agent Control and Canonical Run Envelope v1;
- Context（上下文）needed by a concrete Run;
- ALOHA product Confirmation（确认）policy;
- ALOHA-managed Capabilities when ALOHA exposes a mediated execution path.

LifeSpace remains the authority for Identity（身份）, Principal（权限主体）, Actor（执行者）, Application Context（应用上下文）, Space/Grant and Shared Reality（共享现实）. ALOHA does not duplicate those platform responsibilities.

## Core architecture

```text
First-party PWA / future clients
              |
              v
       Gateway（网关）
  ALOHA Interaction Protocol
              |
              v
 Agent Control（智能体控制层） <---- LifeSpace Identity
  Conversation / Run state
  Identity / Context / Policy
              |
              v
Canonical Run Envelope v1
              |
              v
 Runtime Adapter（运行时适配器）
              |
              v
     n8n Agent Workflow
      (MVP Runtime)
              |
      +-------+--------+
      |       |        |
      v       v        v
 LifeSpace   n8n     other Tools
 Core Tool  Workflow
```

The stable boundaries are:

- **Gateway -> Agent Control:** ALOHA Interaction Protocol.
- **Agent Control -> Runtime Adapter:** Canonical Run Envelope v1.
- **Runtime Adapter -> Runtime:** backend-specific mapping only.

Agent Control does not own the model reasoning loop or generic Tool Loop.

## Canonical Run Envelope v1

M3 defines the first explicit southbound ALOHA contract in `packages/contracts/src/runtime.ts` and documents it in [`docs/canonical-run-envelope.md`](./docs/canonical-run-envelope.md).

The envelope contains only fields required by the current product slice:

- Run identity: `requestId`, `conversationId`, `runId`;
- input: text and the already-defined attachment surface;
- trusted execution identity: LifeSpace User Principal + ALOHA Agent Actor + ALOHA Application;
- current concrete Context: `channel: web`;
- evaluated ALOHA-managed Capability descriptors.

The Envelope is not a prompt. The n8n Runtime Adapter forwards it nearly unchanged to the controlled n8n Agent workflow.

## Conversation / Run state

Conversation / Run are ALOHA product state, not LifeSpace Shared Reality. M3 persists them in a SQLite-backed Cloudflare Durable Object（持久对象） sharded by the trusted LifeSpace `usr_*` Principal.

This preserves the lifecycle in [`docs/conversation-run-lifecycle.md`](./docs/conversation-run-lifecycle.md), including:

- durable Conversation and Run identities;
- `accepted -> running -> completed/failed` lifecycle;
- same-conversation replacement only Supersedes the old Run after the new Run is admitted;
- late output from a Superseded/Stopped Run may be retained but can never resurrect that Run or clear a newer active Run.

## LifeSpace Identity boundary

For a real authenticated product Run:

```text
Principal（权限主体） = LifeSpace User / usr_*
Actor（执行者）       = ALOHA Agent / agt_*
Application（应用）  = registered ALOHA LifeSpace Application
```

Agent Control resolves this tuple server-side from the original Cloudflare Access assertion through LifeSpace Identity using the ALOHA server-only `lsa_*` credential. Client-supplied `userId`, Access `sub`, email, scopes or grants are never authority.

The raw Access assertion, `lsa_*` application credential and delegated LifeSpace Agent token are never sent to n8n or persisted as Conversation / Run data.

## Runtime and Tool boundary

The only MVP Runtime is **n8n Agent**. Future Hermes/OpenClaw/custom Runtime integrations remain post-MVP and must adapt to ALOHA's contract rather than redefine it.

Keep two capability classes distinct:

- **ALOHA-managed Capability** — mediated by ALOHA, currently proven by M2 `math.calculate`;
- **Runtime Tool** — configured directly for the Runtime, such as the upcoming LifeSpace Core Tool or a useful n8n Workflow Tool.

LifeSpace Core remains a Tool provider, not an internal Agent Control service.

## MVP execution order

1. **M0/M1 — complete:** first text Interaction path and real n8n Agent Runtime bootstrap.
2. **M2 — complete and production-verified:** `math.calculate` is exercised through the real Gateway -> Agent Control -> Capability Grant -> n8n Agent Tool path; production deployment now includes repeatable M1/M2 smoke gates.
3. **M3 — source implemented, deployment activation next:** Canonical Run Envelope v1, trusted LifeSpace Identity binding and durable Conversation / Run state are implemented and covered by CI. Production identity acceptance still requires deployment-local LifeSpace application/Agent provisioning and Worker configuration.
4. **M4 — real personal-assistant Tools:** connect the first useful Runtime Tool provider, with LifeSpace Core preferred for the representative first domain scenario.
5. **M5 — first Confirmation-required action:** implement the minimum Confirmation flow when the first real mutating/high-impact action requires it.
6. **MVP Client — parallel:** complete State-first Current Work Surface, Desktop/Mobile Composer, text/image submission and normalized Run/error/confirmation presentation.
7. **MVP closure:** deployed end-to-end acceptance, failure/deny paths, public-repository safety and usability validation.

## Sources of truth

- `README.md` — product boundary and MVP target
- [`docs/architecture.md`](./docs/architecture.md) — current architecture and implementation order
- [`docs/canonical-run-envelope.md`](./docs/canonical-run-envelope.md) — Canonical Run Envelope v1 + persistent Conversation / Run representation
- [`docs/conversation-run-lifecycle.md`](./docs/conversation-run-lifecycle.md) — Conversation / Run product lifecycle
- [`docs/interaction-protocol.md`](./docs/interaction-protocol.md) — first-party Interaction Protocol
- [`docs/runtime-trust-authority.md`](./docs/runtime-trust-authority.md) — Runtime trust/authority boundary
- [`docs/n8n-runtime.md`](./docs/n8n-runtime.md) — n8n Runtime integration
- [`docs/direct-capability.md`](./docs/direct-capability.md) — M2 Direct Capability boundary
- `packages/contracts` — code-owned interaction/capability/runtime contracts

## Repository layout

```text
apps/web/                 # Vue 3 + Vite PWA
workers/gateway/          # public Gateway + production Web assets
workers/agent-control/    # Identity, Conversation/Run, Envelope, Runtime selection
packages/contracts/       # shared ALOHA contracts
packages/capabilities/    # ALOHA-managed capability registry/adapters
packages/runtime-n8n/     # MVP n8n Runtime Adapter
docs/                     # normative product/architecture specifications
```

## Development

```bash
npm install
npm run dev:web
npm run dev:gateway
npm run dev:agent-control
npm run check
```

See [`docs/development.md`](./docs/development.md) for deployment and private configuration rules.
