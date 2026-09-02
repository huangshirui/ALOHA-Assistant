# Documentation Agent Instructions

`docs/` records stable ALOHA product/runtime-boundary decisions. Documentation is normative only where the root `AGENTS.md` identifies it as a source of truth.

## Rules

- Keep current architecture separate from future possibilities. `architecture.md` describes the current target boundary for implementation, not every long-term idea.
- Distinguish planned behavior from implemented/verified behavior explicitly.
- Record durable decisions, invariants and boundaries; do not turn architecture docs into transient task logs.
- Keep ALOHA-specific product assumptions here, not in LifeSpace or another shared platform's rules.
- Use terminology consistently: Principal（权限主体）, Actor（执行者）, Application Context（应用上下文）, Gateway（网关）, Agent Control（智能体控制层）, Runtime Contract（运行时契约）, Runtime Backend（运行时后端）, Capability（能力）, Context Envelope（上下文信封）, Shared Reality（共享现实）.
- Do not use `ALOHA Agent Runtime` to mean the ALOHA product/control layer. A generic/external execution engine is a Runtime Backend; ALOHA-owned Run semantics belong to Agent Control.
- When a service/runtime boundary changes, update `architecture.md` in the same change.
- When external interaction, context, authorization or runtime-contract semantics change, update the owning contract/tests as well as documentation.
- Historical `aloha-assistant-pwa` design may be cited as context, but must not be presented as the current implementation baseline.
