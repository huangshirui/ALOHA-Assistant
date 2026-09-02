# ALOHA Assistant

ALOHA Assistant is a personal AI assistant and the primary personal interaction surface in the Verinasci project family.

This repository contains the product-facing PWA, the thin gateway, the ALOHA Agent Runtime, and ALOHA-specific capability adapters/contracts. Shared infrastructure such as LifeSpace, Relay, Poina, Facet, and HomeMew remains outside this repository.

## Open-source repository

ALOHA Assistant is developed as an open-source project. Source code in this repository is licensed under **GNU Affero General Public License v3.0 or later (`AGPL-3.0-or-later`)**; see `LICENSE`.

The public repository contains portable source code, contracts and documentation. It must **not** contain the user's private data, real conversation/memory content, secrets, credentials, production/staging datasets, or non-public live infrastructure identifiers/topology. Examples and fixtures must be synthetic, and deployment secrets/live private configuration must stay outside source control.

Contributors and coding agents must read `AGENTS.md` before making changes. Security-sensitive reports should follow `SECURITY.md` and should never paste secrets or private data into a public issue.

## Read before changing the repository

Start with `AGENTS.md`, then read the nearest nested `AGENTS.md` for the area being changed.

Current sources of truth:

- `README.md` — product boundary and MVP target
- `docs/architecture.md` — current runtime/repository architecture
- `docs/pwa-interaction.md` — current PWA interaction/product baseline
- `docs/composer-state-machine.md` — Composer states, guards, invariants and implementation/test baseline
- `docs/conversation-run-lifecycle.md` — Conversation / Run lifecycle, New Context, background Run management, History and Draft lifecycle
- `docs/development.md` — toolchain, validation and lockfile baseline
- `packages/contracts` — shared ALOHA interaction/capability protocol types

## MVP

The first milestone proves the complete path:

`PWA -> Gateway -> ALOHA Agent Runtime -> Capability -> real execution`

The MVP should include:

- text-first conversation with room for voice/image/file input;
- a thin and stable gateway;
- an independent ALOHA Agent Runtime (n8n is a callable workflow capability, not the runtime itself);
- at least one direct tool capability;
- at least one n8n workflow capability;
- at least one authorized LifeSpace / HomeMew read-write scenario;
- clear authorization boundaries between the personal ALOHA Assistant and the separate HomeMew Agent.

## Repository layout

```text
apps/
  web/                  # Vue 3 + Vite PWA
workers/
  gateway/              # thin Cloudflare Worker gateway
  agent/                # ALOHA Agent Runtime
packages/
  contracts/            # transport / interaction / capability contracts
  capabilities/         # ALOHA capability registry and adapters
docs/
  architecture.md              # current repository boundaries and data flow
  pwa-interaction.md           # PWA interaction/product baseline
  composer-state-machine.md    # Composer implementation/test specification
  conversation-run-lifecycle.md # Conversation / Run lifecycle and background execution management
  development.md               # local toolchain and validation baseline
```

## Getting started

```bash
npm install
npm run dev:web
```

Run Workers separately when needed:

```bash
npm run dev:gateway
npm run dev:agent
```

Validate the complete repository scaffold with:

```bash
npm run check
```

## Principles

1. ALOHA Assistant is a personal Agent product, not a multi-assistant platform.
2. HomeMew Agent is a separate Agent; the two may reuse capabilities and protocols.
3. n8n is an execution/integration capability, not ALOHA Core.
4. LifeSpace owns identity/shared reality; ALOHA consumes it through explicit authorization.
5. Relay, Poina, Facet and notification infrastructure stay independent and are integrated through contracts.
6. Keep the MVP small, but keep boundaries compatible with later expansion.
7. Keep private user context and live private infrastructure outside this public repository.

## Status

Repository skeleton initialized. Product and architecture baselines are still evolving with the MVP.
