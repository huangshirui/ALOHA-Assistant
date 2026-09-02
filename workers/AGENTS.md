# Workers Agent Instructions

`workers/` contains independently deployable ALOHA edge/control services. It does not imply that Agent Runtime Backends must be Cloudflare Workers.

## Rules

- Each Worker owns its entry point, deployment configuration, tests and runtime bindings.
- Keep Gateway（网关）and Agent Control（智能体控制层）responsibilities separate even when deployed on the same platform; communicate through an explicit interface rather than persistence coupling.
- Runtime Backend（运行时后端）integration is behind an explicit Runtime Adapter / authenticated interface and may target services outside Cloudflare.
- A Worker must not reach into another service's private persistence or copy another project's domain ownership.
- Keep environment-specific resource names and secrets outside source code; staging and production bindings must remain isolated.
- Service-to-service identity and delegated-user context must remain explicit across boundaries.
- Read the nearest nested `AGENTS.md` before changing a Worker.
