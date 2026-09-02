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

The first runtime slice includes contract/adapter tests and Agent Control success/failure normalization tests. A real deployed n8n execution is still a separate integration verification step because live runtime configuration is intentionally outside the repository.

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
- Runtime Backend credentials and endpoints must be injected as deployment configuration and must not leak into public examples or documentation.
- `N8N_AGENT_WEBHOOK_URL` is deployment-only runtime configuration even if the endpoint itself is not a credential.
- `N8N_AGENT_AUTH_TOKEN` is a secret and must use the deployment platform's secret mechanism.

## Definition of done for scaffold-level changes

A scaffold or architecture change is complete only when the relevant `AGENTS.md`, `README.md`, `docs/architecture.md`, shared contracts, workspace scripts and CI validation remain consistent.
