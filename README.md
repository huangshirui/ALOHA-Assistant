# ALOHA Assistant

ALOHA Assistant is a personal AI assistant and the primary personal interaction surface in the Verinasci project family.

This repository contains the product-facing PWA, the thin gateway, the ALOHA Agent Runtime, and ALOHA-specific capability adapters/contracts. Shared infrastructure such as LifeSpace, Relay, Poina, Facet, and HomeMew remains outside this repository.

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
  architecture.md       # current repository boundaries and data flow
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

## Principles

1. ALOHA Assistant is a personal Agent product, not a multi-assistant platform.
2. HomeMew Agent is a separate Agent; the two may reuse capabilities and protocols.
3. n8n is an execution/integration capability, not ALOHA Core.
4. LifeSpace owns identity/shared reality; ALOHA consumes it through explicit authorization.
5. Relay, Poina, Facet and notification infrastructure stay independent and are integrated through contracts.
6. Keep the MVP small, but keep boundaries compatible with later expansion.

## Status

Repository skeleton initialized. Product and architecture baselines are still evolving with the MVP.
