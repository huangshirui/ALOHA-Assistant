# Runtime Trust, Authority and Confirmation Boundary

Status: **architecture baseline**. This document refines the Runtime / Capability boundary in `docs/architecture.md` and records the security invariants that must hold when ALOHA uses n8n, Hermes Agent or another Runtime Backend（运行时后端）.

## Why this boundary exists

ALOHA Agent Control（智能体控制层）can decide which **ALOHA-managed Capabilities（ALOHA 管理能力）** it exposes for a Conversation（会话）or Run（执行）. It cannot magically remove tools, credentials or network authority that a Runtime Backend already owns independently.

Therefore these are separate concerns:

1. **Domain authority（领域权限）** — for LifeSpace-owned data/actions, LifeSpace is the authority for Identity（身份）, Principal（权限主体）, Actor（执行者）, Application Context（应用上下文）, Space / Grant / Delegation and effective model/action access.
2. **ALOHA Run policy（ALOHA 本次执行策略）** — ALOHA may further narrow what the current Run should be allowed to attempt and whether an exact action requires user confirmation.
3. **Runtime-native authority（运行时原生权限）** — tools, credentials, MCP servers, shell/network access or connectors independently configured in the Runtime remain that Runtime's own authority unless the Runtime provides an enforceable mechanism that ALOHA actually controls.

ALOHA must never describe item 3 as controlled merely because item 2 exists.

## Core authority rule

For an ALOHA-mediated LifeSpace operation, ALOHA can only narrow LifeSpace authority, never expand it:

```text
LifeSpace effective authority
∩ ALOHA Application context
∩ current ALOHA Run policy
∩ required ALOHA confirmation state
= operation that ALOHA may attempt
```

LifeSpace still performs the final current-state authorization check when the operation reaches LifeSpace. ALOHA does not duplicate LifeSpace Membership / Data Grant / Agent Delegation / Model Capability authorization logic.

In plain language:

- **LifeSpace decides: Can this Principal / Actor / Application legally do this?**
- **ALOHA decides: Should this Run be allowed to attempt it now?**
- **Confirmation decides: Has the user approved this exact action when approval is required?**
- **The Runtime decides: How does the reasoning/tool loop execute within the authority it actually possesses?**

## Prompt is not a security boundary

System prompts, tool descriptions and model instructions are useful behavior guidance, but they are **not authorization enforcement**.

A model can misunderstand, be jailbroken, behave unexpectedly or simply choose a different available tool. Therefore ALOHA must not rely on instructions such as "do not call this tool" or "ask before writing" as the only protection for privileged operations.

A hard ALOHA control requires enforcement outside the model, for example:

- the Runtime never receives the privileged credential;
- a privileged tool call must pass through an ALOHA-controlled endpoint;
- the endpoint validates the current Run / capability / confirmation evidence before executing;
- the downstream authority such as LifeSpace re-checks its own current authorization;
- or the Runtime itself provides an enforceable tool/credential allowlist or sandbox that the ALOHA Runtime Adapter can configure and verify.

## What Agent Control can actually control

### ALOHA-mediated capability

This is the preferred security boundary for ALOHA-owned or ALOHA-mediated privileged capabilities.

```text
Runtime Backend
   |
   | short-lived narrow invocation authority
   v
ALOHA Gateway / Agent Control
   |
   | enforce Run policy + confirmation
   v
Capability adapter / owning service
   |
   v
LifeSpace / HomeMew / other system
```

The Runtime receives a callable descriptor and, where needed, short-lived narrow authority. It does not receive the signing key or a permanent broad credential.

The current M2 `math.calculate` Capability Grant（能力授权令牌）proves this pattern only for an ALOHA-owned, low-risk capability. It must not be interpreted as a replacement for LifeSpace authorization.

### Runtime-native tool with enforceable restrictions

Some external Runtime Backends provide real configuration controls such as a tool allowlist, dedicated workflow topology, MCP tool filtering, isolated profile, sandbox or credential boundary.

ALOHA may use those mechanisms through a Runtime Adapter when they are actually enforceable. They are then part of the Runtime integration's trust contract, not part of the prompt.

The integration must still distinguish:

- a tool being hidden from the model;
- a tool being impossible to invoke;
- a credential being unavailable to the Runtime;
- network/filesystem/shell escape paths that could bypass the intended tool list.

Only the latter enforceable properties are security boundaries.

### Runtime-native tool without enforceable restrictions

If a Runtime already has a broad LifeSpace credential, arbitrary authenticated HTTP access, a powerful shell with accessible secrets, or another path that bypasses ALOHA mediation, Agent Control cannot reliably shrink that authority.

In that situation ALOHA must **not claim hard per-Run confinement**.

The choices are to:

- remove the broad credential/path from the Runtime used by ALOHA;
- use a dedicated Runtime profile/workflow/instance with least-privilege tools;
- replace the broad credential with an ALOHA-mediated or narrowly scoped credential;
- treat the Runtime's independent access as a separate Principal / Service authority with its own explicit policy;
- or avoid that Runtime for operations that require strict ALOHA confirmation or capability confinement.

## Current n8n MVP interpretation

The current n8n Agent workflow is externally hosted Runtime infrastructure, but its workflow topology is configured by this project/operator.

For the ALOHA workflow, only Tool nodes actually connected/configured for that Agent should be considered part of its intended tool surface. The fact that the wider n8n instance stores other credentials or contains other workflows does not by itself make those tools callable by this Agent; conversely, attaching a generic powerful HTTP/shell/tool node or a broad credential would create a bypass that Agent Control cannot undo with a prompt.

MVP invariant:

> The ALOHA n8n Agent workflow must not be given an independent broad LifeSpace/HomeMew credential that can bypass the ALOHA/LifeSpace authority path.

The current `math.calculate` HTTP Tool is intentionally narrow: ALOHA supplies the invocation descriptor and short-lived grant, while n8n does not hold the capability signing key.

n8n may also provide its own human-review/tool-approval features. Those may be used by an adapter when useful, but ALOHA Confirmation（确认）remains an ALOHA product semantic and must not become dependent on one Runtime's native approval model.

## Hermes Agent and other external Runtime Backends

A non-self-built Runtime can still be suitable if it exposes enforceable controls that fit the ALOHA trust boundary.

For example, a Runtime may support:

- explicit MCP server/tool allowlists;
- a dedicated ALOHA profile/configuration;
- isolated environment variables/credentials;
- container/sandbox/network restrictions;
- per-session or per-run tool configuration.

ALOHA should use the smallest real controls the Runtime provides. It should not invent a generic abstraction before a second Runtime is actually integrated.

If a general-purpose Hermes/other Agent profile already has shell, filesystem, browser or MCP credentials broader than ALOHA intends, that profile must be treated as independently privileged. ALOHA cannot turn it into a least-privilege Runtime merely by changing the prompt.

## Confirmation（确认）is action-specific

LifeSpace authorization answers whether an action is permitted by the domain. ALOHA Confirmation answers whether this specific action may proceed now.

For a capability marked as requiring confirmation, confirmation should bind to a concrete Proposed Action（拟执行动作） and its Critical Parameters（关键参数）, for example:

```text
Create Event
- title: Meet Alex
- startsAt: 2026-09-05T15:00
- endsAt:   2026-09-05T16:00
- calendar/space: <selected target>
```

Stable rules:

1. Confirmation is **not** a new domain permission and cannot expand LifeSpace authority.
2. Confirmation is bound to the proposed action and security-relevant/meaningful parameters, not merely to a capability name such as `Event.create`.
3. If a bound critical parameter changes after confirmation, the prior confirmation is invalid for the changed action.
4. A confirmation is not implicitly reusable across Runs or Conversations. Broader automation/no-confirm policies must be explicit, deliberately scoped product settings and remain bounded by downstream authority.
5. The enforcement point must be trusted code outside the model. A prompt instruction to ask the user first is not sufficient.

The exact transport/state-machine design is deliberately deferred until the first real mutating capability. A likely implementation is a two-phase flow:

```text
Runtime proposes capability call + concrete input
  -> Agent Control blocks execution
  -> ALOHA emits confirmation.required with bound action data
  -> user confirms / denies
  -> Agent Control executes or resumes only the confirmed action
```

A Runtime that cannot suspend/resume need not force ALOHA to weaken the rule; ALOHA may complete the confirmed action outside that Runtime call and then continue via a new/resumed Run contract as appropriate.

## Runtime integration acceptance questions

Before a Runtime Backend is trusted for a privileged ALOHA scenario, answer these questions explicitly:

1. Which tools can the model actually invoke?
2. Which credentials can the Runtime actually access?
3. Can ALOHA enforce a per-Run subset, or only suggest one?
4. Can the Runtime bypass the declared tool surface through HTTP, shell, filesystem, browser, MCP or another general-purpose tool?
5. Where is user confirmation enforced?
6. Does the downstream system re-check current domain authorization?
7. If the Runtime is compromised or the model ignores instructions, what is the maximum authority it can exercise?

The answer to question 7 defines the real security boundary.

## MVP scope

This document does **not** add a new MVP framework or require dynamic sandboxing/tool filtering to be implemented now.

For the current M2 slice:

- `math.calculate` remains low-risk and `confirmation: never`;
- the n8n workflow remains the single selected Runtime Backend;
- ALOHA controls only the ALOHA-managed capability path it actually mediates;
- LifeSpace trusted Identity / Agent Ready integration and the first real mutating capability remain later slices;
- confirmation enforcement is implemented when the first capability that actually requires it is introduced.

The purpose of this baseline is to prevent future work from assuming that Capability exposure or Prompt policy can restrict authority that a Runtime already possesses independently.
