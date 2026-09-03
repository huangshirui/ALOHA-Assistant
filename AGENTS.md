# ALOHA Assistant Agent Instructions

ALOHA Assistant is the user's personal Agent product: a personal super-assistant / digital chief of staff. It is not a generic multi-Agent platform, not a generic Agent Framework, and not the HomeMew family Agent.

This repository owns the ALOHA product experience, first-party interaction semantics, thin Gateway（网关）, ALOHA Agent Control（智能体控制层）, Runtime Contract / adapters, and ALOHA-side Capability（能力）contracts/adapters. **It does not require ALOHA to own or implement a generic Agent Runtime engine.** Runtime Backends（运行时后端）are replaceable and may be external products/services or custom implementations.

LifeSpace, HomeMew, Relay, Poina, Facet, 知了 and other shared infrastructure remain independently owned systems.

## Open-source and public-repository safety model

This is an **open-source project**. Treat every tracked file, commit, branch, pull request, issue, review comment, CI log/artifact, screenshot, fixture, generated example and documentation snippet as if it can become public and permanently indexed.

The repository is source code and public documentation only. It is **not** a storage location for private user context or live infrastructure configuration.

### Never publish private or sensitive data

Do not commit, paste, generate, snapshot, log, fixture, test with, or otherwise expose:

- personal conversations, prompts, memories, emails, contacts, calendars, tasks, files, photos, voice/audio, precise location, identifiers, health/financial/family data, or other real user content;
- production/staging datasets, exports, database dumps, request/response captures, analytics samples, traces or logs that may contain real user or tenant data;
- secrets or credentials of any kind: API keys, OAuth client secrets, access/refresh tokens, JWTs, cookies, session values, private keys, webhook secrets, service-account material, passwords, recovery codes or signed URLs;
- non-public infrastructure details: provider account/resource identifiers, origin IPs, private hostnames/routes, Access audience/team identifiers, deployment-only topology, private repository/document links, or equivalent live metadata;
- values retrieved through connected tools or personal systems unless the value is explicitly intended to be public and necessary for the repository.

Use synthetic examples only. Use `example.com`, invented people/content and clearly fake identifiers. Never "anonymize" a real private payload and commit it.

Runtime secrets and live configuration must be injected through deployment/platform secret/configuration mechanisms and must never be committed. Tracked config files contain portable public configuration or safe placeholders only.

If sensitive material is found, stop propagation, rotate/revoke secrets as appropriate, and treat Git history as persistent until explicitly cleaned.

## Licensing and third-party material

- The repository is licensed under **GNU Affero General Public License v3.0 or later (`AGPL-3.0-or-later`)** unless a file explicitly states otherwise.
- Do not change licensing or introduce incompatible third-party code/assets without explicit project-owner approval.
- Before copying code, prompts, schemas or substantial text from another project, verify licensing/attribution requirements. Publicly accessible does not mean reusable.

## Read before making changes

Read in this order:

1. `README.md` for the current product boundary and MVP goal;
2. `docs/architecture.md` for architecture/runtime boundaries;
3. the nearest nested `AGENTS.md` for every directory changed;
4. relevant contracts, tests, configuration and implementation.

If a required source of truth does not exist, establish the smallest explicit contract/decision before implementing behavior that depends on it.

## Sources of truth

- Product boundary and MVP acceptance: `README.md`
- Architecture and repository boundaries: `docs/architecture.md`
- Runtime trust, independent Runtime authority and confirmation security boundary: `docs/runtime-trust-authority.md`
- First-party interaction and UI behavior: relevant `docs/*` product specs
- Shared ALOHA interaction/context/run/capability/runtime-facing types: `packages/contracts`
- ALOHA Capability registration/adaptation: `packages/capabilities`
- Deployable behavior: `apps/*` and `workers/*`
- Verified behavior: automated tests once present
- Deployment bindings: each deployable unit's configuration

Planned behavior is not implemented behavior. Do not make README/docs imply that a planned Runtime integration is already available.

## Architecture lens

Preserve the logical MVP path:

`PWA -> Gateway -> Agent Control -> Runtime Adapter -> Runtime Backend -> Capability -> real execution`

Physical deployment may collapse some logical layers, but code/contract responsibilities must remain explicit.

Keep these concepts separate:

- **Principal（权限主体）**: whose authority is being exercised;
- **Actor（执行者）**: who/what executes or initiates the operation;
- **Application Context（应用上下文）**: ALOHA as the application through which the operation occurs.

ALOHA may act for the user, but it does not gain authority merely because it is the Actor. Access to LifeSpace/HomeMew is bounded by verified user authority/delegation and ALOHA Application scope.

## Mandatory boundaries

### ALOHA vs HomeMew Agent

- ALOHA Assistant and HomeMew Agent are independent, peer Agent products.
- Do not make one Agent the internal implementation of the other.
- Reuse stable Capability / Tool / SDK / Protocol abstractions only when there is a real shared consumer.

### First-party client and ALOHA Interaction Protocol（交互协议）

- ALOHA owns its personalized first-party client experience and may evolve interaction semantics beyond generic chat protocols.
- Progressive/streaming Run state, approvals, artifacts, annotations and richer UI events may become first-class ALOHA protocol semantics.
- Do not constrain the first-party protocol to the lowest common denominator of third-party channels or a Runtime provider API.
- Client-collected context such as location/device/selection is contextual evidence. Preserve source/freshness/consent semantics where relevant; never treat it as authorization authority.

### Gateway（网关）

- Keep Gateway thin: request admission, authentication handoff, channel adaptation, protocol normalization, session/stream transport, routing and transport controls.
- Gateway answers **how requests enter/leave ALOHA**, not **how ALOHA reasons**.
- Do not place model reasoning, Capability policy, confirmation policy, long-running workflow orchestration or domain ownership in Gateway.
- The Gateway must support first-party ALOHA interaction semantics and adapters for third-party channels such as WeCom / Feishu without letting those channels define ALOHA's core protocol.

### Agent Control（智能体控制层）

- Agent Control owns ALOHA product semantics around a Run: verified Identity/Principal context, authorization context, Context Envelope policy, ALOHA-managed Capability exposure policy, confirmation policy, Conversation / Run semantics, Runtime selection and canonical event normalization.
- Agent Control may narrow what ALOHA exposes or executes for the current Run, but it cannot revoke tools, credentials or authority that a Runtime Backend already owns independently unless that Runtime provides a real enforceable control used by the adapter.
- Agent Control is **not** a generic Agent Runtime / Framework and must not grow a model/tool loop merely because no Runtime Backend has been selected yet.
- Runtime-specific SDK/protocol/session/event details must stay behind explicit Runtime Adapters.
- ALOHA canonical events must not be defined by a single Runtime backend's native event types.

### Runtime Contract / Runtime Backend（运行时契约 / 运行时后端）

- Runtime Backend is replaceable. Candidate backends include Hermes Agent, OpenClaw, n8n Agent workflows, OpenAI-compatible Agent services, Cloudflare Agents, custom Python/TypeScript runtimes and future systems.
- OpenAI Responses / Chat-style APIs may be compatibility profiles, but they are not automatically ALOHA's first-party product protocol.
- Do not design for multi-cloud or multi-runtime active-active by default. Keep one Primary Runtime and preserve a small replacement boundary.
- Do not force all runtimes into a lowest-common-denominator abstraction. Stable core semantics may coexist with optional runtime capabilities.
- Backend-private execution/session state may be backend-specific; authoritative ALOHA/user data must remain in its owning system.
- Prompt/system instructions are behavior guidance, **not an authorization boundary**. Hard confinement requires credential isolation, ALOHA-mediated invocation, downstream authorization checks, or enforceable Runtime tool/sandbox controls.

### Capability（能力）

- A Runtime receives only the **ALOHA-managed capabilities that ALOHA exposes** under verified Principal authority × ALOHA Application scope × current Run policy. This statement does not imply that ALOHA controls independent Runtime-native tools.
- A Capability is an explicit callable boundary, not a place to copy another system's business logic into ALOHA.
- LifeSpace remains the Identity / Shared Reality authority for data it owns; ALOHA consumes its verified identity/effective authority and does not duplicate LifeSpace Membership / Grant / Agent Delegation / model authorization logic.
- HomeMew remains the family product/domain capability provider for HomeMew-owned behavior.
- Relay（委托工作）, Poina（长期记忆）, Facet（生成式人机交互）, 知了（通知） and other infrastructure stay independently owned and are integrated through contracts.
- n8n may be either (a) a Workflow / Integration Capability called by another Runtime, or (b) an Agent Runtime Backend when an n8n workflow itself is configured as an Agent. Keep the two roles explicit.

### Authorization and high-impact actions

- Never trust client-supplied `userId`, Principal IDs, Space IDs, grants or scopes as authorization authority.
- Authentication and authorization must be derived from verified credentials/context at a trusted boundary.
- Preserve Principal / Actor / Application attribution through Agent Control, Runtime and Capability calls.
- High-impact external sends, important mutations and irreversible actions require an explicit confirmation path unless a deliberately scoped automation policy says otherwise.
- Confirmation is bound to the concrete proposed action and its critical parameters; it is not a reusable domain permission. Material changes after confirmation require new confirmation unless an explicit scoped automation policy covers the changed action.
- Confirmation enforcement must happen in trusted code outside the model. A Prompt instruction to "ask first" is insufficient.

## Context Envelope（上下文信封）

Treat context as structured product input, not merely prompt text. Expected categories include server-verified Identity/Authorization context, environment/time/locale, device context, location with accuracy/timestamp/consent, interaction state/selection/annotation, and resource references.

Context that can affect authority must come from trusted server-side sources. Client-provided context must remain distinguishable from verified context.

## Contract workflow

When changing externally observable behavior:

1. change the owning contract/type first when applicable;
2. update architecture docs when a boundary changes;
3. update implementation;
4. add positive, failure and authorization/deny-path tests appropriate to the change;
5. verify compatibility across Web, Gateway, Agent Control, Runtime Adapter and affected Capabilities.

Do not duplicate protocol shapes independently when they belong in `packages/contracts`.

## Repository discipline

- Keep product UI in `apps/web`.
- Keep independently deployable ALOHA edge/control services in `workers`.
- Keep only ALOHA-internal reusable contracts/adapters in `packages`.
- Give concrete Runtime Adapters an explicit owning directory/package when the first backend is integrated; do not scatter provider-specific code across Gateway or Agent Control.
- Keep stable architectural decisions in `docs`; do not turn architecture documents into transient task logs.
- Keep live environment/resource identifiers and secrets outside source control.
- Prefer the smallest implementation that proves the next MVP invariant; preserve real extension points rather than speculative frameworks.
- The old `aloha-assistant-pwa` repository is historical reference only, not a compatibility/migration baseline.

## Change completion

Before declaring a change complete, inspect the coupled surfaces that apply: UI, Interaction Protocol, Context Envelope, Gateway, Agent Control, Runtime Contract/Adapter, Capability registry/adapter, authentication/authorization, confirmation, streaming/error semantics, docs, tests, deployment configuration and external-system compatibility.

For every change, perform a public-repository safety pass over the diff: confirm that no private user data, credentials, live infrastructure details or non-public connector content was introduced.

At minimum run the repository `check` command once the environment supports it. If a check cannot run, state that explicitly and do not describe unverified behavior as working.
