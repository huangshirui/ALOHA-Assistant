# Contracts Agent Instructions

`packages/contracts` defines shared ALOHA protocol/types across independently deployable components.

## Rules

- Keep contracts transport/provider neutral unless a dependency is deliberately part of the public boundary.
- Avoid UI-only fields in core runtime semantics and avoid model-provider SDK types in shared protocol types.
- Changes must consider compatibility across Web, Gateway, Agent Runtime and Capability adapters.
- Distinguish identity/authority context from user-provided payload fields; IDs in request bodies are not authorization proof.
- Prefer additive evolution during MVP unless a deliberate coordinated breaking change is simpler and all consumers change together.
- Do not encode LifeSpace/HomeMew domain schemas here when those systems own the canonical contract.