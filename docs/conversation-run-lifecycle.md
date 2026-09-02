# Conversation / Run lifecycle baseline

> Status: **normative MVP product and implementation contract** for Conversation（会话）, Run（运行）, New Context（新上下文）, background execution, History（历史） and Draft（草稿） lifecycle. If lifecycle wording elsewhere is ambiguous, this document is authoritative for these semantics.

## Why this document exists

ALOHA separates several concepts that must not be collapsed into one UI action:

- **Conversation / Context（会话 / 上下文）** — the short-lived interaction context shown on the main surface;
- **Run（运行）** — one active Agent execution triggered by an accepted Submission（提交）;
- **Current Work Surface（当前工作面）** — the presentation of the currently selected conversation;
- **Draft（草稿）** — unsent Composer text and Ready pending-resource references;
- **History（历史）** — conventional conversation-list/message-flow recall and run management.

The main invariant is:

> **Changing the selected Conversation is not the same operation as stopping a Run.**

## Same-conversation Submission while Working

When the current conversation already has a Working Run and the user sends another Submission **inside that same conversation**:

1. the new Submission is an interrupting candidate, not a queued follow-up;
2. the old Run continues while the new Submission is being admitted;
3. only after the new Submission is accepted is the old Run marked **Superseded（已被新指令中断）** and best-effort cancellation requested;
4. if the new Submission is rejected / not accepted, the old Run continues normally;
5. late output from a superseded Run may be retained in History / Trace but must never overwrite the active Current Work Surface owned by the newer Run.

This is the only automatic supersede behavior in the MVP.

## New Context（新上下文）

Header `New Context` creates a new clean Conversation / Context. It is a conversation-lifecycle action, **not** a Run-control action.

### When no unsent Draft exists

- create/select the new conversation immediately;
- show a clean Current Work Surface;
- do not delete History or Memory.

### When an unsent Draft exists

Draft means unsent valid text and/or pending resources.

- show an explicit discard confirmation before switching;
- cancel -> remain in the current conversation with Draft unchanged;
- confirm -> discard the Draft and create/select the new conversation.

History, Settings and other ordinary non-destructive navigation never discard the current Draft.

### When the old conversation is Working

- `New Context` **does not Stop or Supersede** the old Run;
- the old Run continues in the background;
- its subsequent progress and final result remain attached to the old conversation;
- the new conversation becomes the owner of the active Current Work Surface;
- multiple conversations may therefore have independent background Working Runs at the same time.

## Background Run management from History

History is the management surface for a Run whose conversation is no longer the selected current conversation.

### Conversation List（会话列表）

- a conversation with an active Run visibly shows **Working（处理中）**;
- multiple Working conversations may appear simultaneously;
- completed / Stopped / Superseded states are reflected when relevant.

### Opening a Working historical conversation

- show its conventional chronological Message Flow（消息流）;
- show its live meaningful process state and progressive output as the background Run continues;
- provide an explicit **Stop** action for the active Run;
- do **not** show a Composer in this history view;
- do **not** allow starting, branching, resuming or sending a new conversation from historical content in the MVP.

### Stop from History

- requests best-effort cancellation of that specific Run;
- already-rendered progressive output remains visible;
- mark it **Stopped（已停止）**;
- external side effects already committed remain facts and are not presented as rolled back;
- after Stop becomes terminal, later stream events from that Run may not append to an active presentation.

### Returning from History

- return to the previously selected current conversation;
- preserve its Current Work Surface and unsent Draft;
- viewing or stopping another conversation's background Run must not mutate the current conversation's Draft.

### Background completion

When a background Run completes normally:

- its final output is stored on its original conversation;
- the History list no longer marks that conversation Working;
- it becomes an ordinary historical conversation unless selected again for viewing.

## History MVP boundary

History deliberately uses a familiar UI even though the main ALOHA screen is State-first:

- `More -> History`;
- Conversation List;
- chronological Message Flow;
- search / recall / inspection;
- live monitoring and Stop for background Working Runs.

The MVP explicitly does **not** support:

- rollback to a historical turn;
- in-place branching of a historical conversation;
- "continue from here" from a historical message;
- creating a new conversation by referencing a historical message/conversation.

Historical Reference（历史引用） semantics are deferred until a later product decision.

## Draft persistence

Draft persistence is local recovery, not History.

- persist `textDraft` locally;
- persist references/metadata for pending resources that have reached Ready;
- refresh, normal navigation and PWA process reclamation restore the recoverable Draft;
- resources that were merely Uploading must never be restored as falsely Ready;
- successful Submission clears the consumed Draft;
- explicit deletion clears the deleted text/resource;
- confirmed Draft discard during New Context clears the old Draft.

## Stop / Superseded distinction

- **Stopped（已停止）**: explicit user Stop of a Run, including Stop invoked from History;
- **Superseded（已被新指令中断）**: an accepted newer Submission inside the same conversation replaces the current Run;
- **New Context** alone produces neither marker.

Both Stop and Supersede are best-effort cancellation, not rollback of already committed external effects.

## Formal lifecycle test cases

| ID | Scenario | Action | Expected |
| --- | --- | --- | --- |
| LFC-001 | current conversation Working; no Draft | New Context | new clean conversation selected; old Run continues; no Stop/Superseded marker |
| LFC-002 | current conversation Working; Draft exists | New Context | discard confirmation shown; old state unchanged until decision |
| LFC-003 | discard confirmation | cancel | current conversation and Draft remain unchanged |
| LFC-004 | discard confirmation; old conversation Working | confirm | Draft cleared; new conversation selected; old Run continues independently |
| LFC-005 | conversation A Working; user is now in conversation B | open History | A is visibly marked Working |
| LFC-006 | conversations A and C both background Working | open History | both independently show Working |
| LFC-007 | background Working conversation | open it | chronological flow plus live process/progressive output shown; no Composer |
| LFC-008 | background Working conversation open | inspect actions | Stop available; no send/continue/branch action |
| LFC-009 | background Working conversation | Stop | best-effort cancellation requested for that Run only; partial output retained; Stopped marker added |
| LFC-010 | stopped background Run has committed external side effect | inspect result | committed effect remains visible fact; no rollback claim |
| LFC-011 | background Working Run completes normally | completion | result stays on original conversation; Working marker clears |
| LFC-012 | current conversation B has Draft; inspect/Stop background A | return to B | B's Draft and Current Work Surface unchanged |
| LFC-013 | same conversation Working | send new Submission; admission pending | old Run continues until acceptance |
| LFC-014 | replacement Submission rejected | rejection | old Run continues; no Supersede |
| LFC-015 | replacement Submission accepted | acceptance | old Run becomes Superseded; cancellation requested; new Run owns current surface |
| LFC-016 | historical completed conversation | inspect actions | no start/branch/resume/reference-new-conversation action in MVP |

## Relationship to other specifications

- [`pwa-interaction.md`](./pwa-interaction.md) owns the overall PWA product interaction baseline.
- [`composer-state-machine.md`](./composer-state-machine.md) owns Composer state/guards/invariants and its implementation-test baseline.
- **This file owns Conversation / Run lifecycle and background-Run management semantics.**

Implementation may share types across these concerns, but must preserve their semantic boundaries.