# Development baseline

## Runtime/toolchain

- Node.js: 22.12+
- Package manager: npm 10
- Workspace layout: npm workspaces
- Web: Vue 3 + Vite + PWA plugin
- Gateway / Agent Control: Cloudflare Workers + Wrangler in the current scaffold
- Agent Runtime Backend: **not frozen** and not required to run on Cloudflare or use TypeScript

The current Gateway / Agent Control hosting choice is an implementation convenience for the scaffold, not an ALOHA platform constraint. Runtime Backends may be external services/products or custom runtimes on other infrastructure.

The toolchain is intentionally independent from LifeSpace's Node/pnpm choice. Shared protocols do not require a shared package manager or hosting platform.

## Install and run

```bash
npm install
npm run dev:web
npm run dev:gateway
npm run dev:agent-control
```

The current Agent Control worker is only a product-control scaffold. No Primary Runtime Backend is configured yet; interaction execution returns `runtime_backend_not_configured` until the first Runtime Adapter is selected and wired.

## Repository validation

```bash
npm run check
```

`check` currently performs:

1. TypeScript validation for all workspaces that expose `typecheck`;
2. Web production build;
3. Gateway Wrangler dry-run build;
4. Agent Control Wrangler dry-run build.

Automated behavioral tests should be introduced with the first real interaction/runtime/capability behavior rather than asserting placeholder execution.

## Runtime development rule

Do not add generic Agent-loop logic to `workers/agent-control` merely because a Runtime Backend has not yet been chosen.

When integrating a Runtime:

1. define the minimum ALOHA Runtime Contract required by the concrete use case;
2. keep provider/backend-specific protocol and session/event translation inside an explicit Runtime Adapter;
3. keep verified identity/authorization, Context Envelope, Capability exposure, confirmation policy and Conversation/Run product semantics in ALOHA Agent Control;
4. keep backend-native runtime mechanics in the Runtime Backend unless ALOHA intentionally promotes them into its stable contract;
5. add conformance/contract tests for the behavior ALOHA actually depends on.

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
- Add `.env.example` / `.dev.vars.example` only when a real variable is introduced, with names and safe placeholder values only.
- Keep staging and production Worker bindings/resources separate.
- Browser code must never receive trusted service/application credentials.
- Runtime Backend credentials and endpoints must be injected as deployment configuration and must not leak into public examples or documentation.

## Definition of done for scaffold-level changes

A scaffold or architecture change is complete only when the relevant `AGENTS.md`, `README.md`, `docs/architecture.md`, shared contracts, workspace scripts and CI validation remain consistent.
