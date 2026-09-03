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
                 n8n Runtime Adapter（MVP）
                              |
                              v
                 n8n Agent Workflow（MVP）
                 Primary Runtime Backend
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

The diagram shows logical boundaries, not mandatory deployment topology. Gateway and Agent Control may initially run on the same infrastructure. For the MVP first vertical slice, **n8n Agent is the selected Primary Runtime Backend（主运行时后端）**. The Runtime Contract / Adapter boundary remains stable so another backend can replace n8n later without redefining ALOHA product semantics.

For the current Cloudflare MVP deployment, the first-party Web/PWA is served as Static Assets（静态资源） by the public Gateway Worker. Agent Control is deployed as a separate internal-only Worker reached through a Service Binding（服务绑定）. This physical split preserves one public ALOHA origin without changing the logical architecture above.

## MVP Runtime decision

The MVP Runtime selection is **frozen to n8n Agent** for the first end-to-end implementation.

This means:

- one n8n workflow configured as an Agent executes the model/reasoning/tool loop for an ALOHA Run;
- ALOHA Agent Control still owns Identity / Authorization, Context Envelope, Capability exposure, Confirmation policy, Conversation / Run product semantics and canonical client events;
- an explicit **n8n Runtime Adapter** translates between ALOHA Runtime Contract semantics and the n8n Agent workflow's native input/output/execution model;
- n8n workflow/session/execution payloads must not leak into the ALOHA first-party Interaction Protocol;
- the MVP does not need a second Runtime Backend or generic multi-runtime framework;
- future Runtime replacement remains an architectural invariant, not an MVP feature.

The decision is deliberately pragmatic: n8n is already part of the user's automation stack, is suitable for quickly composing model + tools + workflows, and can validate the complete ALOHA control/runtime boundary with low implementation cost. This does **not** make n8n the ALOHA product identity, authorization authority, Shared Reality source, or permanent architecture core.

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

For the MVP these responsibilities are implemented by the selected n8n Agent workflow where n8n supports them. They remain implementation concerns unless ALOHA explicitly promotes a semantic into its stable product contract.

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

For the MVP, the concrete backend is **n8n Agent** and the first adapter is the **n8n Runtime Adapter**. The adapter must map at least:

- ALOHA Run identity and correlation;
- normalized Context Envelope fields required by the workflow;
- the allowed Capability / Tool set or callable endpoints exposed for the Run;
- acceptance / running / progress / result / failure semantics;
- cancellation / supersession behavior to the extent n8n can support it;
- backend errors into ALOHA machine-readable errors and canonical events.

The adapter should be the smallest concrete contract needed for this first vertical slice. Do not design a generalized Runtime Framework before a second backend exists.

OpenAI Responses / Chat-style APIs remain useful compatibility profiles for future backends, but ALOHA must not define its internal product contract as identical to one provider protocol.

Future Runtime Backend candidates may include Hermes Agent, OpenClaw, OpenAI-compatible Agent services, Cloudflare Agents, custom Python/TypeScript runtimes using OpenAI Agents SDK / LangGraph, or later systems. They are **not MVP implementation targets**.

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

The n8n Runtime Adapter may transform this structure into the shape required by the MVP n8n Agent workflow, but the n8n workflow payload is not the canonical ALOHA Context model.

## Capability boundary

A Runtime must not receive broad authority merely because it is executing ALOHA.

Conceptually, exposed capabilities are bounded by:

`verified Principal authority ∩ ALOHA Application scope ∩ current Run policy`

Capability adapters may expose LifeSpace, HomeMew, n8n workflows, Relay, Poina and future systems while preserving their independent domain ownership.

n8n has two valid roles and the MVP intentionally exercises both:

1. **Runtime Backend** — the selected n8n Agent workflow executes the ALOHA Run through the n8n Runtime Adapter.
2. **Workflow / Integration Capability** — the Agent may call a separate n8n workflow as a Tool/Capability.

These roles must remain explicit and must not be conflated. A workflow hosting the Agent Runtime is not automatically the same thing as every n8n workflow capability.

## Repository responsibilities

### `apps/web`

Owns the ALOHA first-party user experience: input, personalized interaction ergonomics, presentation, local PWA concerns and client-side context collection with appropriate user consent.

It does not own authorization authority or external-domain business data. In the current production deployment, its build output is attached to the Gateway Worker as Static Assets; this is a deployment choice, not a transfer of UI ownership to Gateway code.

### `workers/gateway`

Owns the external transport/channel boundary: request admission, authentication handoff, channel adaptation, protocol normalization, streaming/session transport, routing and transport-level controls.

It does not own Agent reasoning, Capability policy or confirmation policy. Serving the PWA build as Worker Static Assets does not move product UI logic into Gateway runtime code.

### `workers/agent-control`

Owns ALOHA Agent Control: verified identity/authorization context, Context Envelope policy, Capability exposure, confirmation policy, Conversation/Run product semantics, Runtime selection and runtime-event normalization.

For MVP it selects the n8n Agent backend and invokes it only through the n8n Runtime Adapter. It is not a generic Agent Runtime engine.

### `packages/contracts`

Owns shared ALOHA interaction/context/run/capability/runtime-facing types. Contracts should remain provider/runtime neutral unless a dependency is deliberately part of the boundary.

### `packages/capabilities`

Owns ALOHA-side Capability registry/adapters. It may adapt LifeSpace, HomeMew, n8n and later shared services, but it must not absorb those systems' domain ownership.

### Runtime adapters

The first concrete Runtime Adapter is now selected: **n8n Agent**.

Implementation should give n8n-specific adapter code an explicit owning package/directory and keep provider-specific request/response/session/error mapping there. Do not scatter n8n-specific details across Gateway, client code or generic Agent Control policy.

Do not introduce a generic adapter framework beyond the abstractions actually needed to express the n8n adapter plus the stable Runtime Contract. When a second backend becomes real, use it to discover which parts genuinely belong in shared adapter infrastructure.

## Outside this repository

- **LifeSpace** — Identity（身份）and Shared Reality（共享现实）.
- **HomeMew** — family application/domain capability provider; HomeMew Agent remains independent.
- **Relay** — Delegated Work（委托工作）.
- **Poina** — long-term Memory（长期记忆）infrastructure.
- **Facet** — generative human-Agent interaction runtime.
- **知了** — unified notification infrastructure.
- **n8n** — external workflow/runtime platform and the selected MVP Primary Runtime Backend; it may simultaneously host independent Workflow Capabilities.
- future external Runtime Backend products such as Hermes Agent and OpenClaw.

## MVP implementation order

1. Keep the PWA shell fast and minimal.
2. Stabilize the first-party Interaction Protocol and Context Envelope needed by the MVP.
3. Wire `web -> gateway -> agent-control` with progressive/streaming-friendly contracts.
4. Define the smallest Runtime Contract required by the selected n8n Agent workflow.
5. Implement the n8n Runtime Adapter and run one real ALOHA Run through the n8n Agent workflow.
6. Add one direct capability exposed to that Agent.
7. Add one **separate** n8n workflow capability to prove the Runtime/Capability roles can coexist cleanly.
8. Add one authorized LifeSpace / HomeMew read-write scenario.
9. Normalize the real n8n execution states/results into the ALOHA first-party Run/Stream event model.
10. Only then expand richer context, voice, memory, delegation, generative interaction or evaluate a second Runtime Backend.

Do not build a generic Agent Framework merely to make Runtime backends theoretically interchangeable. Keep the stable ALOHA semantic boundary small; n8n Agent is the concrete MVP implementation, while replacement compatibility is preserved by keeping n8n-native semantics behind the Runtime Adapter.
