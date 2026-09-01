# Development baseline

## Runtime/toolchain

- Node.js: 22.12+
- Package manager: npm 10
- Workspace layout: npm workspaces
- Web: Vue 3 + Vite + PWA plugin
- Gateway / Agent Runtime: Cloudflare Workers + Wrangler

The toolchain is intentionally independent from LifeSpace's Node/pnpm choice. Align versions only when there is a concrete shared-build reason; shared protocols do not require a shared package manager.

## Install and run

```bash
npm install
npm run dev:web
npm run dev:gateway
npm run dev:agent
```

Workers run independently. The Gateway's `AGENT` Service Binding is intentionally not configured in the initial scaffold; wire it when implementing the first `web -> gateway -> agent` vertical slice.

## Repository validation

```bash
npm run check
```

`check` currently performs:

1. TypeScript validation for all workspaces that expose `typecheck`;
2. Web production build;
3. Gateway Wrangler dry-run build;
4. Agent Runtime Wrangler dry-run build.

Automated behavioral tests should be introduced with the first real interaction/capability behavior rather than asserting placeholder responses.

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

## Definition of done for scaffold-level changes

A scaffold or architecture change is complete only when the relevant `AGENTS.md`, `docs/architecture.md`, shared contracts, workspace scripts and CI validation remain consistent.