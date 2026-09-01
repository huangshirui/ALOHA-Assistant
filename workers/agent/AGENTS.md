# ALOHA Agent Runtime Instructions

`workers/agent` is the ALOHA-specific Agent Runtime（智能体运行时）.

## Rules

- Own context assembly, model/tool loop, capability selection, confirmation policy and interaction-state coordination.
- Keep model/provider SDK choices replaceable and behind narrow adapters where practical.
- n8n is a callable Workflow / Integration Capability（工作流 / 集成能力）; do not make n8n the Runtime or source of ALOHA identity.
- Preserve Principal（权限主体）, Actor（执行者）and Application Context（应用上下文）through capability calls.
- Never expand authority inside the Runtime. Capability execution must use verified delegated/application context from trusted boundaries.
- High-impact mutations must expose confirmation/approval state rather than silently executing because the model requested them.
- Do not persist durable Shared Reality, long-term memory or delegated-work infrastructure locally when those responsibilities belong to LifeSpace, Poina or Relay.
- Keep capability/provider failures explicit and machine-readable enough for the Gateway/client to present safely.