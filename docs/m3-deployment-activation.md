# M3 Deployment Activation

> Status: **operational acceptance for M3**. Canonical Run Envelope v1 and durable Conversation / Run state are source-implemented separately; this document defines the deployment configuration and evidence required before M3 is considered production-active.

## Goal

M3 production activation proves this real path:

```text
Cloudflare Access authenticated user
  -> Gateway（网关）
  -> Agent Control（智能体控制层）
  -> LifeSpace Identity
       Principal = usr_*
       Actor = ALOHA agt_*
       Application Context = ALOHA application
  -> durable ALOHA Conversation / Run state
  -> Canonical Run Envelope v1（规范运行信封 v1）
  -> n8n Agent Runtime Backend（运行时后端）
```

The legacy identity-null M1/M2 deployment smoke path is not sufficient evidence for this gate.

## LifeSpace configuration

The non-secret platform-side requirements are owned by the LifeSpace `infra/aloha-integration-profile.json` integration profile. M3 requires:

- one active trusted Web application for ALOHA;
- `profile:read` in the application's allowed user scope ceiling;
- one active ALOHA Agent identity bound to the same application;
- one active Cloudflare Access audience registration for the ALOHA Web application;
- Identity Application Contract `0.6.0` / schema v8+ compatibility.

M3 intentionally grants no ordinary Core model access and requires no User -> Agent Delegation yet. Those authority surfaces are added only with the first concrete LifeSpace Runtime Tool milestone.

LifeSpace also owns `infra/scripts/prepare-production-aloha-access.mjs`, which can create/reconcile the production application, register the deployment-provided Access audience and establish the single active ALOHA Agent without committing deployment credentials.

The Cloudflare Access audience value and all `lsa_*` plaintext credentials are deployment-only values and must never be committed to this repository.

## ALOHA Agent Control configuration

The Agent Control Worker requires both settings below before trusted product Runs are enabled:

- `LIFESPACE_IDENTITY_BASE_URL` — deployment-local LifeSpace Identity HTTPS origin;
- `LIFESPACE_APPLICATION_CREDENTIAL` — server-only active `lsa_*` credential for the registered ALOHA application.

For the current M3 production workflow, **store both as Agent Control Worker secrets**. The base URL is not intrinsically secret, but keeping both deployment-local settings in the same secret inventory lets deployment automation detect the activation state without committing live infrastructure identifiers.

The deployment workflow treats these states explicitly:

- neither secret exists -> legacy pre-M3 deployment mode;
- both secrets exist -> trusted M3 mode;
- only one exists -> invalid partial configuration; deployment verification fails closed.

Existing Runtime and M2 Capability configuration remains independently required:

- `N8N_AGENT_WEBHOOK_URL`;
- `N8N_AGENT_AUTH_TOKEN` when the selected n8n webhook requires it;
- `CAPABILITY_GRANT_SIGNING_KEY` for ALOHA-managed Runtime-callable Capabilities.

## Cloudflare Access boundary

The Gateway has two different inbound trust classes and they must not be collapsed into one Access rule.

### Human Interaction / PWA entry

The public Gateway/Web Worker is protected by Cloudflare Access. A successful human request therefore reaches Gateway with a server-injected `Cf-Access-Jwt-Assertion` header.

Gateway forwards the original `Request` through the `AGENT_CONTROL` Service Binding. Agent Control does not trust Cloudflare Access merely because the request passed Gateway: it exchanges the raw assertion through LifeSpace Identity, which independently validates Access signature, issuer, audience registration and `(iss, sub) -> usr_*` mapping.

Do not replace this with browser-supplied `userId`, email, decoded Access claims or another unsigned identity hint.

### Runtime Capability callback exception

M2 Runtime Capabilities are called back by the external n8n Runtime at:

```text
/v1/runtime/capabilities/*
```

The Runtime has an ALOHA-issued short-lived Capability Grant, not a human Cloudflare Access session. If Worker-level Access were applied with no exception, n8n could no longer reach this path and M3 activation would regress the already-verified M2 capability flow.

Therefore configure a **more-specific hostname/path Access application** for the Gateway's `/v1/runtime/capabilities/*` path with a narrowly scoped `Bypass` policy for `Everyone`. Cloudflare's path-specific Access rule takes precedence over broader Worker-level protection.

This bypass removes only the Cloudflare human-session requirement. It does **not** make the capability callable without ALOHA authority:

- the route still requires the signed short-lived ALOHA Capability Grant;
- missing grants fail with `capability_grant_required`;
- invalid/expired grants fail closed;
- Capability exposure remains Run-scoped and controlled by Agent Control.

Do not create a broader Worker-level bypass and do not bypass `/v1/interactions`.

Recommended ordering is to create the narrow capability-path bypass first, then enable Access for the broader Gateway Worker. This avoids even a temporary M2 callback outage.

## Pre-merge candidate deployment

Normal push deployment remains `main`-only. Because M3 requires real deployment evidence before the draft pull request becomes merge-ready, pre-merge source acceptance uses the existing manual `workflow_dispatch` entry point with `feat/m3-canonical-run-state` selected as the workflow ref.

Before LifeSpace Identity is activated, that candidate deployment still executes the automated legacy M1/M2 smoke gates. Once both LifeSpace Identity Worker secrets exist, the workflow detects trusted mode and intentionally stops running unauthenticated M1/M2 interaction probes; those requests can no longer represent a real product user after Access/Identity activation.

This is not a reduction in M1/M2 acceptance. In trusted mode the same M1 and M2 verifiers support a short-lived authenticated Access session and are run together with the M3 verifier against the real product boundary.

## Authenticated M1 / M2 / M3 acceptance

Use a current short-lived Cloudflare Access browser session and keep the cookie outside source control, GitHub workflow inputs, screenshots and shared shell history.

```bash
export ALOHA_GATEWAY_URL="https://<access-protected-gateway>"
export CF_ACCESS_AUTHORIZATION_COOKIE="<current-CF_Authorization-cookie-value>"

npm run verify:m1-runtime
npm run verify:m2-runtime
npm run verify:m3-runtime
```

The three gates prove different invariants:

- M1: real Runtime path, canonical event ordering and safe public failure;
- M2: Capability Grant fail-closed boundary plus the real n8n -> ALOHA `math.calculate` callback path;
- M3: trusted LifeSpace identity plus durable Conversation / Run admission.

`verify:m2-runtime` also detects a common Access misconfiguration: if the Capability callback path redirects to Access rather than reaching ALOHA's own grant gate, the verifier fails and instructs the operator to fix the narrow path bypass.

For a controlled direct test in which the request already reaches Gateway without a second Access edge evaluation, all three verifiers may instead receive:

```bash
CF_ACCESS_JWT_ASSERTION="<current-signed-access-assertion>"
```

The normal production acceptance should prefer the Access-protected origin plus the short-lived `CF_Authorization` cookie so the test also proves the real browser perimeter.

## What the M3 verifier proves

The M3 verifier performs three observations without printing Runtime output or credential material:

1. submits a synthetic request using an unknown `cnv_*` identifier and requires `404 conversation_not_found`;
   - the legacy identity-null path would not enforce trusted per-user Conversation existence, so this distinguishes the real M3 state path;
2. submits a synthetic Interaction without a Conversation ID and requires a completed Run with a server-issued Conversation and Run ID;
3. submits another synthetic Interaction using that Conversation ID and requires completion in the same Conversation with a different Run ID.

Together these checks establish that trusted LifeSpace identity resolution and durable Conversation / Run admission are active end to end. Runtime output content itself is not part of the M3 persistence assertion.

## Activation sequence

1. Deploy the M3 candidate from `feat/m3-canonical-run-state` with `workflow_dispatch` while production still uses the legacy identity-null mode; source checks and legacy M1/M2 smoke must pass.
2. Configure the narrow `/v1/runtime/capabilities/*` Access bypass for the deployed Gateway hostname.
3. Enable the broader Cloudflare Access protection for the Gateway Worker / human entry path and obtain its application Audience (`aud`) tag.
4. Run LifeSpace `infra/scripts/prepare-production-aloha-access.mjs` with the deployment-local AUD and bootstrap secret; store any newly issued `lsa_*` only in the script's secure temporary output.
5. Install `LIFESPACE_IDENTITY_BASE_URL` and `LIFESPACE_APPLICATION_CREDENTIAL` as Agent Control Worker secrets. Both must be installed together.
6. Using a real Access-authenticated browser session, run authenticated M1, M2 and M3 verification against the candidate deployment.
7. If all gates pass, mark the ALOHA M3 pull request ready and merge it through normal branch rules.
8. Let `main` perform the canonical production deployment. The workflow will detect trusted Identity mode and will not run obsolete unauthenticated interaction smoke.
9. Run the authenticated M1/M2/M3 gates once more against the canonical `main` deployment. Only then mark M3 production-active.

## Production acceptance

M3 is production-active only when all of the following are true:

1. PR/source CI remains green;
2. Agent Control deploys with the SQLite-backed `AlohaUserState` Durable Object binding;
3. LifeSpace ALOHA application, Access audience and exactly one active ALOHA Agent are provisioned;
4. Agent Control has both LifeSpace Identity Worker secrets and no partial configuration;
5. Gateway human entry is Access-protected while `/v1/runtime/capabilities/*` uses only the narrow path-specific Access bypass;
6. an actual Access-authenticated request resolves to a LifeSpace `usr_*` and completes;
7. authenticated `npm run verify:m1-runtime`, `npm run verify:m2-runtime` and `npm run verify:m3-runtime` all pass against the canonical production deployment.

M4 domain Runtime Tools and User -> Agent Delegation remain a separate milestone.
