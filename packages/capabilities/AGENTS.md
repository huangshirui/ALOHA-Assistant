# Capabilities Agent Instructions

`packages/capabilities` contains the ALOHA-side Capability（能力）registry and adapters.

## Rules

- A Capability is a callable boundary, not a place to copy another system's domain implementation.
- Keep discovery metadata, input/output contract, authority requirements and execution adapter explicit.
- LifeSpace/HomeMew/n8n/Relay/Poina integrations should remain identifiable adapters so they can evolve independently.
- Capability execution must receive trusted Principal / Actor / Application / authorization context from ALOHA Agent Control or another trusted boundary; never manufacture broader scopes or user authority locally.
- Expose only the Capability set allowed for the current Run; a Runtime Backend does not gain broad authority merely because it executes ALOHA.
- Keep Runtime-specific Tool/MCP schema translation outside canonical Capability ownership when possible; provider/runtime SDK types must not become the authority model.
- n8n may appear either as a Workflow Capability or as a separate Runtime Backend; keep those roles explicit.
- Separate read-only, mutating, high-impact and long-running capabilities when confirmation/delegation semantics differ.
- Do not add a generic framework abstraction until at least two concrete capabilities prove the common shape.
- Tests should cover registration/discovery plus success, provider failure and permission/confirmation paths as those features are introduced.
