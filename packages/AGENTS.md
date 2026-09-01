# Packages Agent Instructions

`packages/` contains reusable ALOHA-internal contracts and adapters with concrete consumers.

## Rules

- Packages must not own deployment resources, runtime secrets or authoritative business data.
- `contracts` owns shared protocol/types across independently deployable ALOHA units; avoid parallel handwritten copies.
- `capabilities` adapts callable abilities into the ALOHA runtime but must not absorb LifeSpace, HomeMew, n8n, Relay, Poina or other systems' domain ownership.
- Do not create a new shared package merely to remove a small duplication; require a stable abstraction and a concrete near-term consumer.
- Keep contracts minimal and compatibility-conscious; provider-specific types should stay behind adapters where possible.
- Read the nearest nested `AGENTS.md` before changing a package.