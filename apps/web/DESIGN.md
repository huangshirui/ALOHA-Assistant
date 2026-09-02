# ALOHA Web Design

This document is the source of truth for the current ALOHA Web visual language. It is intentionally small: the MVP needs a coherent token layer, not a component framework.

## Principles

- Keep the interface quiet, lightweight and fast for high-frequency Mobile/Desktop use.
- Prefer semantic design tokens over page/component-local literals.
- Components consume semantic tokens; raw color, spacing, radius, typography and size values belong in the token layer unless a value is truly one-off and documented.
- Preserve accessibility, safe-area handling and responsive behavior.
- Do not introduce a third-party design-system dependency merely to centralize tokens.

## Token model

Tokens are CSS custom properties defined in `src/style.css` under `:root`.

### Color

- `--color-bg-canvas`: main application background.
- `--color-text-primary`: primary foreground text.
- `--color-text-muted`: secondary/supporting text.
- `--color-border-subtle`: quiet control/divider border.
- `--color-surface-transparent`: transparent control surface.

### Typography

- `--font-family-sans`: application sans-serif stack.

### Spacing

Use the shared scale rather than introducing arbitrary values:

- `--space-2`: 0.5rem
- `--space-3`: 0.75rem
- `--space-4`: 1rem
- `--space-6`: 1.5rem

### Size and radius

- `--size-control-sm`: 2.5rem
- `--size-control-md`: 3rem
- `--radius-pill`: 999px
- `--layout-content-max`: 56rem

## Implementation rule

When a new page or component needs a visual value:

1. reuse an existing semantic token when the meaning matches;
2. add a new token here and in `:root` if the value is reusable or represents a stable visual role;
3. use a local literal only for genuinely local geometry that should not become part of the visual language.

A token name describes purpose, not a specific component. Avoid names such as `--chat-input-gray` or `--settings-card-padding` when the same concept can be expressed semantically.

## Current scope

The current token layer covers the MVP shell and composer. It is expected to grow gradually as real screens are implemented. Facet remains the future shared Generative UI boundary; this file does not create a parallel component framework.
