# ALOHA Assistant architecture baseline

This document is intentionally small. It records repository boundaries that should remain stable while the MVP evolves.

## Product boundary

ALOHA Assistant is a **personal Agent**. It is not the shared family Agent and is not the platform that owns all shared infrastructure.

HomeMew Agent is a separate Agent product. ALOHA Assistant may access HomeMew / LifeSpace capabilities only through the user's authorized intersection of Principal permissions and ALOHA Application scopes.

## Runtime path

```text
ALOHA PWA
   |
   v
Gateway (thin transport boundary)
   |
   v
ALOHA Agent Runtime
   |
   +--> direct capability / tool
   +--> n8n workflow capability
   +--> authorized LifeSpace / HomeMew capability
   +--> later: Relay / Poina / Facet / notification integrations
```

## Repository responsibilities

### `apps/web`

Owns the ALOHA user experience: interaction surface, input, presentation and local PWA concerns. It should not contain domain authorization logic or business data ownership.

### `workers/gateway`

Owns the stable external transport boundary. Keep it thin: request admission, authentication handoff, protocol normalization, streaming/session transport and routing. Do not put Agent reasoning or workflow orchestration here.

### `workers/agent`

Owns the ALOHA-specific Agent Runtime: context assembly, model/tool loop, capability selection and interaction-state coordination. n8n is called from here as a capability; n8n is not the runtime itself.

### `packages/contracts`

Shared TypeScript contracts for interaction transport and capability context. Contracts should evolve carefully because they connect independently deployable pieces.

### `packages/capabilities`

ALOHA-side capability registry/adapters. It may adapt LifeSpace, HomeMew, n8n and later shared services, but it must not absorb those systems' domain ownership.

## Outside this repository

- **LifeSpace** — Identity and Shared Reality.
- **HomeMew** — family application and family-domain capability provider; HomeMew Agent remains independent.
- **Relay** — Delegated Work.
- **Poina** — long-term memory infrastructure.
- **Facet** — generative human-Agent interaction runtime.
- **知了** — unified notification infrastructure.
- **n8n** — workflow/integration execution runtime.

## MVP implementation order

1. Keep the PWA shell fast and minimal.
2. Wire `web -> gateway -> agent` with streaming-friendly contracts.
3. Add one direct capability.
4. Add one n8n capability.
5. Add one authorized LifeSpace / HomeMew read-write scenario (recommended: query and create a family calendar event).
6. Only then expand voice, richer interaction surfaces, memory and delegation integrations.
