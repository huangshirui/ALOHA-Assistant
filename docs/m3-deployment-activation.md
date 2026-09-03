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

The non-secret platform-side requirements are owned by the LifeSpace integration profile for ALOHA. M3 requires:

- one active trusted Web application for ALOHA;
- `profile:read` in the application's allowed user scope ceiling;
- one active ALOHA Agent identity bound to the same application;
- one active Cloudflare Access audience registration for the ALOHA Web application;
- Identity Application Contract `0.6.0` compatibility.

M3 intentionally grants no ordinary Core model access and requires no User -> Agent Delegation yet. Those authority surfaces are added only with the first concrete LifeSpace Runtime Tool milestone.

The Cloudflare Access audience value and all `lsa_*` plaintext credentials are deployment-only values and must never be committed to this repository.

## ALOHA Agent Control configuration

The Agent Control Worker requires both settings below before trusted product Runs are enabled:

- `LIFESPACE_IDENTITY_BASE_URL` — deployment-local LifeSpace Identity HTTPS origin;
- `LIFESPACE_APPLICATION_CREDENTIAL` — server-only active `lsa_*` credential for the registered ALOHA application.

`LIFESPACE_APPLICATION_CREDENTIAL` must be a Worker secret. The Identity base URL may be injected as deployment configuration, but the public repository must not contain live infrastructure identifiers.

Existing Runtime and M2 Capability configuration remains independently required:

- `N8N_AGENT_WEBHOOK_URL`;
- `N8N_AGENT_AUTH_TOKEN` when the selected n8n webhook requires it;
- `CAPABILITY_GRANT_SIGNING_KEY` for ALOHA-managed Runtime-callable Capabilities.

## Cloudflare Access boundary

The public Gateway/Web origin must be protected by the intended Cloudflare Access application so that a successful browser request reaches Gateway with a server-injected `Cf-Access-Jwt-Assertion` header.

Gateway forwards the original `Request` through the `AGENT_CONTROL` Service Binding. Agent Control does not trust Cloudflare Access merely because the request passed Gateway: it exchanges the raw assertion through LifeSpace Identity, which independently validates Access signature, issuer, audience registration and `(iss, sub) -> usr_*` mapping.

Do not replace this with browser-supplied `userId`, email, decoded Access claims or another unsigned identity hint.

## Pre-merge candidate deployment

Normal push deployment remains `main`-only. Because M3 requires real deployment evidence before the draft pull request becomes merge-ready, pre-merge acceptance uses the existing manual `workflow_dispatch` entry point with `feat/m3-canonical-run-state` selected as the workflow ref.

That manual run is a production candidate deployment, not a second environment or a bypass around repository checks. It still executes the repository verification and the M1/M2 deployed smoke gates before the M3 identity gate is run separately. Do not use a pull-request-triggered privileged deployment or expose deployment secrets to untrusted code.

After M3 acceptance succeeds, merge the already-verified source through the normal branch rules. The subsequent `main` deployment remains the canonical production deployment and must keep M1/M2 gates green.

## Real M3 verifier

Use the repository verifier only with short-lived deployment credentials that remain outside source control and logs:

```bash
ALOHA_GATEWAY_URL="https://<access-protected-gateway>" \
CF_ACCESS_AUTHORIZATION_COOKIE="<current-CF_Authorization-cookie-value>" \
npm run verify:m3-runtime
```

For a controlled direct test in which the request already reaches Gateway without a second Access edge evaluation, the verifier can instead receive the raw signed application assertion:

```bash
ALOHA_GATEWAY_URL="https://<gateway>" \
CF_ACCESS_JWT_ASSERTION="<current-signed-access-assertion>" \
npm run verify:m3-runtime
```

Never store either value in repository files, GitHub workflow inputs, screenshots, shell history intended for sharing, or long-lived CI secrets. A normal production acceptance should prefer the Access-protected origin plus the short-lived `CF_Authorization` cookie so the test also proves the real browser perimeter.

## What the verifier proves

The verifier performs three observations without printing Runtime output or credential material:

1. submits a synthetic request using an unknown `cnv_*` identifier and requires `404 conversation_not_found`;
   - the legacy identity-null path would not enforce trusted per-user Conversation existence, so this distinguishes the real M3 state path;
2. submits a synthetic Interaction without a Conversation ID and requires a completed Run with a server-issued Conversation and Run ID;
3. submits another synthetic Interaction using that Conversation ID and requires completion in the same Conversation with a different Run ID.

Together these checks establish that trusted LifeSpace identity resolution and durable Conversation / Run admission are active end to end. Runtime output content itself is not part of the assertion.

## Production acceptance

M3 is production-active only when all of the following are true:

1. PR/source CI remains green;
2. Agent Control deploys with the SQLite-backed `AlohaUserState` Durable Object binding;
3. LifeSpace ALOHA application, Access audience and exactly one active ALOHA Agent are provisioned;
4. Agent Control has both LifeSpace Identity settings;
5. an actual Access-authenticated request resolves to a LifeSpace `usr_*` and completes;
6. `npm run verify:m3-runtime` passes against the deployed environment;
7. M1/M2 smoke verification remains green.

After this gate passes, the M3 pull request may be marked ready and merged according to normal repository rules. M4 domain Runtime Tools and Delegation remain a separate milestone.
