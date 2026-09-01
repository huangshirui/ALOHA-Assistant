# Documentation Agent Instructions

`docs/` records stable ALOHA product/runtime decisions. Documentation is normative only where the root `AGENTS.md` identifies it as a source of truth.

## Rules

- Keep current architecture separate from future possibilities. `architecture.md` describes the current target boundary for implementation, not every long-term idea.
- Distinguish planned behavior from implemented/verified behavior explicitly.
- Record durable decisions, invariants and boundaries; do not turn architecture docs into transient task logs.
- Keep ALOHA-specific product assumptions here, not in LifeSpace or another shared platform's rules.
- Use terminology consistently: Principal（权限主体）, Actor（执行者）, Application Context（应用上下文）, Gateway（网关）, Agent Runtime（智能体运行时）, Capability（能力）, Shared Reality（共享现实）.
- When a runtime/service boundary changes, update `architecture.md` in the same change.
- When external protocol or authorization semantics change, update the owning contract/tests as well as the documentation.
- Historical `aloha-assistant-pwa` design may be cited as context, but must not be presented as the current implementation baseline.