# ALOHA Web Agent Instructions

`apps/web` is the primary PWA interaction experience.

## Rules

- Optimize first for very fast startup and high-frequency Mobile/Desktop use.
- Preserve the three-area interaction shell: header, interaction stage and input/composer; exact visual design may evolve.
- Keep input/output interaction state separate from Agent reasoning state. The PWA renders and sends intent; it does not implement the Agent loop.
- Communicate through the Gateway（网关）contract only. Do not call Agent Runtime internals or external domain services directly from browser code unless the architecture is deliberately changed.
- Never place trusted application/service credentials in browser-delivered code.
- Permission-based hiding is UX only; server-side authorization remains authoritative.
- Keep the initial dependency surface small. Do not introduce a Design System or generative UI framework before there is a concrete MVP need; Facet（生成式人机交互）remains the future shared integration boundary.
- `DESIGN.md` is the source of truth for the current ALOHA Web visual language. Reuse or extend its semantic CSS Design Tokens（设计令牌）instead of hard-coding reusable visual values independently in pages/components.
- Maintain accessible controls, safe-area handling and responsive behavior across Mobile, Tablet and Desktop.
