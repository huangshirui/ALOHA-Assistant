# Apps Agent Instructions

`apps/` contains user-facing ALOHA application experiences.

## Rules

- Apps own presentation, interaction ergonomics, local client state and client-side platform concerns.
- Do not move Agent reasoning, authorization authority or external-domain business ownership into an app.
- Treat the Gateway contract as the application boundary; do not couple the PWA directly to Agent Runtime internals.
- Client-visible permission checks are usability only, never the security boundary.
- Keep startup fast and the dependency surface small; ALOHA is a high-frequency personal tool.
- Read the nearest nested `AGENTS.md` before changing an app.