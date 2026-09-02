# ALOHA Assistant architecture baseline

This document records the current target boundary for implementation. ALOHA Assistant is a **personal Agent product**. It is not a generic Agent Framework and it does not require a self-built Agent Runtime engine.

## Product boundary

ALOHA Assistant owns the personalized client experience and the product semantics that must remain stable even when Agent execution technology changes.

HomeMew Agent is a separate, peer Agent product. ALOHA may access HomeMew / LifeSpace capabilities only through the user's authorized intersection of Principal permissions and ALOHA Application scopes.

## Core architecture

```text
First-party PWA / future clients       WeCom / Feishu / future channels
              |                                   |
              +---------------+-------------------+
                              |
                              v
                       Gateway（网关）
               channel + transport boundary
                              |
                              v
               Agent Control（智能体控制层）
      identity / authorization / context / capability policy
        confirmation / Conversation / Run / runtime selection
                              |
                    Runtime Contract（运行时契约）
                              |
                    Runtime Adapter（运行时适配器）
                              |
       +----------------------+----------------------+
       |                      |                      |
       v                      v                      v
  Hermes Agent            OpenClaw              n8n Agent
                                              / custom runtime
                              |
                              v
                  allowed Capability / Tool calls
                              |
       +----------------------+----------------------+
       |                      |                      |
       v                      v                      v
   LifeSpace              HomeMew                 n8n workflows
       |                                             |
       +---------------- later: Poina / Relay / ...--+
```

The diagram shows logical boundaries, not mandatory deployment topology. Gateway and Agent Control may initially run on the same infrastructure. A Runtime Backend may run on Cloudflare, GCP, AWS, a VM/container, or another environment.

## Why Agent Control exists

Gateway answers: **how does a request enter/leave ALOHA?**

Agent Control answers: **under whose authority, with what context, capabilities and policies should this ALOHA Run execute?**

Agent Control is deliberately separate from a generic Agent Runtime engine. It owns ALOHA product semantics and prepares a runtime-neutral execution request.

### Agent Control owns

- verified Identity / Principal context;
- Application Context and authorization scope;
- Context Envelope policy and assembly;
- allowed Capability / Tool exposure;
- confirmation / approval policy;
- Conversation / Run product semantics;
- runtime selection;
- conversion between ALOHA canonical events and backend-native runtime events;
- policy around how LifeSpace, HomeMew, Poina, Relay, n8n and other systems are exposed to a Runtime.

### Runtime Backend owns

Depending on the backend, it may own:

- model invocation and reasoning loop;
- tool-call loop / orchestration;
- runtime-native session mechanics;
- compaction / retry / recovery;
- backend-specific persistence and scheduling;
- runtime-specific optimizations.

These are implementation concerns unless ALOHA explicitly promotes a semantic into its stable product contract.

## Protocol boundaries

### Northbound: ALOHA Interaction Protocol（ALOHA 交互协议）

ALOHA owns the protocol used by its first-party clients. It must support progressive/streaming interaction and is allowed to evolve beyond conventional chat-message protocols.

Canonical semantics may include, as they become real requirements:

- Run accepted / started / completed / failed / cancelled;
- output delta / structured output;
- tool/activity progress;
- confirmation required / confirmed / denied;
- artifact/resource available;
- clarification/input required;
- annotations and richer interaction events.

Transport is separate from semantics. HTTP + SSE may be the MVP transport; WebSocket or other transports can be added later without redefining all product events.

Third-party channels use channel adapters. A channel may explicitly degrade features it cannot represent; third-party channel limitations must not constrain the first-party protocol to the lowest common denominator.

### Southbound: Runtime Contract（运行时契约）

Agent Control reaches Runtime Backends through an explicit adapter boundary.

OpenAI Responses / Chat-style APIs are useful compatibility profiles where available, but ALOHA must not define its internal product contract as identical to one provider protocol. Runtime adapters isolate differences such as session handling, approvals, cancellation, resume, durable execution, artifacts and backend-native events.

A backend may be:

- Hermes Agent;
- OpenClaw;
- an n8n Agent workflow;
- an OpenAI-compatible Agent service;
- Cloudflare Agents;
- a custom Python/TypeScript runtime using OpenAI Agents SDK, LangGraph or another framework;
- a future Runtime implementation.

The MVP needs one Primary Runtime Backend, not multi-runtime active-active operation.

## Context Envelope（上下文信封）

Context is a first-class ALOHA product concern rather than an unstructured prompt blob.

Expected categories include:

- **Identity Context** — server-verified Principal/Actor/Application attribution;
- **Authorization Context** — server-verified grants/scopes/policy decisions;
- **Environment Context** — time, timezone, locale and other environment facts;
- **Device Context** — client/device capabilities and relevant client state;
- **Location Context** — coordinates/accuracy/timestamp/consent when explicitly supplied;
- **Interaction Context** — current surface, selection, annotation or references;
- **Resources** — images, files and other submitted references.

Client-provided context is contextual evidence, not authorization authority. Context fields should preserve source, capture time/freshness and sensitivity/consent semantics where relevant.

## Capability boundary

A Runtime must not receive broad authority merely because it is executing ALOHA.

Conceptually, exposed capabilities are bounded by:

`verified Principal authority ∩ ALOHA Application scope ∩ current Run policy`

Capability adapters may expose LifeSpace, HomeMew, n8n workflows, Relay, Poina and future systems while preserving their independent domain ownership.

n8n has two valid roles:

1. **Workflow / Integration Capability** — another Runtime invokes an n8n workflow as a Tool/Capability.
2. **Runtime Backend** — an n8n workflow configured as an Agent executes the ALOHA Run through a Runtime Adapter.

These roles must remain explicit and must not be conflated.

## Repository responsibilities

### `apps/web`

Owns the ALOHA first-party user experience: input, personalized interaction ergonomics, presentation, local PWA concerns and client-side context collection with appropriate user consent.

It does not own authorization authority or external-domain business data.

### `workers/gateway`

Owns the external transport/channel boundary: request admission, authentication handoff, channel adaptation, protocol normalization, streaming/session transport, routing and transport-level controls.

It does not own Agent reasoning, Capability policy or confirmation policy.

### `workers/agent-control`

Owns ALOHA Agent Control: verified identity/authorization context, Context Envelope policy, Capability exposure, confirmation policy, Conversation/Run product semantics, Runtime selection and runtime-event normalization.

It is not a generic Agent Runtime engine.

### `packages/contracts`

Owns shared ALOHA interaction/context/run/capability/runtime-facing types. Contracts should remain provider/runtime neutral unless a dependency is deliberately part of the boundary.

### `packages/capabilities`

Owns ALOHA-side Capability registry/adapters. It may adapt LifeSpace, HomeMew, n8n and later shared services, but it must not absorb those systems' domain ownership.

### Runtime adapters

Runtime Adapter structure is intentionally not frozen until the first concrete Runtime Backend is selected. Once a real adapter exists, give it an explicit owning package/directory rather than embedding provider-specific logic throughout Agent Control.

## Outside this repository

- **LifeSpace** — Identity（身份）and Shared Reality（共享现实）.
- **HomeMew** — family application/domain capability provider; HomeMew Agent remains independent.
- **Relay** — Delegated Work（委托工作）.
- **Poina** — long-term Memory（长期记忆）infrastructure.
- **Facet** — generative human-Agent interaction runtime.
- **知了** — unified notification infrastructure.
- **n8n** — external workflow/runtime platform; it may be consumed in either role described above.
- external Runtime Backend products such as Hermes Agent and OpenClaw.

## MVP implementation order

1. Keep the PWA shell fast and minimal.
2. Stabilize the first-party Interaction Protocol and Context Envelope needed by the MVP.
3. Wire `web -> gateway -> agent-control` with progressive/streaming-friendly contracts.
4. Define the smallest Runtime Contract needed by one concrete Runtime Backend.
5. Select and integrate one Primary Runtime Backend through an adapter.
6. Add one direct capability.
7. Add one n8n workflow capability.
8. Add one authorized LifeSpace / HomeMew read-write scenario.
9. Only then expand richer context, voice, memory, delegation and generative interaction.

Do not build a generic Agent Framework merely to make Runtime backends theoretically interchangeable. Keep the stable ALOHA semantic boundary small and prove replaceability through concrete adapters and contract tests when a second backend becomes real.
