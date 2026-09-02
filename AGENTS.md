# ALOHA Assistant Agent Instructions

ALOHA Assistant is the user's personal Agent product: a personal super-assistant / digital chief of staff. It is not a generic multi-Agent platform and it is not the HomeMew family Agent.

This repository owns the ALOHA product experience, thin Gateway（网关）, ALOHA Agent Runtime（智能体运行时）, and ALOHA-side Capability（能力）contracts/adapters. LifeSpace, HomeMew, Relay, Poina, Facet, 知了 and other shared infrastructure remain independently owned systems.

## Open-source and public-repository safety model

This is an **open-source project**. Treat every tracked file, commit, branch, pull request, issue, review comment, CI log/artifact, screenshot, fixture, generated example and documentation snippet as if it can become public and permanently indexed.

The repository is source code and public documentation only. It is **not** a storage location for the user's private context or for live infrastructure configuration.

### Never publish private or sensitive data

Do not commit, paste, generate, snapshot, log, fixture, test with, or otherwise expose:

- personal conversations, prompts, memories, emails, contacts, calendars, tasks, files, photos, voice/audio, precise location, identifiers, health/financial/family data, or other real user content;
- production/staging datasets, exports, database dumps, request/response captures, analytics samples, traces or logs that may contain real user or tenant data;
- secrets or credentials of any kind: API keys, OAuth client secrets, access/refresh tokens, JWTs, cookies, session values, private keys, webhook secrets, service-account material, passwords, recovery codes or signed URLs;
- non-public infrastructure details: Cloudflare account/zone/database/namespace/bucket/queue/tunnel identifiers, origin IPs, private hostnames, internal routes, Access audience/team identifiers, deployment-only service topology, provider account identifiers, private repository/document links, or equivalent live resource metadata;
- values retrieved through connected tools such as Gmail, Google Calendar, Notion, GitHub private resources, LifeSpace, HomeMew or other personal systems unless the value is explicitly intended to be public and is necessary for the repository.

Public product names, intentionally public API contracts and deliberately published endpoints are not automatically sensitive, but prefer placeholders whenever a concrete deployment value is not required to understand or test the code.

### Use synthetic examples only

- Examples, fixtures, tests, screenshots and demo payloads must use invented people, invented content and placeholder infrastructure values.
- Use reserved/example domains such as `example.com` and clearly fake identifiers such as `<ACCOUNT_ID>` or `00000000000000000000000000000000` where a concrete shape is required.
- Never "anonymize" a real private payload and then commit it. Build a synthetic payload from scratch.
- `.env.example`, `.dev.vars.example` and configuration templates may contain variable names and safe placeholders only; never copy a live file and redact it in place.

### Keep live configuration outside the repository

- Runtime secrets must be injected through the deployment platform's secret/configuration mechanism, never source control.
- Live environment/resource identifiers that reveal private infrastructure should remain in private deployment configuration or secret/config stores rather than this repository.
- Tracked Wrangler/Vite/config files must contain only portable public configuration or documented placeholders. If a tool requires live identifiers in a local config file, keep the live variant ignored and provide a sanitized template.
- Do not make a private infrastructure detail public merely to simplify local development or CI.

### AI/Agent-specific handling

Agents working on this repository must assume that retrieved context can contain material that is safe to use for reasoning but unsafe to publish.

Before writing any content obtained from a user conversation, connector, private repository, Notion page, production log or external service into the repository, ask: **is this exact value intentionally public and necessary in source?** If the answer is not clearly yes, replace it with a synthetic example or omit it.

Do not reproduce private context in commit messages, PR bodies, issue text, test snapshots or debugging output. Summarize the technical requirement without copying sensitive source material.

### If sensitive material is found

- Stop propagating the value immediately; do not "fix" the leak by adding another commit that merely deletes it.
- Treat secrets as compromised: revoke/rotate them before continuing.
- Treat personal/infrastructure data as persistent in Git history until the history is explicitly cleaned.
- Before any repository visibility change to public, verify both the current tree and relevant Git history are clean.
- Report the incident and the remediation status clearly without repeating the sensitive value.

## Licensing and third-party material

- The repository is licensed under **GNU Affero General Public License v3.0 or later (`AGPL-3.0-or-later`)** unless a file explicitly states otherwise.
- Do not change the project license, add license exceptions, dual-license the project, or introduce incompatible source/assets without explicit project-owner approval.
- Before copying code, assets, prompts, schemas or substantial text from another project, verify its license is compatible and preserve required notices/attribution.
- A publicly accessible source is not necessarily open-source or reusable.

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

For every change, also perform a **public-repository safety pass** over the diff: confirm that no private user data, credentials, live infrastructure details or non-public connector content was introduced, including in fixtures, logs and documentation.

At minimum run the repository `check` command once it exists for the changed baseline. If a check cannot run because the scaffold is incomplete, state that explicitly and do not describe the unverified behavior as working.