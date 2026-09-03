# ALOHA Assistant

ALOHA Assistant is a personal AI assistant and the primary personal interaction surface in the Verinasci project family.

This repository owns the **ALOHA product**: first-party client experience, channel Gateway（网关）, ALOHA Agent Control（智能体控制层）, ALOHA Interaction Protocol（交互协议）, Runtime Contract（运行时契约）and ALOHA-side Capability（能力）adapters. It does **not** require ALOHA to implement a generic Agent Framework.

For the MVP, the selected Runtime implementation is **n8n Agent**: an n8n workflow we control and can actively adapt to ALOHA's stable Runtime Contract. A future third-party Runtime may require a more complex Adapter, but third-party Runtime compatibility is not an MVP goal.

## Open-source repository

ALOHA Assistant is developed as an open-source project. Source code in this repository is licensed under **GNU Affero General Public License v3.0 or later (`AGPL-3.0-or-later`)**; see `LICENSE`.

The public repository contains portable source code, contracts and documentation. It must **not** contain private user data, real conversation/memory content, secrets, credentials, production/staging datasets, or non-public live infrastructure identifiers/topology. Examples and fixtures must be synthetic, and deployment secrets/live private configuration must stay outside source control.

Contributors and coding agents must read `AGENTS.md` before making changes. Security-sensitive reports should follow `SECURITY.md` and should never paste secrets or private data into a public issue.

## Product boundary

ALOHA must retain independent control over:

- the first-party PWA/client and its personalized interaction experience;
- ALOHA Interaction Protocol and canonical client Run events;
- channel Gateway and future channel adapters;
- Conversation（会话）and Run（执行）product state;
- Agent Control and the Canonical Run Envelope（规范运行信封）sent toward the Runtime boundary;
- Context（上下文）needed by a Run, added incrementally as real product inputs appear;
- ALOHA-specific Confirmation（确认）and other product-level Run policy;
- ALOHA-managed Capabilities（ALOHA 管理能力）when ALOHA itself exposes a mediated capability path.

LifeSpace is the Identity（身份）authority used by ALOHA to know the current user and establish ALOHA's Principal（权限主体）, Actor（执行者）and Application Context（应用上下文）. LifeSpace Core remains an independent capability/data provider and does not become an internal Agent Control service merely because ALOHA uses LifeSpace Identity.

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
Canonical Run Envelope（规范运行信封）
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

The key boundary is simple:

- **Gateway -> Agent Control:** requests follow the ALOHA Interaction Protocol.
- **Agent Control -> Runtime Adapter:** Agent Control produces a Canonical Run Envelope.
- **Runtime Adapter -> Runtime:** the Adapter translates the Envelope into the concrete Runtime request and translates Runtime output back into ALOHA events.

Agent Control does not own the model reasoning loop or Tool Loop. Runtime-specific payloads must not leak into the ALOHA first-party protocol.

## Agent Control

For the MVP, Agent Control has five core responsibilities:

1. accept normalized ALOHA interactions from Gateway;
2. own/persist the ALOHA Conversation and Run state needed by product semantics;
3. bind trusted LifeSpace Identity and add the Context / Run policy actually needed by the current product slice;
4. produce the Canonical Run Envelope and send it through the selected Runtime Adapter;
5. normalize Runtime results/status back into ALOHA Run events.

The Canonical Run Envelope should remain small. The MVP only adds fields that are already required by a real scenario. The current minimal Runtime contract already carries request / Conversation / Run correlation, input and capability descriptors; the next contract slice will stabilize this into the explicit Canonical Run Envelope rather than pre-designing every future Context field.

## Runtime

The MVP does not distinguish n8n Agent from a hypothetical self-built Runtime at the architecture level: both are Runtime implementations we control and can adapt to the stable contract.

The current n8n Runtime Adapter may therefore remain thin. The n8n Agent workflow itself can be designed to consume a request close to the Canonical Run Envelope and can call normal Tools / APIs / MCP / workflows as needed.

Hermes Agent, OpenClaw and other third-party Runtime products are future integrations. They must not drive MVP contract complexity or trigger generic Runtime feature negotiation, sandboxing, profile management or compatibility frameworks now.

## LifeSpace boundary

LifeSpace has two different relationships with ALOHA:

1. **LifeSpace Identity -> Agent Control:** foundational dependency. ALOHA needs trusted identity before creating an authoritative Run context.
2. **LifeSpace Core -> Runtime Tool:** capability relationship. Task/Event/shared-reality operations should normally be exposed to the Runtime through an appropriate Tool / MCP / adapter path and remain authorized by LifeSpace itself.

Therefore ALOHA's MVP may prioritize a LifeSpace Core tool because it has high product value, but LifeSpace Core is **not** an architectural prerequisite for Agent Control or the Runtime Contract.

## MVP target

The MVP proves a usable personal-assistant path:

`PWA -> Gateway -> Agent Control -> Canonical Run Envelope -> Runtime Adapter -> n8n Agent -> real Tools -> result`

The MVP should include:

- text-first, State-first（状态优先）Desktop/Mobile PWA, with image input as the second input type;
- thin Gateway + stable ALOHA Interaction Protocol;
- persisted Conversation / Run state required by `docs/conversation-run-lifecycle.md`;
- LifeSpace Identity binding for the current user / ALOHA execution identity;
- a small Canonical Run Envelope as the stable Agent Control output contract;
- n8n Agent as the only MVP Runtime implementation, adapted to that contract;
- at least one real high-value Tool path; LifeSpace Core is the preferred first domain provider, but it is a Tool provider rather than an Agent Control dependency;
- the minimum Confirmation path when the first real product action actually requires explicit approval;
- normalized Run states/results/errors back to the first-party client.

Not MVP blockers: Hermes/second Runtime integration, generic multi-Runtime compatibility, generic Runtime feature negotiation/sandboxing, arbitrary file/video/location inputs, production voice polish, full Settings, Facet, Poina or Relay integration.

## MVP execution order

1. **M0/M1 — complete:** first text Interaction path and real n8n Agent Runtime bootstrap.
2. **M2 — close the current gate:** finish deployment verification for `math.calculate`; do not expand M2 into a generic Runtime permission framework.
3. **M3 — stabilize the ALOHA control/runtime contract:** implement/persist the required Conversation / Run state, bind LifeSpace Identity, and stabilize the small **Canonical Run Envelope v1** produced by Agent Control. Update the n8n Runtime Adapter/workflow to consume it. This is the key MVP architecture milestone.
4. **M4 — add real personal-assistant Tools:** connect the first high-value real Tool providers through the Runtime. Prefer LifeSpace Core for a representative real scenario because of product value, while keeping it outside Agent Control. Add an n8n Workflow Tool when a useful workflow is selected; there is no need for a separate architectural milestone just to prove n8n has two roles.
5. **M5 — first real Confirmation-required action:** when a real mutating/high-impact action appears, add only the minimum Confirmation flow needed for that action. LifeSpace/provider authorization remains the final domain safety boundary.
6. **MVP Client — parallel:** complete the State-first Current Work Surface, Desktop/Mobile Composer, text/image submission and normalized Run/error/confirmation presentation alongside M3-M5.
7. **MVP closure:** deployed end-to-end acceptance, failure/deny paths, public-repository safety and usability validation.

These are internal implementation phases, not a requirement to create one public GitHub Issue per phase. Public Issues should represent externally understandable, independently actionable or verifiable work.

## Read before changing the repository

Start with `AGENTS.md`, then read the nearest nested `AGENTS.md` for the area being changed.

Current sources of truth:

- `README.md` — product boundary and MVP target
- `docs/architecture.md` — current architecture, Agent Control / Runtime boundary and MVP implementation order
- `docs/runtime-trust-authority.md` — Runtime trust, independent Runtime authority and confirmation security boundary
- `docs/interaction-protocol.md` — first-party Interaction Protocol
- `docs/conversation-run-lifecycle.md` — Conversation / Run lifecycle
- `docs/n8n-runtime.md` — current n8n Runtime bootstrap/integration contract
- `docs/direct-capability.md` — M2 Direct Capability boundary
- `docs/pwa-interaction.md` / `docs/composer-state-machine.md` — first-party interaction implementation baseline
- `packages/contracts` — shared ALOHA interaction/capability/runtime-facing protocol types

## Repository layout

```text
apps/
  web/                  # Vue 3 + Vite PWA
workers/
  gateway/              # thin channel / transport boundary + production Web static assets
  agent-control/        # ALOHA Conversation / Run control + Canonical Run Envelope owner
packages/
  contracts/            # interaction / context / run / runtime-facing contracts
  capabilities/         # ALOHA-managed capability registry/adapters
  runtime-n8n/          # concrete MVP adapter for the n8n Agent runtime
docs/
  architecture.md
  runtime-trust-authority.md
  interaction-protocol.md
  conversation-run-lifecycle.md
  n8n-runtime.md
  direct-capability.md
```

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

## Status

M0/M1 established the first text Interaction path and the n8n Agent Runtime bootstrap. M2 source implements the first low-risk ALOHA-managed Direct Capability, `math.calculate`; its deployment-level end-to-end verification remains the current gate.

After M2 verification, the next architecture milestone is **Canonical Run Envelope v1 + Conversation/Run persistence + LifeSpace Identity binding**, not a LifeSpace Core read/write framework and not a second Runtime integration.