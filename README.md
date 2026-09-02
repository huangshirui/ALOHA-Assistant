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
- verified Identity / Principal（身份 / 权限主体） context;
- authorization context and application scope;
- Context Envelope（上下文信封） policy, including client-provided context such as location/device/selection with source and freshness semantics;
- which Capabilities / Tools a Runtime is allowed to see;
- confirmation / approval policy;
- Conversation（会话） and Run（执行） product semantics;
- canonical Run / Stream Events exposed to clients;
- Runtime selection and Runtime Adapter boundaries;
- integration boundaries for LifeSpace, HomeMew, Poina, Relay, n8n and other systems.

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
              identity / auth / context policy
            capability / confirmation / Run semantics
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
                allowed Capability / Tool calls

Runtime-accessible capabilities remain separately owned:
LifeSpace / HomeMew / n8n workflows / Poina / Relay / ...
```

The Gateway and Agent Control may initially be deployed on the same platform, but they remain separate logical responsibilities. n8n is the MVP Primary Runtime Backend, while the Runtime Contract / Adapter boundary remains intentionally replaceable.

## Protocol direction

### Client / channel -> ALOHA

ALOHA owns its first-party Interaction Protocol. It must support progressive/streaming interaction and may evolve beyond currently available chat protocols for richer state, approvals, artifacts, annotations and generative UI.

### ALOHA -> Runtime

ALOHA uses a replaceable Runtime Contract. For the MVP, an **n8n Runtime Adapter** translates ALOHA Run / Context / Capability semantics into the selected n8n Agent workflow contract and normalizes n8n execution output back into ALOHA canonical events. n8n-native workflow/session payloads must not become the ALOHA client protocol.

OpenAI Responses / Chat-style protocols may still be useful compatibility profiles for future backends, but they are not ALOHA's product contract.

## MVP

The first milestone proves the complete path:

`PWA -> Gateway -> Agent Control -> n8n Runtime Adapter -> n8n Agent -> Capability -> real execution`

The MVP should include:

- text-first conversation with room for voice/image/file/location/context input;
- a thin and stable Gateway;
- an explicit Agent Control boundary owned by ALOHA;
- a minimal Runtime Contract implemented by the n8n Runtime Adapter;
- an n8n Agent workflow as the Primary Runtime Backend;
- progressive/streaming-or-progressive-status result delivery back to the first-party client, normalized into ALOHA events;
- at least one direct tool capability exposed to the n8n Agent;
- at least one separate n8n workflow capability, proving that n8n can simultaneously host the Agent Runtime and expose independent Workflow Capabilities without conflating the two roles;
- at least one authorized LifeSpace / HomeMew read-write scenario;
- clear authorization boundaries between the personal ALOHA Assistant and the separate HomeMew Agent.

The MVP Runtime selection is now **frozen to n8n Agent for the first vertical slice**. Runtime replaceability remains an architecture invariant, but evaluating or integrating a second backend is explicitly outside the first MVP slice.

## Read before changing the repository

Start with `AGENTS.md`, then read the nearest nested `AGENTS.md` for the area being changed.

Current sources of truth:

- `README.md` — product boundary and MVP target
- `docs/architecture.md` — current architecture and repository boundaries
- `docs/pwa-interaction.md` — current PWA interaction/product baseline
- `docs/composer-state-machine.md` — Composer states, guards, invariants and implementation/test baseline
- `docs/conversation-run-lifecycle.md` — Conversation / Run lifecycle and background execution management
- `docs/development.md` — toolchain, validation and lockfile baseline
- `packages/contracts` — shared ALOHA interaction/capability/runtime-facing protocol types

## Repository layout

```text
apps/
  web/                  # Vue 3 + Vite PWA
workers/
  gateway/              # thin channel / transport boundary
  agent-control/        # ALOHA product control layer; not a generic Agent Runtime
packages/
  contracts/            # interaction / context / run / runtime-facing contracts
  capabilities/         # ALOHA capability registry and adapters
docs/
  architecture.md
  pwa-interaction.md
  composer-state-machine.md
  conversation-run-lifecycle.md
  development.md
```

The first concrete Runtime Adapter should now be implemented explicitly for **n8n Agent**. Do not build a generic Agent framework around it; create only the smallest adapter/contracts needed for the first real vertical slice, while keeping n8n-specific payloads out of Gateway, first-party client contracts and generic Agent Control semantics.

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

Validate the complete repository scaffold with:

```bash
npm run check
```

## Principles

1. ALOHA Assistant is a personal Agent product, not a generic Agent framework or multi-assistant platform.
2. ALOHA owns its client interaction semantics and Agent product/control semantics; Agent execution backends remain replaceable.
3. Gateway stays thin and channel/transport focused; Agent Control owns identity/context/capability/confirmation/Run policy.
4. **n8n Agent is the MVP Primary Runtime Backend**, isolated behind an explicit n8n Runtime Adapter and Runtime Contract.
5. n8n may simultaneously be used as a callable Workflow Capability; the Agent Backend role and Workflow Capability role must remain explicit and separate.
6. LifeSpace owns identity/shared reality; ALOHA consumes it through explicit authorization.
7. Relay, Poina, Facet and notification infrastructure stay independent and are integrated through contracts.
8. Keep the MVP small, but keep boundaries compatible with Runtime replacement and richer first-party interaction.
9. Keep private user context and live private infrastructure outside this public repository.

## Status

Repository skeleton initialized. Product and architecture baselines are evolving with the MVP. **n8n Agent is selected as the Primary Runtime Backend for the MVP first vertical slice; the integration itself is planned, not yet claimed as implemented or verified.**
