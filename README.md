# ALOHA Assistant

ALOHA Assistant is a personal AI assistant and the primary personal interaction surface in the Verinasci project family.

This repository owns the **ALOHA product**: first-party client experience, channel Gateway（网关）, ALOHA Agent Control（智能体控制层）, ALOHA interaction/runtime contracts, and ALOHA-side Capability（能力）adapters. It does **not** require ALOHA to implement or own a generic Agent Runtime / Agent Framework.

Agent execution is intentionally replaceable behind a Runtime Contract（运行时契约）. For the MVP, the selected Primary Runtime Backend（主运行时后端）is **n8n Agent**: an n8n workflow configured as the Agent execution runtime. This is an MVP implementation choice, not a permanent product dependency; Hermes Agent, OpenClaw, OpenAI-compatible runtimes, Cloudflare Agents, custom Python/TypeScript services, or future implementations may replace it later through the same Runtime Contract / Adapter boundary.

## Open-source repository

ALOHA Assistant is developed as an open-source project. Source code in this repository is licensed under **GNU Affero General Public License v3.0 or later (`AGPL-3.0-or-later`)**; see `LICENSE`.

The public repository contains portable source code, contracts and documentation. It must **not** contain private user data, real conversation/memory content, secrets, credentials, production/staging datasets, or non-public live infrastructure identifiers/topology. Examples and fixtures must be synthetic, and deployment secrets/live private configuration must stay outside source control.

Contributors and coding agents must read `AGENTS.md` before making changes. Security-sensitive reports should follow `SECURITY.md` and should never paste secrets or private data into a public issue.

## Product boundary

ALOHA must retain independent control over:

- the first-party PWA/client and its personalized interaction experience;
- ALOHA Interaction Protocol（交互协议） and progressive/streaming client semantics;
- channel protocol adapters for first-party and third-party channels such as WeCom / Feishu;
- consumption and propagation of server-verified Identity / Principal（身份 / 权限主体） and Authorization Context（授权上下文） from the owning authority;
- Context Envelope（上下文信封） policy, including client-provided context such as location/device/selection with source and freshness semantics;
- which **ALOHA-managed Capabilities（ALOHA 管理能力）** it selects/exposes through ALOHA-controlled paths for a Run;
- confirmation / approval policy;
- Conversation（会话） and Run（执行） product semantics;
- canonical Run / Stream Events exposed to clients;
- Runtime selection and Runtime Adapter support/degradation boundaries;
- integration boundaries for LifeSpace, HomeMew, Poina, Relay, n8n and other systems.

LifeSpace remains the Identity（身份）and LifeSpace-owned domain-authorization authority. ALOHA consumes verified identity/effective authority and may further narrow ALOHA-mediated behavior for the current Run; it does not duplicate LifeSpace Membership / Grant / Agent Delegation / model-authorization logic.

ALOHA does not claim that Agent Control can revoke Runtime-native Tools（运行时原生工具）, credentials, MCP servers, shell/network access or other authority independently held by an external Runtime. Runtime Adapters map ALOHA semantics onto the controls a backend actually provides and degrade explicitly when a semantic cannot be hard-enforced. See `docs/runtime-trust-authority.md`.

ALOHA does **not** need to own the generic model/tool reasoning loop, runtime-native session mechanics, compaction, retry/recovery implementation, or provider-specific orchestration when those are supplied by a selected Runtime Backend.

## Architecture

```text
First-party PWA / future clients       WeCom / Feishu / other channels
              |                                   |
              +---------------+-------------------+
                              |
                              v
                       ALOHA Gateway
                transport / channel adapters
                              |
                              v
                    ALOHA Agent Control
         context / Run policy / confirmation
          ALOHA-managed capability exposure
                              |
                       Runtime Contract
                              |
                    n8n Runtime Adapter
                              |
                              v
                     n8n Agent Workflow
                  (MVP Primary Runtime)
                              |
                              v
             ALOHA-managed Capability calls
             + Runtime-native Tools as configured

Domain/infra authority remains separately owned:
LifeSpace / HomeMew / n8n workflows / Poina / Relay / ...
```

The Gateway and Agent Control may initially be deployed on the same platform, but they remain separate logical responsibilities. n8n is the MVP Primary Runtime Backend, while the Runtime Contract / Adapter boundary remains intentionally replaceable.

For the current Cloudflare MVP deployment, the Web/PWA is served as Static Assets（静态资源） from the public Gateway Worker. Agent Control remains a separate internal-only Worker reached through a Service Binding（服务绑定）. This keeps one public ALOHA origin while preserving the logical Gateway / Agent Control boundary.

## Protocol direction

### Client / channel -> ALOHA

ALOHA owns its first-party Interaction Protocol. It must support progressive/streaming interaction and may evolve beyond currently available chat protocols for richer state, approvals, artifacts, annotations and generative UI.

The first implemented text slice uses `POST /v1/interactions` and ALOHA canonical Server-Sent Events（SSE，服务器发送事件）: `run.started`, `output.delta`, `run.completed`, and `run.failed`. See `docs/interaction-protocol.md`.

### ALOHA -> Runtime

ALOHA uses a replaceable Runtime Contract. For the MVP, an **n8n Runtime Adapter** translates ALOHA Run / Context / ALOHA-managed Capability semantics into the selected n8n Agent workflow contract and normalizes n8n execution output back into ALOHA canonical events. n8n-native workflow/session payloads must not become the ALOHA client protocol.

A Runtime Adapter is also responsible for the concrete support/degradation mapping. A future Runtime may hard-enforce some ALOHA semantics, only soft-enforce others, or not support a sensitive scenario at all. ALOHA does not build a generic Runtime feature-negotiation framework in the MVP.

OpenAI Responses / Chat-style protocols may still be useful compatibility profiles for future backends, but they are not ALOHA's product contract.

## MVP

The MVP proves a usable personal-assistant path rather than every possible infrastructure combination:

`PWA -> Gateway -> Agent Control -> n8n Runtime Adapter -> n8n Agent -> real Capability / domain execution -> result`

The MVP should include:

- a text-first, State-first（状态优先） first-party client on Desktop / Mobile, plus image input as the second input type;
- a thin and stable Gateway;
- an explicit Agent Control boundary owned by ALOHA;
- a minimal Runtime Contract implemented by the n8n Runtime Adapter;
- an n8n Agent workflow as the Primary Runtime Backend;
- progressive/streaming-or-progressive-status result delivery back to the first-party client, normalized into ALOHA events;
- one low-risk direct ALOHA-managed capability path (`math.calculate`) as the M2 invocation proof;
- trusted LifeSpace Identity + Agent Ready / Runtime Discovery integration with at least one real read and deny case;
- at least one authorized LifeSpace mutation and semantic Action with Principal / Actor / Application attribution and revocation evidence;
- the minimum ALOHA Confirmation（确认） path for the first real action whose product policy requires explicit user approval;
- at least one separate n8n Workflow Capability, **after** the LifeSpace authority/confirmation path, proving n8n can simultaneously host the Agent Runtime and expose an independent Workflow Capability without conflating the two roles;
- clear boundaries between ALOHA Assistant, LifeSpace and the separate HomeMew Agent.

HomeMew-specific direct integration is not required merely to prove cross-product reuse. Shared family Task/Event data should prefer the authorized LifeSpace family-Space path; add a HomeMew-specific capability only when a real HomeMew-owned behavior requires it.

The MVP Runtime selection is **frozen to n8n Agent**. Runtime replaceability remains an architecture invariant, but evaluating or integrating a second backend is explicitly outside the first MVP.

Voice production polish, arbitrary file/video/location inputs, full Settings, Facet, Poina, Relay, a second Runtime and generic Runtime sandbox/feature-negotiation work are not MVP blockers unless a concrete requirement proves otherwise.

## MVP execution order

1. **M0/M1 — complete:** text interaction + real n8n Agent Runtime bootstrap.
2. **M2 — close the current gate:** deploy/verify `math.calculate` end to end, then stop. It proves the ALOHA-managed invocation path, not a universal Runtime permission model.
3. **M3 — LifeSpace Identity + Agent Ready read path:** consume LifeSpace Identity / effective authority / Runtime Discovery, preserve Principal（权限主体） / Actor（执行者） / Application Context（应用上下文）, and prove one real read plus deny case.
4. **M4 — LifeSpace mutation + semantic Action + Confirmation:** prove a real write, semantic Action（语义动作）, Change attribution（变更归因）, stale/revocation deny paths, and the minimum first real confirmation gate enforced outside the model.
5. **M5 — separate n8n Workflow Capability:** prove n8n's second role only after the higher-value authority/confirmation path is stable.
6. **MVP Client — parallel track:** implement the State-first Current Work Surface, Desktop/Mobile Composer, text, image, normalized Run/error/permission states, and M4 confirmation UI while M3/M4 backend work progresses.
7. **MVP closure:** deployment acceptance, deny/failure paths, public-repository safety and only the Run/Event normalization required by the usable client.

GitHub execution anchors: #20 (M3), #21 (M4), #22 (M5), #23 (MVP Client); #17 is the ALOHA consumer acceptance umbrella for the LifeSpace Contract Baseline across M3/M4.

## Read before changing the repository

Start with `AGENTS.md`, then read the nearest nested `AGENTS.md` for the area being changed.

Current sources of truth:

- `README.md` — product boundary and MVP target
- `docs/architecture.md` — current architecture, repository boundaries and MVP implementation order
- `docs/runtime-trust-authority.md` — Runtime trust, authority, capability degradation and confirmation security boundary
- `docs/interaction-protocol.md` — first-party Interaction Protocol slice implemented by Web / Gateway / Agent Control
- `docs/n8n-runtime.md` — M1 n8n Runtime bootstrap/deployment contract
- `docs/direct-capability.md` — M2 first Direct Capability, capability-grant and deployment boundary
- `docs/pwa-interaction.md` — current PWA interaction/product baseline
- `docs/composer-state-machine.md` — Composer states, guards, invariants and implementation/test baseline
- `docs/conversation-run-lifecycle.md` — Conversation / Run lifecycle and background execution management
- `docs/development.md` — toolchain, runtime/capability configuration, validation and lockfile baseline
- `packages/contracts` — shared ALOHA interaction/capability/runtime-facing protocol types

## Repository layout

```text
apps/
  web/                  # Vue 3 + Vite PWA
workers/
  gateway/              # thin channel / transport boundary + production Web static assets
  agent-control/        # ALOHA product control layer; not a generic Agent Runtime
packages/
  contracts/            # interaction / context / run / runtime-facing contracts
  capabilities/         # ALOHA capability registry and adapters
  runtime-n8n/          # concrete MVP adapter for the n8n Agent backend
docs/
  architecture.md
  runtime-trust-authority.md
  interaction-protocol.md
  n8n-runtime.md
  direct-capability.md
  pwa-interaction.md
  composer-state-machine.md
  conversation-run-lifecycle.md
  development.md
```

The first concrete Runtime Adapter is implemented explicitly for **n8n Agent** in `packages/runtime-n8n`. Keep n8n-specific payloads out of Gateway, first-party client contracts and generic Agent Control semantics, and do not build a generic Agent framework around it.

## Getting started

```bash
npm install
npm run dev:web
```

Run services separately when needed:

```bash
npm run dev:gateway
npm run dev:agent-control
```

Validate the repository with:

```bash
npm run check
```

## Principles

1. ALOHA Assistant is a personal Agent product, not a generic Agent framework or multi-assistant platform.
2. ALOHA owns its client interaction semantics and Agent product/control semantics; Agent execution backends remain replaceable.
3. LifeSpace owns Identity and LifeSpace domain authorization; ALOHA consumes verified authority and owns only its additional Run/Confirmation product policy.
4. Gateway stays thin and channel/transport focused; Agent Control owns ALOHA context/capability/confirmation/Run policy, not arbitrary Runtime-native authority.
5. **n8n Agent is the MVP Primary Runtime Backend**, isolated behind an explicit n8n Runtime Adapter and Runtime Contract with explicit degradation when required.
6. n8n may simultaneously be used as a callable Workflow Capability; the Agent Backend role and Workflow Capability role must remain explicit and separate.
7. HomeMew Agent is a peer Agent product. Shared LifeSpace-owned facts/capabilities should be reused from LifeSpace rather than routed through HomeMew Agent.
8. Relay, Poina, Facet and notification infrastructure stay independent and are integrated through contracts.
9. Keep the MVP small and value-ordered: trusted identity/domain access and confirmation before secondary integration proofs or a second Runtime.
10. Keep private user context and live private infrastructure outside this public repository.

## Status

M0/M1 have established the text Interaction path and the real n8n Agent Runtime path: PWA -> Gateway -> Agent Control -> n8n Runtime Adapter -> n8n Agent -> normalized ALOHA SSE events.

M2 adds the first real ALOHA-managed Direct Capability（直接能力） in source: `math.calculate`. Agent Control issues a short-lived Run-scoped Capability Grant for that mediated path; automated tests cover registration, calculation, fail-closed ALOHA-managed exposure, grant verification, invalid input and Gateway routing. M2 does not claim control over independent Runtime-native tools.

The current gate is only **M2 deployment verification**: configure the deployment-only `CAPABILITY_GRANT_SIGNING_KEY`, publish the M2 n8n workflow, and prove that n8n actually invokes `Math Calculate` according to `docs/direct-capability.md`.

After that, the next critical milestone is **M3 LifeSpace Identity + Agent Ready read-only integration (#20)**, followed by **M4 real LifeSpace mutation / semantic Action / Confirmation (#21)**. The separate n8n Workflow Capability moves to M5 (#22), while the first-party client work proceeds in parallel (#23).
