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
6. Agent Control immediately consumes that Core-only token for the requested LifeSpace GET operation.
7. LifeSpace Core re-evaluates current Application × Model Access, User -> Agent Delegation, Space/Data Grant, model policy and published model capability.
8. Runtime Discovery or the read result is returned to n8n; LifeSpace credentials are not returned.

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
                        -> LifeSpace Core: discovery / query / get
```

## Capability vs Tool

M4 does not turn LifeSpace into an ALOHA-managed Capability（ALOHA 管理能力）.

- `capabilities[]` remains the surface for ALOHA-owned capabilities such as `math.calculate`.
- `tools[]` describes Runtime Tools owned by another provider/integration boundary.
- The first LifeSpace Tool is mediated by Agent Control only because delegated user authority must not be handed to the external Runtime.
- Mediation does **not** make Agent Control the LifeSpace authorization or domain-semantics authority.

The additive optional `tools` field keeps Canonical Run Envelope v1 compatible with M1-M3 Runtime consumers that ignore provider tools.

## M4 read contract

`lifespace.read` intentionally exposes only three read operations:

- `discover` — call LifeSpace `/me/_discovery` and learn the currently reachable Spaces, model routes, fields, query metadata and effective access;
- `query` — GET a discovered model collection using the published Generic Runtime query syntax;
- `get` — GET one record from a discovered model route.

The Tool does not contain a copied Task schema. A Runtime must discover model routes and query metadata before it queries them.

The ALOHA adapter validates transport shape and allows only GET-class behavior. LifeSpace remains responsible for deciding whether a requested model/Space/query is currently authorized and semantically valid.

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

## n8n workflow

`examples/n8n/m4-lifespace-read-tool.workflow.json` is the credential-free reference workflow.

The workflow connects two HTTP Request Tools to the n8n AI Agent:

- `LifeSpace Discover` — fixed `discover` call;
- `LifeSpace Query` — query parameters selected by the model only after discovery.

Both nodes read the invocation URL and Authorization value dynamically from `body.tools`. The workflow therefore does not contain a LifeSpace credential or a hard-coded LifeSpace model route.

The system prompt is behavioral guidance only. Enforcement remains in Agent Control and LifeSpace.

## Acceptance for the M4 slice

Source/integration verification must prove:

- trusted Run identity preserves User Principal / Agent Actor / Application Context;
- unconfigured M4 environments expose no LifeSpace Tool;
- n8n receives an ALOHA Run-scoped Tool Grant but no LifeSpace credential;
- invoking `discover` causes Agent Control to mint a delegated token with only `resources:read`;
- the delegated token is used only on the trusted Agent Control -> LifeSpace Core hop;
- Runtime Discovery returns only current LifeSpace-authorized surfaces;
- representative Task query/read succeeds once LifeSpace M4 authority is provisioned;
- an out-of-authority read is denied by LifeSpace and is not converted into success by ALOHA;
- no mutation/action path exists in M4.

Deployment activation remains incomplete until the LifeSpace application/model/delegation prerequisites are provisioned and the real ALOHA -> n8n -> `lifespace.read` Golden Flow is verified.

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
