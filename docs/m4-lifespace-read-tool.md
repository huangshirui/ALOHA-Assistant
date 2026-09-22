# M4 LifeSpace Read Runtime Tool

M4 introduces ALOHA's first useful Runtime Tool（运行时工具）provider: a read-only LifeSpace Core path consumed by the controlled n8n Agent Runtime.

This milestone deliberately proves **Identity（身份） + delegated authority（委托权限） + Runtime Discovery（运行时发现） + representative Task read/query** before any LifeSpace mutation or ALOHA Confirmation（确认）flow is added.

## Outcome

For an authenticated ALOHA Run:

1. Agent Control resolves the LifeSpace User Principal（用户权限主体）, ALOHA Agent Actor（Agent 执行者） and ALOHA Application Context（应用上下文） through the trusted M3 Identity path.
2. Canonical Run Envelope v1 may carry a `tools` array in addition to ALOHA-managed `capabilities`.
3. When the trusted M4 configuration is complete, the Runtime receives a `lifespace.read` Tool descriptor with:
   - a JSON Schema input contract;
   - an ALOHA invocation URL;
   - a short-lived, Run-scoped ALOHA Runtime Tool Grant.
4. n8n calls the ALOHA Tool endpoint. It never receives a LifeSpace application credential, Service API Token or delegated Agent JWT.
5. Agent Control validates the Run-scoped Tool Grant and requests a fresh LifeSpace delegated Agent token with only `resources:read`.
6. Agent Control immediately consumes that Core-only token for the requested LifeSpace read operation. Discovery/semantic detail/Get use GET; Canonical Query uses the current structured POST query transport.
7. LifeSpace Core re-evaluates current Application × Model Access, User -> Agent Delegation, Space/Data Grant, model policy and published model capability.
8. Runtime Discovery, model semantic detail or the read result is returned to n8n; LifeSpace credentials are not returned.

The resulting trust path is:

```text
Browser
  -> Gateway
  -> Agent Control
       |- LifeSpace Identity: resolve User / Agent / Application
       `- Canonical Run Envelope v1
            tools[]: lifespace.read + ALOHA Run-scoped Tool Grant
              -> n8n Agent
                   -> ALOHA lifespace.read invocation
                        -> LifeSpace Identity: delegated Agent token (resources:read)
                        -> LifeSpace Core: inventory / model detail / canonical query / get
```

## Capability vs Tool

M4 does not turn LifeSpace into an ALOHA-managed Capability（ALOHA 管理能力）.

- `capabilities[]` remains the surface for ALOHA-owned capabilities such as `math.calculate`.
- `tools[]` describes Runtime Tools owned by another provider/integration boundary.
- The first LifeSpace Tool is mediated by Agent Control only because delegated user authority must not be handed to the external Runtime.
- Mediation does **not** make Agent Control the LifeSpace authorization or domain-semantics authority.

The additive optional `tools` field keeps Canonical Run Envelope v1 compatible with M1-M3 Runtime consumers that ignore provider tools.

## M4 read contract

`lifespace.read` exposes four read-only operations aligned to the current LifeSpace generic-consumer contract:

- `discover` — call `GET /me/_discovery/inventory` for the compact, current-authority Space/model inventory;
- `describe` — call `GET /spaces/{spaceId}/_discovery/models/{modelKey}` only for the selected model and load its fields plus `query.canonical` semantic descriptor;
- `query` — call `POST /spaces/{spaceId}/models/{modelKey}/records/query` with a structured Canonical Query body;
- `get` — call `GET /spaces/{spaceId}/models/{modelKey}/records/{recordId}`.

The Tool does not contain a copied Task schema or a copied per-model route. The stable Generic Runtime address is derived from `spaceId + modelKey`; model-specific fields, operators, sort/context requirements and current access come from LifeSpace Discovery/semantic detail.

The ALOHA adapter validates only the ALOHA Tool transport/read-operation envelope and never treats its own input shape as LifeSpace semantic authority. For `query`, the controlled n8n reference workflow exposes a small Agent-friendly projection (optional search + bounded page size) and lowers it to the same structured Canonical Query. LifeSpace Core remains responsible for validating the resulting query semantics and current authorization.

## Authority target

M4 production/staging activation should use the minimum LifeSpace authority necessary for the representative flow:

- ALOHA application user scopes: existing `profile:read` plus `resources:read`;
- ALOHA Application × Model Access: `Task` read only for the first slice;
- User -> ALOHA Agent Delegation: `Task` read only for the target Space(s);
- delegated Agent token requested by the Runtime Tool: `resources:read` only.

`resources:write`, Task mutation and `Task.complete` are explicitly outside M4. They belong to M5 together with the first required Confirmation boundary.

LifeSpace remains the final enforcement point. Hiding a model or operation from n8n is not itself an authorization boundary.

## Credential boundary

The following values must never enter the Canonical Run Envelope, n8n workflow data, browser, public repository or ordinary Conversation/Run persistence:

- LifeSpace `lsa_*` application credential;
- LifeSpace `lsp_pat_*` Service API Token;
- LifeSpace delegated Agent JWT;
- Runtime Tool Grant signing key.

n8n receives only the short-lived ALOHA Runtime Tool Grant embedded in the per-Run Tool descriptor. The current grant is read-only and time-bounded; it is not a general ALOHA or LifeSpace credential.

Deployment-only Agent Control configuration for M4 is:

- `LIFESPACE_IDENTITY_BASE_URL`;
- `LIFESPACE_CORE_API_BASE_URL`;
- `LIFESPACE_APPLICATION_CREDENTIAL`;
- `RUNTIME_TOOL_GRANT_SIGNING_KEY`.

No live value belongs in source control.

## Cloudflare Access callback boundary

The human `/v1/interactions` entry remains protected by Cloudflare Access. The external n8n Runtime, however, calls the ALOHA Tool callback at:

```text
/v1/runtime/tools/*
```

n8n has a short-lived ALOHA Runtime Tool Grant, not a human Access session. Therefore production must configure a **more-specific path Access application** for `/v1/runtime/tools/*` with a narrow `Bypass` policy, analogous to the existing M2 `/v1/runtime/capabilities/*` callback exception.

This exception removes only the human Access-session requirement. The route is still protected by Agent Control's signed Tool Grant gate:

- missing grant -> `401 runtime_tool_grant_required`;
- malformed/expired grant -> `401 invalid_runtime_tool_grant`;
- a valid grant is bound to the current Run, Principal, Agent Actor, ALOHA Application and expiry;
- LifeSpace then independently rechecks current delegated authority.

Do not bypass `/v1/interactions` and do not create a broader Worker-wide bypass.

`npm run verify:m4-runtime` checks this deployment boundary without requiring a human Access session: it reaches the public Tool callback and requires ALOHA's own missing/invalid-grant 401 responses rather than an Access redirect or an unrelated 404.

## n8n workflow

`examples/n8n/m4-lifespace-read-tool.workflow.json` is the credential-free reference workflow.

The workflow connects four HTTP Request Tools to the n8n AI Agent:

- `LifeSpace Discover` — compact current-authority inventory;
- `LifeSpace Describe` — progressive semantic detail for one selected `spaceId + modelKey`;
- `LifeSpace Query` — a small search/page projection lowered to structured Canonical Query only after Describe;
- `LifeSpace Get` — one-record read using a LifeSpace record ID.

All four nodes read the invocation URL and Authorization value dynamically from `body.tools`. The workflow therefore contains neither a LifeSpace credential nor a hard-coded LifeSpace model route/Task schema.

The system prompt is behavioral guidance only. Enforcement remains in Agent Control and LifeSpace.

## Acceptance for the M4 slice

Source/integration verification must prove:

- trusted Run identity preserves User Principal / Agent Actor / Application Context;
- unconfigured M4 environments expose no LifeSpace Tool;
- n8n receives an ALOHA Run-scoped Tool Grant but no LifeSpace credential;
- invoking any LifeSpace read operation causes Agent Control to mint a delegated token with only `resources:read`;
- the delegated token is used only on the trusted Agent Control -> LifeSpace Core hop;
- compact Runtime Discovery returns only current LifeSpace-authorized surfaces;
- model semantic detail is loaded progressively and supplies the current Canonical Query descriptor without an ALOHA schema copy;
- representative Task Canonical Query/Get succeeds once LifeSpace M4 authority is provisioned;
- an out-of-authority read is denied by LifeSpace and is not converted into success by ALOHA;
- no mutation/action path exists in M4.

Deployment activation remains incomplete until the LifeSpace application/model/delegation prerequisites are provisioned, the narrow `/v1/runtime/tools/*` Access bypass passes `verify:m4-runtime`, and the real ALOHA -> n8n -> `lifespace.read` Golden Flow is verified.

## Non-goals

M4 does not introduce:

- a generic Tool-provider framework;
- a second ALOHA authorization database;
- a copied LifeSpace Task/Event schema;
- a permanent LifeSpace credential in n8n;
- LifeSpace write/action support;
- Confirmation or approval workflow;
- a second Runtime Backend;
- a claim that every future Runtime Tool must be proxied through Agent Control.
