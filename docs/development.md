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

The public repository intentionally contains no real n8n endpoint, token or workflow execution data. Without `N8N_AGENT_WEBHOOK_URL`, interaction admission returns `runtime_backend_not_configured`.

The slice-1 n8n Agent workflow contract expects a JSON response shaped as:

```json
{
  "outputText": "Synthetic example response",
  "backendRunId": "optional-synthetic-correlation"
}
```

`backendRunId` is optional and remains backend correlation only; it is not the ALOHA Run identity.

## Repository validation

```bash
npm run check
```

`check` performs:

1. TypeScript validation for all workspaces that expose `typecheck`;
2. behavioral tests for workspaces that expose `test`;
3. Web production build;
4. Gateway Wrangler dry-run build;
5. Agent Control Wrangler dry-run build.

The first runtime slice includes adapter tests and Agent Control success/failure normalization tests. A real deployed n8n execution is still a separate integration verification step because live runtime configuration is intentionally outside the repository.

## Runtime development rule

Do not add generic Agent-loop logic to `workers/agent-control`. The model/reasoning/tool loop for the first slice belongs to the selected n8n Agent workflow.

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

## Cloudflare production deployment

Production deployment is intentionally split from pull-request CI. `.github/workflows/ci.yml` validates pull requests and `main`; `.github/workflows/deploy.yml` runs only after code reaches `main` (or by explicit manual dispatch), repeats `npm run check`, builds the Web/PWA static assets, and deploys in dependency order:

1. Agent Control Worker;
2. Gateway Worker together with the built Web/PWA Static Assets（静态资源）.

The resulting MVP production topology is intentionally small:

```text
Browser
  -> aloha-gateway Worker
       |- Web/PWA Static Assets
       |- /v1/* Gateway API
       `- AGENT_CONTROL Service Binding
            -> aloha-agent-control Worker (internal only)
                 -> n8n Agent Runtime
```

Cloudflare Pages is not part of this deployment. The Web/PWA and Gateway therefore share one origin, so production does not require a Pages project name or a browser-side Gateway origin variable.

### GitHub repository deployment secrets

For the current single-production-environment MVP, keep both Cloudflare deployment values under **Settings -> Secrets and variables -> Actions -> Repository secrets**:

- `CLOUDFLARE_API_TOKEN` — one dedicated, least-privilege Cloudflare API token for this repository. Do not use a Global API Key.
- `CLOUDFLARE_ACCOUNT_ID` — the target Cloudflare account ID. It is not itself an authentication credential, but storing it beside the deployment token keeps the initial setup simple and still prevents live infrastructure identifiers from being committed to the public repository.

This does **not** require two Cloudflare API tokens. A GitHub Environment would only change the GitHub-side scope/protection rules for the same stored token; it is optional and can be introduced later when staging/production separation or deployment approvals become useful.

Because the workflow has no `pull_request` deployment trigger, fork/PR code cannot invoke production deployment with repository deployment secrets.

With the current Worker-only topology, the deployment token does not need Cloudflare Pages permissions.

### Cloudflare runtime secrets

The n8n endpoint and bearer token belong to the Agent Control Worker, not GitHub source configuration. Configure them as Cloudflare Worker Secrets:

- `N8N_AGENT_WEBHOOK_URL`
- `N8N_AGENT_AUTH_TOKEN`

`workers/agent-control/wrangler.jsonc` declares both names as required for the current M1 Header-Auth runtime bootstrap. Wrangler validates that the secrets already exist on the deployed Worker before a production deploy succeeds. Values are never placed in GitHub workflow YAML, Wrangler config, Actions logs or repository documentation.

Agent Control also sets `workers_dev: false` and `preview_urls: false`, so it has no direct public `workers.dev` or preview endpoint. Gateway reaches it through the `AGENT_CONTROL` Service Binding.

### Web/Gateway same-origin deployment

`workers/gateway/wrangler.jsonc` attaches `apps/web/dist` as Worker Static Assets and uses SPA fallback behavior. API and health paths are configured to run the Gateway Worker first; normal Web assets are served directly by Cloudflare's asset layer.

This keeps the logical architecture unchanged while reducing the physical MVP deployment to two Workers and one public entry point.

### Deployment safety rule

Production deployment follows this boundary:

`public source + public deployment definition + private deployment identity + private runtime secrets`

Do not add `pull_request_target`, checkout untrusted pull-request code in a privileged deployment job, echo deployment secrets, or move n8n runtime credentials into browser-visible build variables.

## Definition of done for scaffold-level changes

A scaffold or architecture change is complete only when the relevant `AGENTS.md`, `README.md`, `docs/architecture.md`, shared contracts, workspace scripts and CI validation remain consistent.
