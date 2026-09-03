# ALOHA Assistant architecture baseline

This document records the current target boundary for implementation. ALOHA Assistant is a **personal Agent product**, not a generic Agent Framework.

## Core architecture

```text
First-party PWA / future channels
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
      Runtime Backend
      n8n Agent (MVP)
              |
      +-------+---------+---------+
      |       |         |         |
      v       v         v         v
 LifeSpace  n8n      Search /   future
 Core Tool  Workflow  other Tool  Tools
```

The architecture has two stable protocol boundaries:

1. **Gateway -> Agent Control:** ALOHA Interaction Protocol（ALOHA 交互协议）.
2. **Agent Control -> Runtime Adapter:** Canonical Run Envelope（规范运行信封）under the Runtime Contract（运行时契约）.

The Runtime Adapter converts that Envelope into whatever concrete request the selected Runtime needs and normalizes the Runtime result back into ALOHA events.

## Gateway（网关）

Gateway is the channel/transport boundary.

It owns:

- external request admission and authentication handoff;
- first-party / future channel adaptation;
- ALOHA Interaction Protocol transport;
- HTTP/SSE/session transport and routing;
- transport-level controls.

Gateway does **not** own model reasoning, Tool Loop, Conversation / Run product state, Confirmation policy or business/domain semantics.

## Agent Control（智能体控制层）

Agent Control sits directly between Gateway and Runtime Adapter.

Its input is a request already normalized to the ALOHA Interaction Protocol. Its primary downstream output is the Canonical Run Envelope.

For the MVP, Agent Control has five core responsibilities:

1. **Conversation / Run state** — create, persist and update the ALOHA Conversation（会话）and Run（执行）state required by the product lifecycle. Backend execution/session ids remain correlations, not ALOHA product identity.
2. **Trusted identity binding** — use LifeSpace Identity（身份）to know the current user and establish the ALOHA Principal（权限主体）, Actor（执行者）and Application Context（应用上下文）needed by the Run.
3. **Context / policy assembly** — attach only Context and ALOHA product policy required by the current real scenario. Context such as time, location, device, selected content or resources is added incrementally rather than pre-designed exhaustively.
4. **Canonical Run Envelope** — produce the stable Runtime-facing ALOHA request independent of n8n-native workflow/session payloads.
5. **Canonical events** — accept Runtime status/result/error and map it back into ALOHA Run / Stream events for the client.

Agent Control is **not** the model/runtime engine. It does not own the reasoning loop or generic Tool Loop.

## Canonical Run Envelope（规范运行信封）

The Canonical Run Envelope is the stable ALOHA-side contract between Agent Control and Runtime Adapter.

The MVP goal is not a large universal schema. The first version should stabilize only the categories already required by real behavior:

```text
Run
- requestId
- conversationId
- runId

Input
- text
- resources/attachments when supported

Identity
- trusted current execution identity/context needed by the Runtime/tool path

Context
- only fields currently required by the product slice

Capabilities / Policy
- only ALOHA-managed capability or Confirmation information currently implemented
```

The current source-level Runtime contract is intentionally smaller and already carries request / Conversation / Run correlation, input and ALOHA-managed capability descriptors. M3 evolves that existing contract into an explicit Canonical Run Envelope v1; this document does not claim that the target Envelope is already fully implemented.

The Envelope is **not the same thing as a model prompt**. Runtime Adapter / Runtime implementation decides how relevant fields are mapped to model input, Tool configuration or execution metadata.

## Runtime Adapter（运行时适配器）

Runtime Adapter has one main job:

> translate the Canonical Run Envelope into the concrete Runtime request, then translate Runtime output back into ALOHA semantics.

The Adapter should remain as thin as the Runtime allows.

Because the MVP n8n Agent workflow is controlled by this project, the workflow itself can actively conform to the ALOHA Runtime Contract. Therefore n8n Agent is architecturally similar to a self-built Runtime implementation; it does not need to be treated as a special third-party compatibility problem.

Do not build generic Runtime feature negotiation, profile management or a universal Adapter framework in the MVP.

## Runtime Backend（运行时后端）

Runtime owns the actual execution engine, including as applicable:

- model invocation / reasoning loop;
- Tool Call Loop（工具调用循环）;
- Runtime-native execution/session state;
- Runtime-specific retry/recovery/orchestration;
- the concrete Tool connections available to that Runtime instance/workflow.

### MVP Runtime

The only MVP Runtime is **n8n Agent**.

ALOHA controls the n8n Agent workflow, so the workflow may be designed around the stable Canonical Run Envelope rather than forcing Agent Control to mimic an arbitrary third-party API.

A future custom Python/TypeScript Runtime would sit behind the same Runtime Contract and is conceptually the same class of implementation.

### Third-party Runtime

Hermes Agent, OpenClaw, OpenAI-compatible Agent products and other third-party Runtimes are explicitly **post-MVP**.

They may later require stronger Adapter translation or explicit degradation, but their current API limitations must not drive the MVP contract design. The security invariants for such future integrations remain recorded in `runtime-trust-authority.md`.

## LifeSpace boundary

LifeSpace has two separate roles relative to ALOHA and they must not be conflated.

### LifeSpace Identity -> Agent Control

LifeSpace Identity is a foundational dependency of ALOHA Agent Control because ALOHA needs a trusted answer to “who is this user / what application and Agent are acting?” before it can build an authoritative Run context.

ALOHA does not create a second Identity / Space / Grant / Delegation authorization system.

### LifeSpace Core -> Runtime Tool

LifeSpace Core is an independent Shared Reality（共享现实）and domain capability provider.

Task/Event/model/action access should normally be exposed as an appropriate Runtime Tool / MCP / adapter capability. The Runtime calls that capability, and LifeSpace performs its own final current-state authorization.

Therefore:

- LifeSpace **Identity** is an Agent Control dependency;
- LifeSpace **Core** is a high-value Tool provider;
- using LifeSpace Identity does not require Agent Control to proxy all LifeSpace Core operations.

This also means the ALOHA MVP architecture itself can exist with non-LifeSpace Tools. LifeSpace Core is prioritized because of product value and because it is a major source of the user's shared reality, not because the Runtime Contract depends on LifeSpace Core.

## Context（上下文）

ALOHA keeps Context as structured product input rather than one unstructured prompt string, but the MVP should remain incremental.

Examples of future/ongoing Context include:

- time / timezone / locale;
- location;
- device/client state;
- current Surface / selected content;
- images/files/resources.

Only add fields when a real interaction requires them. Preserve source/freshness/consent where they matter, but do not build a generic Context framework before those cases exist.

Client-provided Context is never authorization authority.

## Capability and Tool boundary

Two concepts remain separate:

- **ALOHA-managed Capability（ALOHA 管理能力）** — a capability ALOHA itself exposes through an ALOHA-controlled invocation path, such as M2 `math.calculate`.
- **Runtime Tool（运行时工具）** — a Tool configured for the Runtime, such as a LifeSpace Tool, an n8n workflow Tool or another integration.

M2 proves the first category and does not imply that every future Tool must be proxied by Agent Control.

Business/domain semantics remain with their owning providers. ALOHA should not copy LifeSpace Task/Event semantics, HomeMew domain behavior or other provider logic into Agent Control.

## Confirmation（确认）

Confirmation is an ALOHA product behavior, not LifeSpace domain authorization.

Do not build a generic approval engine in advance. When the first real mutating/high-impact action needs user approval, implement the minimum Confirmation flow required for that concrete action and bind it to the relevant Run/action parameters.

If a future Runtime cannot reliably preserve a mandatory Confirmation rule, use an ALOHA-controlled execution path for that sensitive action rather than weakening the product rule. This is a future integration constraint, not a reason to complicate the current n8n MVP.

## Repository responsibilities

### `apps/web`

First-party ALOHA product UI and client-side interaction/context collection.

### `workers/gateway`

External channel/transport boundary and first-party web asset serving for the current deployment.

### `workers/agent-control`

Conversation / Run control, trusted identity/context assembly, Canonical Run Envelope production, Runtime selection and canonical event normalization.

### `packages/contracts`

ALOHA Interaction / Run / Context / Runtime-facing contracts. Canonical Run Envelope v1 belongs here when implemented.

### `packages/runtime-n8n`

Concrete mapping between the ALOHA Runtime Contract and the controlled n8n Agent workflow.

### `packages/capabilities`

ALOHA-managed capability registry/adapters. Do not use this package as a generic registry for all Runtime-native Tools.

## MVP implementation order

1. **M0/M1 — complete:** first text Interaction Protocol path and n8n Agent Runtime bootstrap.
2. **M2 — close current deployment gate:** verify `math.calculate` end to end and stop; M2 proves only the ALOHA-managed capability invocation path.
3. **M3 — Canonical Run Envelope + state + Identity:**
   - implement the Conversation / Run persistence required by `conversation-run-lifecycle.md`;
   - bind LifeSpace Identity into Agent Control;
   - stabilize Canonical Run Envelope v1;
   - adapt the controlled n8n Agent workflow to consume it;
   - keep the contract small and based only on current needs.
4. **M4 — real Tools:** attach useful Tool providers to the Runtime. Prefer one representative LifeSpace Core scenario because it provides high personal-assistant value. Add an n8n Workflow Tool when there is a useful workflow; do not create a special architectural milestone merely to prove n8n's second role.
5. **M5 — first Confirmation-required action:** add the minimum Confirmation behavior only when the first real mutating/high-impact Tool scenario requires it.
6. **Client work in parallel:** State-first Current Work Surface, Desktop/Mobile Composer, text/image submission and normalized Run/error/Confirmation presentation.
7. **MVP closure:** deployed end-to-end acceptance, failure/deny paths, public-repository safety and usability validation.

These are internal implementation phases. Public GitHub Issues should be created only for externally understandable, independently actionable or independently verifiable work.

## Explicit non-goals for MVP

- Hermes Agent or another second Runtime integration;
- generic Runtime compatibility / feature negotiation framework;
- generic Runtime sandbox or credential broker;
- generic Context ontology;
- generic approval/workflow engine;
- moving LifeSpace Core semantics into Agent Control;
- turning n8n-native workflow/session structures into ALOHA product contracts.
