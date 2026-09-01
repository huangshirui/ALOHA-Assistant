# Workers Agent Instructions

`workers/` contains independently deployable ALOHA runtime services.

## Rules

- Each Worker owns its runtime entry point, deployment configuration, tests and runtime bindings.
- Keep Gateway（网关）and Agent Runtime（智能体运行时）responsibilities separate; they may communicate through an explicit Service Binding / authenticated interface, not persistence coupling.
- A Worker must not reach into another service's private persistence or copy another project's domain ownership.
- Keep environment-specific resource names and secrets outside source code; staging and production bindings must remain isolated.
- Service-to-service identity and delegated-user context must remain explicit across boundaries.
- Read the nearest nested `AGENTS.md` before changing a Worker.