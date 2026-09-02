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

The Web app calls the Gateway only. During local Vite development, `/v1` is proxied to `http://127.0.0.1:8787`. A separately deployed Web app may set `VITE_GATEWAY_URL` to the public Gateway origin; this browser-visible value is routing configuration, not a trusted credential.

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
- `VITE_GATEWAY_URL` may be browser-visible because it is only the Gateway route; it must never carry credentials or delegated authority.
- Runtime Backend credentials and endpoints must be injected as deployment configuration and must not leak into public examples or documentation.
- `N8N_AGENT_WEBHOOK_URL` is deployment-only runtime configuration even if the endpoint itself is not a credential.
- `N8N_AGENT_AUTH_TOKEN` is a secret and must use the deployment platform's secret mechanism.

## Cloudflare production deployment

Production deployment is intentionally split from pull-request CI. `.github/workflows/ci.yml` validates pull requests and `main`; `.github/workflows/deploy.yml` runs only after code reaches `main` (or by explicit manual dispatch), repeats `npm run check`, and then deploys in dependency order:

1. Agent Control Worker;
2. Gateway Worker;
3. Web/PWA to Cloudflare Pages.

The public workflow contains only portable deployment logic. Live deployment identity, account/resource identifiers and runtime configuration remain outside source control.

### GitHub production environment

Create a GitHub Actions Environment（环境） named `production`. Configure these deployment-only values there or at repository Actions scope without committing their values:

- Secret `CLOUDFLARE_API_TOKEN` — a dedicated, least-privilege Cloudflare API token scoped to the account and only the Worker/Pages permissions required for this repository. Do not use a Global API Key.
- Secret `CLOUDFLARE_ACCOUNT_ID` — kept outside the public repository even though it is not itself an authentication secret.
- Secret `CLOUDFLARE_PAGES_PROJECT_NAME` — the existing Cloudflare Pages project used by the ALOHA Web deployment.
- Variable `ALOHA_GATEWAY_URL` — the browser-visible production Gateway origin used to compile `VITE_GATEWAY_URL`. It contains no credential or delegated authority.

The deployment workflow deliberately has no `pull_request` trigger, so fork/PR code cannot invoke production deployment with deployment credentials.

### Cloudflare runtime secrets

The n8n endpoint and bearer token belong to the Agent Control Worker, not GitHub source configuration. Configure them as Cloudflare Worker Secrets:

- `N8N_AGENT_WEBHOOK_URL`
- `N8N_AGENT_AUTH_TOKEN`

`workers/agent-control/wrangler.jsonc` declares both names as required for the current M1 Header-Auth runtime bootstrap. Wrangler validates that the secrets already exist on the deployed Worker before a production deploy succeeds. Values are never placed in GitHub workflow YAML, Wrangler config, Actions logs or repository documentation.

### Web deployment mode

The Actions-managed Web deployment uses Cloudflare Pages **Direct Upload** through Wrangler. The Pages project must therefore be compatible with Direct Upload. Do not accidentally create a Git-integrated Pages project and then expect it to behave as a Direct Upload project; Cloudflare treats these as distinct project modes.

The workflow builds the Web app with `VITE_GATEWAY_URL` derived from the external `ALOHA_GATEWAY_URL` GitHub variable, then uploads `apps/web/dist` to the configured Pages project. No trusted credential is embedded in browser code.

### Deployment safety rule

Production deployment follows this boundary:

`public source + public deployment definition + private deployment identity + private runtime secrets`

Do not add `pull_request_target`, checkout untrusted pull-request code in a privileged deployment job, echo deployment secrets, or move n8n runtime credentials into browser-visible build variables.

## Definition of done for scaffold-level changes

A scaffold or architecture change is complete only when the relevant `AGENTS.md`, `README.md`, `docs/architecture.md`, shared contracts, workspace scripts and CI validation remain consistent.
