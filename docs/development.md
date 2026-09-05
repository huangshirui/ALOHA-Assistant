# Development baseline

## Runtime/toolchain

- Node.js: 22.12+
- Package manager: npm 10
- Workspace layout: npm workspaces
- Web: Vue 3 + Vite + PWA plugin
- Gateway / Agent Control: Cloudflare Workers + Wrangler in the current scaffold
- Agent Runtime Backend: **n8n Agent for the MVP first vertical slice**, reached through `@aloha/runtime-n8n`

The current Gateway / Agent Control hosting choice is an implementation convenience for the scaffold, not an ALOHA platform constraint. Runtime Backends may be external services/products or custom runtimes on other infrastructure.

The toolchain is intentionally independent from LifeSpace's Node/pnpm choice. Shared protocols do not require a shared package manager or hosting platform.

## Install and run

```bash
npm install
npm run dev:web
npm run dev:gateway
npm run dev:agent-control
```

The Web app calls the Gateway only. During local Vite development, `/v1` is proxied to `http://127.0.0.1:8787`. `VITE_GATEWAY_URL` remains available for separately hosted Web variants, but the current production deployment serves the Web/PWA and Gateway API from the same Worker origin and does not require it.

The Gateway uses an `AGENT_CONTROL` Service Binding（服务绑定） to reach the Agent Control worker.

Agent Control selects the n8n Agent Runtime Adapter when `N8N_AGENT_WEBHOOK_URL` is configured. An optional `N8N_AGENT_AUTH_TOKEN` is sent by the adapter as a bearer credential. Both values are deployment configuration and must never be committed with live values.

M2 Direct Capability invocation additionally uses `CAPABILITY_GRANT_SIGNING_KEY` on Agent Control. Agent Control uses it to sign and verify short-lived, Run-scoped Capability Grants（能力授权令牌）. If the key is absent, ordinary Runtime execution remains available but the Runtime receives an empty Capability set. This is deliberately fail-closed.

The public repository intentionally contains no real n8n endpoint, token, capability signing key, temporary capability grant or workflow execution data. Without `N8N_AGENT_WEBHOOK_URL`, interaction admission returns `runtime_backend_not_configured`.

The current n8n Agent workflow contract expects a JSON response shaped as:

```json
{
  "outputText": "Synthetic example response",
  "backendRunId": "optional-synthetic-correlation"
}
```

`backendRunId` is optional and remains backend correlation only; it is not the ALOHA Run identity.

M2 capability details and the credential-free n8n workflow template are documented in `docs/direct-capability.md`.

## Repository validation

```bash
npm run check
```

`check` performs:

1. TypeScript validation for all workspaces that expose `typecheck`;
2. behavioral tests for workspaces that expose `test`;
3. validation of public n8n workflow assets;
4. Web production build;
5. Gateway Wrangler dry-run build;
6. Agent Control Wrangler dry-run build.

The runtime/capability slices include adapter, Capability registry/execution, Agent Control authorization/invocation, Gateway routing and safe-failure tests. Real deployed n8n execution remains a separate integration verification step because live Runtime and Capability secrets are intentionally outside the repository.

## Runtime development rule

Do not add generic Agent-loop logic to `workers/agent-control`. The model/reasoning/tool loop for the first slices belongs to the selected n8n Agent workflow.

When integrating or evolving a Runtime:

1. define the minimum ALOHA Runtime Contract required by the concrete use case;
2. keep provider/backend-specific protocol and session/event translation inside an explicit Runtime Adapter;
3. keep verified identity/authorization, Context Envelope, Capability exposure, confirmation policy and Conversation/Run product semantics in ALOHA Agent Control;
4. keep backend-native runtime mechanics in the Runtime Backend unless ALOHA intentionally promotes them into its stable contract;
5. add contract tests for the behavior ALOHA actually depends on.

OpenAI-compatible protocols may be used as a Runtime compatibility profile, but they are not automatically the ALOHA first-party interaction protocol.

## Lockfile policy

The initial remote scaffold was created without executing a package-manager install, so `package-lock.json` is not yet committed. Until it exists, CI uses `npm install` and does not enable npm dependency caching.

At the first local dependency install:

1. run `npm install` with the declared Node/npm baseline;
2. commit the generated `package-lock.json`;
3. change CI to `npm ci` and enable npm cache;
4. thereafter treat lockfile changes as part of dependency changes.

## Environment and secrets

- Never commit `.env`, `.dev.vars`, tokens or provider credentials.
- Add `.env.example` / `.dev.vars.example` only with synthetic placeholders when local setup needs one.
- Keep staging and production Worker bindings/resources separate.
- Browser code must never receive trusted service/application credentials.
- `VITE_GATEWAY_URL` may be browser-visible when a separately hosted Web variant needs it because it is only a Gateway route; it must never carry credentials or delegated authority.
- Runtime Backend credentials and endpoints must be injected as deployment configuration and must not leak into public examples or documentation.
- `N8N_AGENT_WEBHOOK_URL` is deployment-only runtime configuration even if the endpoint itself is not a credential.
- `N8N_AGENT_AUTH_TOKEN` is a secret and must use the deployment platform's secret mechanism.
- `CAPABILITY_GRANT_SIGNING_KEY` is a secret and must exist only at the trusted Agent Control boundary; never expose it to Gateway, browser code or n8n.
- Short-lived Capability Grants may be delivered to the selected Runtime only for the specific Run/capability they authorize and must never be committed or logged into public artifacts.

## Cloudflare production deployment

Production deployment is intentionally split from pull-request CI. `.github/workflows/ci.yml` validates pull requests and `main`; `.github/workflows/deploy.yml` runs only after code reaches `main` (or by explicit manual dispatch), repeats `npm run check`, builds the Web/PWA static assets, and deploys in dependency order:

1. Agent Control Worker;
2. Gateway Worker together with the built Web/PWA Static Assets（静态资源）.

The resulting MVP production topology is intentionally small:

```text
Browser / n8n capability call
  -> aloha-gateway Worker
       |- Web/PWA Static Assets
       |- /v1/* Gateway API
       `- AGENT_CONTROL Service Binding
            -> aloha-agent-control Worker (internal only)
                 |- n8n Agent Runtime
                 `- ALOHA Direct Capability execution
```

Cloudflare Pages is not part of this deployment. The Web/PWA and Gateway therefore share one origin, so production does not require a Pages project name or a browser-side Gateway origin variable.

### GitHub repository deployment secrets

For the current single-production-environment MVP, keep both Cloudflare deployment values under **Settings -> Secrets and variables -> Actions -> Repository secrets**:

- `CLOUDFLARE_API_TOKEN` — one dedicated, least-privilege Cloudflare API token for this repository. Do not use a Global API Key.
- `CLOUDFLARE_ACCOUNT_ID` — the target Cloudflare account ID. It is not itself an authentication credential, but storing it beside the deployment token keeps the initial setup simple and still prevents live infrastructure identifiers from being committed to the public repository.

This does **not** require two Cloudflare API tokens. A GitHub Environment would only change the GitHub-side scope/protection rules for the same stored token; it is optional and can be introduced later when staging/production separation or deployment approvals become useful.

Because the workflow has no `pull_request` deployment trigger, fork/PR code cannot invoke production deployment with repository deployment secrets.

With the current Worker-only topology, the deployment token does not need Cloudflare Pages permissions.

### Cloudflare runtime and capability secrets

Runtime endpoint/credentials and capability signing material belong to the Agent Control Worker, not GitHub source configuration. Configure them as Cloudflare Worker Secrets after the Worker exists:

- `N8N_AGENT_WEBHOOK_URL`
- `N8N_AGENT_AUTH_TOKEN`
- `CAPABILITY_GRANT_SIGNING_KEY`

The first infrastructure deployment intentionally does **not** declare these as Wrangler `secrets.required`. This avoids a bootstrap deadlock where a not-yet-created Worker cannot already contain the secrets required for its own first deployment. The application treats missing configuration explicitly:

- without `N8N_AGENT_WEBHOOK_URL`, Agent Control returns `runtime_backend_not_configured`;
- without `CAPABILITY_GRANT_SIGNING_KEY`, Agent Control exposes no runtime-callable Capabilities.

After Agent Control exists, add the required values through Cloudflare Worker Secrets. For M2, use a newly generated high-entropy value for `CAPABILITY_GRANT_SIGNING_KEY`; it is independent from `N8N_AGENT_AUTH_TOKEN` and must not be reused as the n8n Webhook credential.

Secret values are never placed in GitHub workflow YAML, Wrangler config, Actions logs or repository documentation.

Agent Control also sets `workers_dev: false` and `preview_urls: false`, so it has no direct public `workers.dev` or preview endpoint. Gateway reaches it through the `AGENT_CONTROL` Service Binding.

### Web/Gateway same-origin deployment

`workers/gateway/wrangler.jsonc` attaches `apps/web/dist` as Worker Static Assets and uses SPA fallback behavior. API and health paths are configured to run the Gateway Worker first; normal Web assets are served directly by Cloudflare's asset layer.

This keeps the logical architecture unchanged while reducing the physical MVP deployment to two Workers and one public entry point.

### Deployment safety rule

Production deployment follows this boundary:

`public source + public deployment definition + private deployment identity + private runtime/capability secrets`

Do not add `pull_request_target`, checkout untrusted pull-request code in a privileged deployment job, echo deployment secrets, or move n8n runtime/capability credentials into browser-visible build variables.

## Definition of done for scaffold-level changes

A scaffold or architecture change is complete only when the relevant `AGENTS.md`, `README.md`, `docs/architecture.md`, shared contracts, workspace scripts and CI validation remain consistent.
