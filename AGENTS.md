# ALOHA Assistant Agent Instructions

ALOHA Assistant is the user's personal Agent product: a personal super-assistant / digital chief of staff. It is not a generic multi-Agent platform and it is not the HomeMew family Agent.

This repository owns the ALOHA product experience, thin Gateway（网关）, ALOHA Agent Runtime（智能体运行时）, and ALOHA-side Capability（能力）contracts/adapters. LifeSpace, HomeMew, Relay, Poina, Facet, 知了 and other shared infrastructure remain independently owned systems.

## Read before making changes

Read in this order:

1. `README.md` for the current MVP goal and repository scope;
2. `docs/architecture.md` for current runtime boundaries and implementation order;
3. the nearest nested `AGENTS.md` for every directory changed;
4. relevant contracts, tests, Wrangler configuration and implementation.

If a required source of truth does not yet exist, establish the smallest explicit contract/decision before implementing behavior that depends on it.

## Sources of truth

- Product boundary and MVP acceptance: `README.md`
- Current runtime topology and repository boundaries: `docs/architecture.md`
- Client ↔ Gateway ↔ Agent / Capability shared types: `packages/contracts`
- ALOHA-side capability registration/adaptation: `packages/capabilities`
- Deployable behavior: `apps/*` and `workers/*`
- Verified behavior: automated tests once present
- Deployment/runtime bindings: each deployable unit's Wrangler/Vite configuration

Planned behavior is not implemented behavior. Do not make README/docs imply that a planned integration is already available.

## Architecture lens

Preserve the MVP path:

`PWA -> Gateway -> ALOHA Agent Runtime -> Capability -> real execution`

Keep these concepts separate:

- **Principal（权限主体）**: whose authority is being exercised;
- **Actor（执行者）**: who/what executes or initiates the operation;
- **Application Context（应用上下文）**: ALOHA as the application through which the operation occurs.

ALOHA may act for the user, but it does not gain authority merely because it is the Actor. Access to LifeSpace/HomeMew is always bounded by verified user authority/delegation and ALOHA application scope.

## Mandatory boundaries

### ALOHA vs HomeMew Agent

- ALOHA Assistant and HomeMew Agent are independent, peer Agent products.
- Do not make one Agent the internal implementation of the other.
- Reuse stable Capability / Tool / SDK / Protocol abstractions beneath them when there is a real shared consumer; do not prematurely create a generic Agent framework.

### Gateway（网关）

- Keep Gateway thin: admission, authentication handoff, protocol normalization, session/stream transport and routing.
- Do not place model reasoning, tool planning, long-running workflow orchestration or domain ownership in Gateway.
- The external interaction protocol must not be PWA-specific; future channels should be able to reuse it.

### ALOHA Agent Runtime（智能体运行时）

- Runtime owns ALOHA-specific context assembly, model/tool loop, capability selection, confirmation policy and interaction-state coordination.
- n8n is a Workflow / Integration Capability（工作流 / 集成能力）, not ALOHA Core and not the Agent Runtime.
- Keep model/provider/orchestration choices replaceable behind explicit boundaries.

### Capability（能力）

- ALOHA should consume external domain abilities through explicit capabilities/adapters instead of copying their business logic into this repository.
- LifeSpace remains the Identity（身份）/ Shared Reality（共享现实）authority for data it owns.
- HomeMew remains the family product/domain capability provider for HomeMew-owned behavior.
- Relay（委托工作）, Poina（长期记忆）, Facet（生成式人机交互）, 知了（通知） and other infrastructure stay independently owned and are integrated through contracts.
- Do not add a shared package merely to remove small duplication; require a stable abstraction and a concrete consumer.

### Authorization and high-impact actions

- Never trust client-supplied `userId`, principal IDs, Space IDs or scopes as authorization authority.
- Authentication and authorization must be derived from verified credentials/context at the trusted boundary.
- Preserve Principal / Actor attribution when an Agent acts on behalf of a user.
- High-impact external sends, important mutations and irreversible actions must preserve an explicit confirmation path unless a deliberately scoped automation policy says otherwise.
- Never commit secrets, tokens, provider keys, personal data or production/staging credentials.

## Contract workflow

When changing externally observable behavior:

1. change the owning contract/type first when applicable;
2. update architecture docs when a boundary changes;
3. update implementation;
4. add positive, failure and authorization/deny-path tests appropriate to the change;
5. verify downstream compatibility across `web`, `gateway`, `agent` and affected capabilities.

Do not duplicate a protocol shape independently in multiple workspaces when it belongs in `packages/contracts`.

## Repository discipline

- Keep product UI in `apps/web`.
- Keep independently deployable edge/runtime services in `workers`.
- Keep only ALOHA-internal reusable contracts/adapters in `packages`.
- Keep stable architectural decisions in `docs`; do not turn architecture documents into transient task logs.
- Keep staging/production bindings isolated and environment-specific resource identifiers out of source code where practical.
- Prefer the smallest implementation that proves the next MVP invariant; preserve extension points rather than speculative frameworks.
- The old `aloha-assistant-pwa` repository is historical reference only, not a compatibility or migration baseline.

## Change completion

Before declaring a change complete, inspect the coupled surfaces that apply: UI, interaction contract, Gateway, Agent Runtime, Capability registry/adapter, authentication/authorization, streaming/error semantics, docs, tests, deployment configuration and external-system compatibility.

At minimum run the repository `check` command once it exists for the changed baseline. If a check cannot run because the scaffold is incomplete, state that explicitly and do not describe the unverified behavior as working.