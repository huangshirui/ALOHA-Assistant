# Capabilities Agent Instructions

`packages/capabilities` contains the ALOHA-side Capability（能力）registry and adapters.

## Rules

- A Capability is a callable boundary, not a place to copy another system's domain implementation.
- Keep discovery metadata, input/output contract, authority requirements and execution adapter explicit.
- LifeSpace/HomeMew/n8n/Relay/Poina integrations should remain identifiable adapters so they can evolve independently.
- Capability execution must receive trusted context from Agent Runtime; never manufacture broader scopes or user authority locally.
- Separate read-only, mutating, high-impact and long-running capabilities when confirmation/delegation semantics differ.
- Do not add a generic framework abstraction until at least two concrete capabilities prove the common shape.
- Tests should cover registration/discovery plus success, provider failure and permission/confirmation paths as those features are introduced.