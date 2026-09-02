# Contracts Agent Instructions

`packages/contracts` defines shared ALOHA protocol/types across independently deployable components.

## Rules

- Keep contracts transport/provider/runtime neutral unless a dependency is deliberately part of the public boundary.
- Separate **first-party ALOHA Interaction Protocol** semantics from **southbound Runtime Contract** semantics; a provider-compatible API must not silently become the client product protocol.
- Avoid UI-only presentation fields in core Run semantics and avoid model/runtime-provider SDK types in canonical shared types.
- Changes must consider compatibility across Web, Gateway, Agent Control, Runtime Adapters and Capability adapters.
- Model Context Envelope fields explicitly enough to preserve trusted server context versus client-provided contextual claims, including source/freshness/consent semantics where relevant.
- Distinguish identity/authority context from user-provided payload fields; IDs in request bodies are not authorization proof.
- Prefer additive evolution during MVP unless a deliberate coordinated breaking change is simpler and all consumers change together.
- Do not encode LifeSpace/HomeMew domain schemas here when those systems own the canonical contract.
- Do not over-generalize for hypothetical Runtime Backends. Establish the smallest contract required by concrete integrations and add conformance tests when a second backend proves replacement needs.
