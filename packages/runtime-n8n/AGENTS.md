# n8n Runtime Adapter Agent Instructions

`packages/runtime-n8n` owns the concrete adapter between ALOHA's Runtime Contract（运行时契约） and the selected MVP n8n Agent workflow.

## Rules

- Keep n8n webhook, execution and response shapes inside this package; they must not become the first-party ALOHA Interaction Protocol.
- Implement only the mapping required by concrete MVP slices. Do not grow a generic multi-runtime framework here.
- Accept ALOHA Run / input / Capability semantics from Agent Control and normalize n8n results/errors back to the shared Runtime Contract.
- Never derive Principal（权限主体） authority, grants, scopes or confirmation policy here. Those are Agent Control responsibilities.
- Never log or expose runtime credentials, live webhook URLs, private workflow payloads or backend response bodies that may contain user data.
- Tests and examples must use synthetic endpoints, tokens and content only.
